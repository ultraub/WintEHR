"""Job runner (slice 3): registry validation, cap, single-active rule, run loop,
progress, logs, cancel from another worker, lost-job reconciliation, audit.

A FakeRunner stands in for subprocesses; MemoryJobsRepository for Postgres.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest

from api.command_center.jobs_registry import JobParamError, SyntheaProgress, SYNTHEA_LOAD, get_kind
from api.command_center.jobs_repository import ActiveJobExists, MemoryJobsRepository, StoredJob
from api.command_center.jobs_service import JobsError, JobsService


class FakeProcess:
    def __init__(self, script, exit_code=0, hold=None):
        self.script = script          # list of lines, or "__wait__" to block until released
        self.exit_code = exit_code
        self.hold = hold              # asyncio.Event released by the test
        self.terminated = False

    async def lines(self):
        for line in self.script:
            if line == "__wait__":
                if self.hold is not None:
                    await self.hold.wait()
                if self.terminated:
                    return
                continue
            if self.terminated:
                return
            yield line
            await asyncio.sleep(0)

    async def wait(self):
        return 143 if self.terminated else self.exit_code

    def terminate(self):
        self.terminated = True
        if self.hold is not None:
            self.hold.set()


class FakeRunner:
    def __init__(self):
        self.next = []
        self.started = []

    def queue(self, script, exit_code=0, hold=None):
        self.next.append(FakeProcess(script, exit_code, hold))

    async def start(self, argv, cwd):
        self.started.append((argv, cwd))
        return self.next.pop(0)


class FakeAudit:
    def __init__(self):
        self.events = []

    async def log_event(self, **kwargs):
        self.events.append(kwargs)


def _service(tmp_path, repo=None, patients=0, cap=500, audit=None, worker="w1"):
    runner = FakeRunner()

    async def count():
        return patients

    async def setting(key):
        assert key == "system.patient_count_cap"
        return cap

    svc = JobsService(repo or MemoryJobsRepository(), runner=runner, patient_count=count,
                      setting=setting, audit=audit, log_dir=str(tmp_path / "jobs"),
                      heartbeat_seconds=0.01, worker_name=worker)
    return svc, runner


SYNTHEA_OUTPUT = [
    "STEP 1: Generating Synthea Data",
    "✓ Synthea data generated in /app/synthea/output",
    "Found 4 bundle files",
    "  ✓ hospitalInformation.json (3 resources)",
    "  ✓ practitionerInformation.json (9 resources)",
    "  ✓ Alice_1.json (400 resources)",
    "  ✗ Bob_2.json: Error loading - boom",
    "STEP 3: Verifying Data",
    "✓ PIPELINE COMPLETE",
]


# --- registry ----------------------------------------------------------------------


def test_synthea_params_are_validated_and_become_an_argv_allow_list():
    clean = SYNTHEA_LOAD.validate({"count": "25", "state": "Texas"})
    assert clean == {"count": 25, "state": "Texas"}
    assert SYNTHEA_LOAD.command(clean) == ["python", "-u", "/app/scripts/synthea_to_hapi_pipeline.py", "25", "Texas"]
    assert SYNTHEA_LOAD.validate({}) == {"count": 10, "state": "Massachusetts"}
    for bad in ({"count": 0}, {"count": 5000}, {"count": "ten"}, {"state": "Narnia"}, {"state": "Texas; rm -rf /"}):
        with pytest.raises(JobParamError):
            SYNTHEA_LOAD.validate(bad)
    with pytest.raises(KeyError):
        get_kind("nope")


def test_synthea_progress_parser_tracks_bundles():
    p = SyntheaProgress()
    seen = [u for u in (p.feed(l) for l in SYNTHEA_OUTPUT) if u]
    progresses = [u.progress for u in seen if u.progress is not None]
    assert progresses == sorted(progresses), "progress never goes backwards"
    assert progresses[0] < 0.1 and progresses[-1] == 1.0
    assert any("Loaded 4/4" in (u.message or "") for u in seen)
    assert p.feed("irrelevant chatter") is None


# --- start: cap and single-active rule ---------------------------------------------


@pytest.mark.asyncio
async def test_start_refuses_when_the_patient_cap_would_be_exceeded(tmp_path):
    svc, runner = _service(tmp_path, patients=490, cap=500)
    with pytest.raises(JobsError) as exc:
        await svc.start("synthea_load", {"count": 20}, "demo-admin")
    assert exc.value.status_code == 409 and "patient count cap" in exc.value.detail
    assert runner.started == [] and await svc.repository.recent() == []


@pytest.mark.asyncio
async def test_start_rejects_unknown_kind_and_bad_params(tmp_path):
    svc, _ = _service(tmp_path)
    with pytest.raises(JobsError) as exc:
        await svc.start("nope", {}, "u")
    assert exc.value.status_code == 404
    with pytest.raises(JobsError) as exc:
        await svc.start("synthea_load", {"count": "lots"}, "u")
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_only_one_active_job_per_deployment(tmp_path):
    svc, runner = _service(tmp_path)
    hold = asyncio.Event()
    runner.queue(["__wait__"], hold=hold)
    first = await svc.start("synthea_load", {"count": 1}, "u")
    with pytest.raises(JobsError) as exc:
        await svc.start("synthea_load", {"count": 1}, "u")
    assert exc.value.status_code == 409 and first.id in exc.value.detail
    hold.set()
    await svc.wait(first.id)
    assert (await svc.get(first.id)).status == "succeeded"


def test_memory_repository_emulates_the_partial_unique_index():
    repo = MemoryJobsRepository()
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(repo.insert(StoredJob(id="a", kind="k", params="{}", status="running")))
        with pytest.raises(ActiveJobExists):
            loop.run_until_complete(repo.insert(StoredJob(id="b", kind="k", params="{}", status="queued")))
        loop.run_until_complete(repo.insert(StoredJob(id="c", kind="k", params="{}", status="failed")))
    finally:
        loop.close()


# --- the run loop -------------------------------------------------------------------


@pytest.mark.asyncio
async def test_successful_run_records_progress_log_and_audit(tmp_path):
    audit = FakeAudit()
    svc, runner = _service(tmp_path, patients=100, cap=500, audit=audit)
    runner.queue(SYNTHEA_OUTPUT, exit_code=0)

    job = await svc.start("synthea_load", {"count": 3, "state": "Ohio"}, "demo-admin")
    assert job.status == "queued" and job.params == {"count": 3, "state": "Ohio"}

    await svc.wait(job.id)
    assert runner.started[0][0][-2:] == ["3", "Ohio"] and runner.started[0][1] == "/app"
    done = await svc.get(job.id)
    assert done.status == "succeeded" and done.progress == 1.0 and done.exit_code == 0
    assert done.started_at and done.finished_at and done.worker == "w1"

    chunk = await svc.tail_log(job.id)
    assert chunk.text.startswith("$ python -u /app/scripts/synthea_to_hapi_pipeline.py 3 Ohio")
    assert "Alice_1.json" in chunk.text and chunk.text.rstrip().endswith("[exit 0]") and chunk.finished

    # Incremental tailing: a second read from next_offset returns nothing new.
    again = await svc.tail_log(job.id, offset=chunk.next_offset)
    assert again.text == "" and again.next_offset == chunk.next_offset

    assert [e["event_type"] for e in audit.events] == ["system.job.started"]
    assert audit.events[0]["details"]["params"] == {"count": 3, "state": "Ohio"}


@pytest.mark.asyncio
async def test_nonzero_exit_is_failed_with_the_last_message(tmp_path):
    svc, runner = _service(tmp_path)
    runner.queue(["STEP 1: Generating", "✗ Pipeline failed: no bundles were loaded"], exit_code=1)
    job = await svc.start("synthea_load", {"count": 1}, "u")
    await svc.wait(job.id)
    done = await svc.get(job.id)
    assert done.status == "failed" and done.exit_code == 1
    assert "no bundles were loaded" in done.message and "code 1" in done.message
    assert done.progress is not None and done.progress < 1.0


@pytest.mark.asyncio
async def test_runner_crash_is_a_failed_job_not_an_exception(tmp_path):
    class Boom:
        async def start(self, argv, cwd):
            raise FileNotFoundError("java not found")

    svc, _ = _service(tmp_path)
    svc.runner = Boom()
    job = await svc.start("synthea_load", {"count": 1}, "u")
    await svc.wait(job.id)
    done = await svc.get(job.id)
    assert done.status == "failed" and "java not found" in done.message
    assert "[runner error]" in (await svc.tail_log(job.id)).text


# --- cancel -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cancel_from_this_worker_terminates_immediately(tmp_path):
    audit = FakeAudit()
    svc, runner = _service(tmp_path, audit=audit)
    hold = asyncio.Event()
    runner.queue(["STEP 1", "__wait__", "never"], hold=hold)
    job = await svc.start("synthea_load", {"count": 1}, "u")
    await asyncio.sleep(0.02)
    view = await svc.cancel(job.id, "u")
    assert view.cancel_requested is True
    await svc.wait(job.id)
    done = await svc.get(job.id)
    assert done.status == "cancelled" and done.exit_code == 143
    assert [e["event_type"] for e in audit.events] == ["system.job.started", "system.job.cancelled"]


@pytest.mark.asyncio
async def test_cancel_from_another_worker_is_seen_at_the_next_heartbeat(tmp_path):
    repo = MemoryJobsRepository()
    running, runner = _service(tmp_path, repo=repo, worker="w1")
    other, _ = _service(tmp_path, repo=repo, worker="w2")
    runner.queue(["STEP 1", "line", "line", "line", "line", "line", "line"], exit_code=0)

    # Make the running worker slow enough that the other worker can flag it mid-run.
    orig_lines = FakeProcess.lines

    async def slow_lines(self):
        async for line in orig_lines(self):
            await asyncio.sleep(0.005)
            yield line

    FakeProcess.lines = slow_lines
    try:
        job = await running.start("synthea_load", {"count": 1}, "u")
        await asyncio.sleep(0.012)
        await other.cancel(job.id, "u")        # w2 has no process handle; it only flips the row
        await running.wait(job.id)
    finally:
        FakeProcess.lines = orig_lines
    assert (await other.get(job.id)).status == "cancelled"


@pytest.mark.asyncio
async def test_cancel_of_a_finished_job_is_a_409(tmp_path):
    svc, runner = _service(tmp_path)
    runner.queue([], exit_code=0)
    job = await svc.start("synthea_load", {"count": 1}, "u")
    await svc.wait(job.id)
    with pytest.raises(JobsError) as exc:
        await svc.cancel(job.id, "u")
    assert exc.value.status_code == 409


# --- lost jobs ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_job_whose_worker_stopped_heartbeating_is_marked_lost(tmp_path):
    repo = MemoryJobsRepository()
    stale = datetime.now(timezone.utc) - timedelta(hours=1)
    await repo.insert(StoredJob(id="dead", kind="synthea_load", params="{}", status="running",
                                created_at=stale, started_at=stale, heartbeat_at=stale, worker="old:1"))
    svc, runner = _service(tmp_path, repo=repo)

    listed = await svc.list()
    assert listed[0].status == "lost" and "old:1" in listed[0].message

    # And the slot is free again.
    runner.queue([], exit_code=0)
    job = await svc.start("synthea_load", {"count": 1}, "u")
    await svc.wait(job.id)
    assert (await svc.get(job.id)).status == "succeeded"


@pytest.mark.asyncio
async def test_kinds_view_exposes_schema_and_patient_flag(tmp_path):
    svc, _ = _service(tmp_path)
    kinds = svc.kinds_view()
    assert kinds[0].key == "synthea_load" and kinds[0].adds_patients is True
    assert kinds[0].param_schema["state"]["options"][0] == "Alabama"
    assert json.dumps([k.model_dump() for k in kinds])  # serialisable
