"""Backend log viewer (slice 6): logging setup writes the parseable shape, the
reader merges per-worker files, attaches tracebacks, filters, and exports."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import pytest

from api.command_center.logs import export_logs, log_files, parse_file, read_logs
from api.command_center.router import export_backend_logs, get_backend_logs


def _write(path, lines):
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _line(ts, level, pid, logger, msg):
    return f"{ts.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3]}Z {level} {pid} {logger}: {msg}"


@pytest.fixture
def logs(tmp_path):
    base = datetime(2026, 11, 20, 17, 0, 0, tzinfo=timezone.utc)
    _write(tmp_path / "backend.11.log", [
        _line(base, "INFO", 11, "api.auth.session_store", "SessionStore[training]: using Redis"),
        _line(base + timedelta(seconds=2), "ERROR", 11, "api.fhir.proxy", "Timeout proxying GET /fhir/Patient"),
        "Traceback (most recent call last):",
        '  File "x.py", line 1, in <module>',
        "httpx.ReadTimeout: timed out",
        _line(base + timedelta(seconds=9), "WARNING", 11, "api.command_center.probes", "VNA down"),
    ])
    _write(tmp_path / "backend.12.log", [
        _line(base + timedelta(seconds=1), "INFO", 12, "api.command_center.jobs_service", "Job started"),
        _line(base + timedelta(seconds=5), "DEBUG", 12, "api.catalogs", "cache hit"),
    ])
    _write(tmp_path / "backend.12.log.1", [
        _line(base - timedelta(hours=1), "INFO", 12, "startup", "older rotated line"),
    ])
    (tmp_path / "unrelated.txt").write_text("not a log")
    return tmp_path, base


def test_files_are_discovered_with_rotations_oldest_first(logs):
    directory, _ = logs
    assert [p.name for p in log_files(directory)] == ["backend.11.log", "backend.12.log.1", "backend.12.log"]


def test_tracebacks_attach_to_the_record_before_them(logs):
    directory, _ = logs
    records = list(parse_file(directory / "backend.11.log"))
    assert len(records) == 3
    assert records[1].level == "ERROR" and "httpx.ReadTimeout" in records[1].message
    assert records[1].message.count("\n") == 3


def test_reader_merges_workers_by_time_and_filters(logs):
    directory, base = logs
    records, total, files = read_logs(directory)
    assert total == 6 and len(files) == 3
    assert [r.pid for r in records] == [12, 11, 12, 11, 12, 11]  # chronological across files
    assert [r.level for r in read_logs(directory, level="WARNING")[0]] == ["ERROR", "WARNING"]
    assert [r.logger for r in read_logs(directory, query="job")[0]] == ["api.command_center.jobs_service"]
    window = read_logs(directory, since=base + timedelta(seconds=1), until=base + timedelta(seconds=5))[0]
    assert [r.pid for r in window] == [12, 11, 12]
    tail, total, _ = read_logs(directory, limit=2)
    assert total == 6 and [r.message[:9] for r in tail] == ["cache hit", "VNA down"]


def test_export_is_plain_lines_in_the_window(logs):
    directory, base = logs
    text = export_logs(directory, since=base, until=base + timedelta(seconds=3))
    lines = text.splitlines()
    assert lines[0].endswith("using Redis") and lines[-1] == "httpx.ReadTimeout: timed out"
    assert len(lines) == 6


@pytest.mark.asyncio
async def test_endpoints_read_the_configured_directory(logs, monkeypatch):
    directory, base = logs
    monkeypatch.setenv("WINTEHR_LOG_DIR", str(directory))
    body = await get_backend_logs(level="INFO", q=None, since=None, until=None, limit=100)
    assert body.total == 5 and body.lines[-1].message == "VNA down" and body.files == 3
    assert body.lines[-1].ts.tzinfo is not None
    resp = await export_backend_logs(since=(base + timedelta(seconds=8)).isoformat(), until=None, level=None)
    assert resp.media_type == "text/plain" and b"VNA down" in resp.body
    assert "attachment" in resp.headers["content-disposition"]


def test_configure_logging_writes_the_parseable_shape(tmp_path, monkeypatch):
    import importlib

    import logging_setup

    monkeypatch.setenv("WINTEHR_LOG_DIR", str(tmp_path))
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    root = logging.getLogger()
    saved = list(root.handlers)
    try:
        root._wintehr_configured = False
        importlib.reload(logging_setup).configure_logging()
        logging.getLogger("test.logger").warning("hello %s", "world")
        for h in root.handlers:
            h.flush()
        files = list(tmp_path.glob("backend.*.log"))
        assert len(files) == 1 and files[0].name == f"backend.{os.getpid()}.log"
        records = list(parse_file(files[0]))
        assert any(r.level == "WARNING" and r.logger == "test.logger" and r.message == "hello world" for r in records)
    finally:
        for h in list(root.handlers):
            if h not in saved:
                root.removeHandler(h)
                h.close()
