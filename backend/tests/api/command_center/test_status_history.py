"""Health history (slice 17): recording from status(), the pure summary (uptime,
incidents), the sampler election, the route, and the SQL repository's statements."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from api.command_center.models import ComponentStatus
from api.command_center.router import get_status_history
from api.command_center.service import CommandCenterService
from api.command_center.status_history import (
    ENSURE_SCHEMA_SQL,
    MemoryStatusHistoryRepository,
    Snapshot,
    SqlStatusHistoryRepository,
    StatusHistoryService,
    sampler_tick,
    summarize,
)

T0 = datetime(2026, 11, 21, 10, 0, tzinfo=timezone.utc)


def _snap(minutes, overall, **components):
    return Snapshot(checked_at=T0 + timedelta(minutes=minutes), overall=overall, components=components)


def _probe(name, status):
    async def probe():
        return ComponentStatus(name=name, status=status)

    return probe


def _state():
    return lambda: {"registered": 1, "failed": [], "disabled_modules": [], "modules": []}


@pytest.mark.asyncio
async def test_every_status_report_is_recorded_and_history_failures_never_fail_the_report():
    repo = MemoryStatusHistoryRepository()
    history = StatusHistoryService(repo)
    svc = CommandCenterService(hapi_client=object(), probes={"fhir": _probe("fhir", "ok"), "redis": _probe("redis", "down")},
                               router_state=_state(), timeout_seconds=1.0, history=history)
    report = await svc.status()
    assert report.status == "degraded"
    assert len(repo.rows) == 1 and repo.rows[0].components == {"fhir": "ok", "redis": "down"} and repo.rows[0].source == "request"

    class Broken:
        async def add(self, snapshot):
            raise RuntimeError("postgres away")

        async def since(self, when):
            return []

        async def latest_at(self):
            return None

    svc.history = StatusHistoryService(Broken())
    assert (await svc.status()).status == "degraded"          # recorded nothing, raised nothing
    silent = CommandCenterService(hapi_client=object(), probes={"fhir": _probe("fhir", "ok")}, router_state=_state(), timeout_seconds=1.0, history=None)
    await silent.status()
    assert len(repo.rows) == 1


def test_summary_computes_uptime_and_incidents_with_ongoing_runs():
    rows = [
        _snap(0, "ok", fhir="ok", redis="ok", vna="absent"),
        _snap(5, "degraded", fhir="ok", redis="down", vna="absent"),
        _snap(10, "degraded", fhir="ok", redis="down", vna="absent"),
        _snap(15, "ok", fhir="ok", redis="ok", vna="absent"),
        _snap(20, "degraded", fhir="degraded", redis="ok", vna="absent"),
        _snap(25, "down", fhir="down", redis="ok"),
    ]
    out = summarize(rows, hours=1, now=T0 + timedelta(minutes=30))
    assert out.uptime == {"fhir": 66.7, "redis": 66.7, "vna": 100.0} and out.overall_uptime == 33.3
    assert out.since == T0 + timedelta(minutes=-30) and len(out.samples) == 6 and out.samples[1].overall == "degraded"
    by = [(i.component, i.status, i.samples, i.ongoing) for i in out.incidents]
    assert by == [("fhir", "down", 1, True), ("fhir", "degraded", 1, False), ("redis", "down", 2, False)]
    redis = next(i for i in out.incidents if i.component == "redis")
    assert redis.first_seen == T0 + timedelta(minutes=5) and redis.last_seen == T0 + timedelta(minutes=10)
    empty = summarize([], hours=24)
    assert empty.uptime == {} and empty.overall_uptime is None and empty.incidents == []


@pytest.mark.asyncio
async def test_history_route_clamps_the_window_and_the_repository_prunes():
    repo = MemoryStatusHistoryRepository()
    history = StatusHistoryService(repo)
    now = datetime.now(timezone.utc)
    await repo.add(Snapshot(now - timedelta(days=9), "ok", {"fhir": "ok"}))
    await repo.add(Snapshot(now - timedelta(hours=30), "ok", {"fhir": "ok"}))
    await repo.add(Snapshot(now - timedelta(hours=2), "degraded", {"fhir": "degraded"}))
    assert len(repo.rows) == 2                         # the 9-day-old row was pruned on insert
    day = await get_status_history(hours=24, _user=object(), history=history)
    assert len(day.samples) == 1 and day.uptime == {"fhir": 0.0} and day.incidents[0].ongoing
    week = await get_status_history(hours=99999, _user=object(), history=history)
    assert week.hours == 24 * 7 and len(week.samples) == 2
    assert (await get_status_history(hours=0, _user=object(), history=history)).hours == 1


class FakeLock:
    def __init__(self):
        self.held = {}
        self.calls = []

    async def set(self, key, value, nx=False, ex=None):
        self.calls.append((key, nx, ex))
        if nx and key in self.held:
            return None
        self.held[key] = value
        return True


@pytest.mark.asyncio
async def test_sampler_samples_once_per_interval_and_elects_through_the_lock(monkeypatch):
    from api.command_center import status_history as sh

    lock = FakeLock()
    repo = MemoryStatusHistoryRepository()
    history = StatusHistoryService(repo, lock_client=lock)
    reports = []

    class FakeService:
        def __init__(self, history=None):
            pass

        async def status(self):
            from api.command_center.models import BuildInfo, RouterStatus, StatusReport

            r = StatusReport(status="ok", checked_at=datetime.now(timezone.utc), build=BuildInfo(), routers=RouterStatus(),
                             components=[ComponentStatus(name="fhir", status="ok")])
            reports.append(r)
            return r

    import api.command_center.service as service_module
    monkeypatch.setattr(service_module, "CommandCenterService", FakeService)

    assert await sampler_tick(history, interval=300) is True
    assert repo.rows[-1].source == "sampler" and lock.calls[-1] == (sh.LOCK_KEY, True, 270)
    # a second worker in the same tick: the newest row is fresh → no sample, no lock attempt
    other = StatusHistoryService(repo, lock_client=lock)
    assert await sampler_tick(other, interval=300) is False and len(lock.calls) == 1
    # a stale row but a lock already held by another worker → no sample
    repo.rows = [Snapshot(datetime.now(timezone.utc) - timedelta(hours=1), "ok", {"fhir": "ok"})]
    assert await sampler_tick(other, interval=300) is False and len(lock.calls) == 2
    lock.held.clear()
    assert await sampler_tick(other, interval=300) is True
    # no Redis: the freshness check alone decides
    plain = StatusHistoryService(repo)
    assert await sampler_tick(plain, interval=300) is False
    repo.rows = []
    assert await sampler_tick(plain, interval=300) is True and len(reports) == 3


@pytest.mark.asyncio
async def test_sql_repository_runs_schema_insert_prune_and_select():
    executed = []

    class FakeResult:
        def __init__(self, rows):
            self._rows = rows

        def all(self):
            return self._rows

        def first(self):
            return self._rows[0] if self._rows else None

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def execute(self, statement, params=None):
            sql = str(statement)
            executed.append((sql.strip().split()[0], params))
            if sql.strip().startswith("SELECT checked_at, overall"):
                return FakeResult([(T0, "ok", '{"fhir": "ok"}', "sampler")])
            if sql.strip().startswith("SELECT checked_at FROM"):
                return FakeResult([(T0.replace(tzinfo=None),)])
            return FakeResult([])

        async def commit(self):
            executed.append(("COMMIT", None))

    repo = SqlStatusHistoryRepository(session_maker=lambda: FakeSession())
    await repo.add(Snapshot(T0, "ok", {"fhir": "ok"}, "sampler"))
    verbs = [v for v, _ in executed]
    assert verbs[: len(ENSURE_SCHEMA_SQL)] == ["CREATE", "CREATE", "CREATE"] and "INSERT" in verbs and "DELETE" in verbs
    insert = next(p for v, p in executed if v == "INSERT")
    assert insert["components"] == '{"fhir": "ok"}' and insert["source"] == "sampler"
    rows = await repo.since(T0 - timedelta(hours=1))
    assert rows == [Snapshot(T0, "ok", {"fhir": "ok"}, "sampler")]
    assert (await repo.latest_at()) == T0                # naive timestamps come back UTC-aware
