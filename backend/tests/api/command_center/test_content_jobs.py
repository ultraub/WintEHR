"""Slice 4: terminology and DICOM job kinds, the orchestrator scripts' plans,
secret env injection, and the terminology index hot reload."""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import sqlite3
from pathlib import Path

import pytest

from api.command_center.jobs_registry import (
    DICOM_GENERATE,
    JobParamError,
    KINDS,
    StepProgress,
    TERMINOLOGY_LOAD,
)
from api.command_center.jobs_repository import MemoryJobsRepository
from api.command_center.jobs_service import JobsService

BACKEND = Path(__file__).resolve().parents[3]


def _load_script(relative: str):
    path = BACKEND / "scripts" / relative
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- registry ----------------------------------------------------------------------


def test_step_progress_parser():
    p = StepProgress()
    assert p.feed("STEP 1/4: Download UMLS MRCONSO (~2 GB)").progress == 0.0
    u = p.feed("STEP 3/4: Build catalog search index")
    assert u.progress == 0.5 and u.message == "Step 3/4: Build catalog search index"
    assert p.feed("  $ python extract ...") is None
    assert p.feed("DONE: terminology pipeline complete").progress == 1.0
    assert p.feed("✗ Preflight failed: UMLS_API_KEY is not set").message.startswith("✗ Preflight")


def test_terminology_kind_params_and_argv():
    clean = TERMINOLOGY_LOAD.validate({})
    assert clean == {"skip_download": False, "include_snomed": False, "load_into_hapi": True, "max_per_vocab": 0}
    assert TERMINOLOGY_LOAD.command(clean) == ["python", "-u", "/app/scripts/terminology/run_pipeline.py"]

    clean = TERMINOLOGY_LOAD.validate({"skip_download": "true", "include_snomed": True, "load_into_hapi": "off", "max_per_vocab": "500"})
    argv = TERMINOLOGY_LOAD.command(clean)
    assert argv[3:] == ["--skip-download", "--include-snomed", "--skip-hapi-load", "--max-per-vocab", "500"]

    for bad in ({"skip_download": "maybe"}, {"max_per_vocab": -1}, {"max_per_vocab": "lots"}):
        with pytest.raises(JobParamError):
            TERMINOLOGY_LOAD.validate(bad)
    assert TERMINOLOGY_LOAD.secret_env == {"UMLS_API_KEY": "system.umls_api_key"}
    assert TERMINOLOGY_LOAD.patients_added is None


def test_dicom_kind_params_and_argv():
    assert DICOM_GENERATE.command(DICOM_GENERATE.validate({})) == ["python", "-u", "/app/scripts/active/run_imaging_pipeline.py"]
    assert DICOM_GENERATE.command(DICOM_GENERATE.validate({"max_studies": 5}))[-2:] == ["--max-studies", "5"]
    with pytest.raises(JobParamError):
        DICOM_GENERATE.validate({"max_studies": "x"})
    assert set(KINDS) == {"synthea_load", "terminology_load", "dicom_generate"}


# --- secret env injection ------------------------------------------------------------


class _Proc:
    async def lines(self):
        yield "STEP 1/1: hi"
        yield "DONE"

    async def wait(self):
        return 0

    def terminate(self):
        pass


class _Runner:
    def __init__(self):
        self.env = None

    async def start(self, argv, cwd, env=None):
        self.env = env
        return _Proc()


@pytest.mark.asyncio
async def test_terminology_job_gets_the_umls_key_from_settings_but_never_logs_it(tmp_path):
    runner = _Runner()

    async def setting(key):
        return {"system.umls_api_key": "umls-SECRET-123", "system.patient_count_cap": 500}.get(key)

    async def count():
        return 0

    svc = JobsService(MemoryJobsRepository(), runner=runner, patient_count=count, setting=setting,
                      log_dir=str(tmp_path), heartbeat_seconds=0.01)
    job = await svc.start("terminology_load", {"load_into_hapi": False}, "u")
    await svc.wait(job.id)
    assert runner.env == {"UMLS_API_KEY": "umls-SECRET-123"}
    log = (await svc.tail_log(job.id)).text
    assert "umls-SECRET-123" not in log and "UMLS_API_KEY from settings" in log
    assert (await svc.get(job.id)).status == "succeeded"

    kinds = {k.key: k for k in svc.kinds_view()}
    assert kinds["terminology_load"].required_settings == ["system.umls_api_key"]
    assert kinds["dicom_generate"].required_settings == []


@pytest.mark.asyncio
async def test_unset_secret_is_simply_absent_from_the_env(tmp_path):
    runner = _Runner()

    async def setting(key):
        return None

    async def count():
        return 0

    svc = JobsService(MemoryJobsRepository(), runner=runner, patient_count=count, setting=setting,
                      log_dir=str(tmp_path), heartbeat_seconds=0.01)
    job = await svc.start("terminology_load", {}, "u")
    await svc.wait(job.id)
    assert runner.env == {}


# --- orchestrator scripts -------------------------------------------------------------


def _term_args(tmp_path, **overrides):
    base = dict(work_dir=str(tmp_path / "work"), index_output=str(tmp_path / "terminology.db"),
                hapi_url="http://hapi:8080/fhir", timeout=600, release=None, skip_download=False,
                include_snomed=False, skip_hapi_load=False, max_per_vocab=0)
    base.update(overrides)
    return argparse.Namespace(**base)


def test_terminology_pipeline_plan_and_preflight(tmp_path, monkeypatch):
    rp = _load_script("terminology/run_pipeline.py")
    steps = rp.plan(_term_args(tmp_path, include_snomed=True, max_per_vocab=100))
    labels = [s["label"] for s in steps]
    assert labels[0].startswith("Download") and labels[-1].startswith("Load CodeSystems")
    assert "--include-snomed" in steps[1]["argv"] and "100" in steps[1]["argv"]
    assert steps[2]["argv"][-1].endswith("terminology.db.building"), "index is built to a temp file"
    assert steps[2]["finalize"][1] == Path(tmp_path / "terminology.db")

    monkeypatch.delenv("UMLS_API_KEY", raising=False)
    assert "UMLS_API_KEY" in rp.preflight(_term_args(tmp_path), steps)

    # --skip-download without a download on disk is an error, not a silent skip.
    skip = rp.plan(_term_args(tmp_path, skip_download=True))
    assert rp.preflight(_term_args(tmp_path, skip_download=True), skip).startswith("ERROR")

    # With MRCONSO present, no key is needed and the download step is skipped.
    (tmp_path / "work" / "umls_source").mkdir(parents=True)
    (tmp_path / "work" / "umls_source" / "MRCONSO.RRF").write_text("x")
    skip = rp.plan(_term_args(tmp_path, skip_download=True, skip_hapi_load=True))
    assert skip[0]["skip_reason"].startswith("skipped") and skip[3]["skip_reason"].startswith("skipped")
    assert rp.preflight(_term_args(tmp_path, skip_download=True, skip_hapi_load=True), skip) is None


def test_terminology_pipeline_refuses_without_disk_space(tmp_path, monkeypatch):
    rp = _load_script("terminology/run_pipeline.py")
    monkeypatch.setenv("UMLS_API_KEY", "k")
    monkeypatch.setattr(rp.shutil, "disk_usage", lambda p: type("u", (), {"free": 1e9})())
    steps = rp.plan(_term_args(tmp_path))
    assert "GB free" in rp.preflight(_term_args(tmp_path), steps)


def test_imaging_pipeline_plan_and_preflight(monkeypatch):
    ip = _load_script("active/run_imaging_pipeline.py")
    args = argparse.Namespace(max_studies=3, dicom_dir="/app/data/generated_dicoms")
    steps = ip.plan(args)
    assert [s["argv"][2].split("/")[-1] for s in steps] == [
        "generate_dicom_from_hapi.py", "stow_dicom_to_dcm4chee.py", "create_dicom_endpoints.py"]
    assert steps[0]["argv"][-2:] == ["--max-studies", "3"] and steps[1]["argv"][-2:] == ["--max-studies", "3"]
    assert "--max-studies" not in steps[2]["argv"]
    monkeypatch.delenv("DICOM_QIDO_URL", raising=False)
    assert "DICOM_QIDO_URL" in ip.preflight(args)


# --- terminology index hot reload -----------------------------------------------------


def _write_index(path: Path, rows):
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE concepts (domain TEXT, system TEXT, code TEXT, display TEXT)")
    conn.execute("CREATE VIRTUAL TABLE concepts_fts USING fts5(display)")
    for i, (domain, system, code, display) in enumerate(rows, 1):
        conn.execute("INSERT INTO concepts VALUES (?,?,?,?)", (domain, system, code, display))
        conn.execute("INSERT INTO concepts_fts (rowid, display) VALUES (?, ?)", (i, display))
    conn.commit()
    conn.close()


def test_terminology_service_follows_the_index_file(tmp_path, monkeypatch):
    import services.terminology_service as ts
    from services.local_terminology_index import LocalTerminologyIndex

    db = tmp_path / "terminology.db"
    monkeypatch.setenv("TERMINOLOGY_DB_PATH", str(db))
    monkeypatch.setattr(ts, "_terminology_service", None)
    monkeypatch.setattr(ts, "_terminology_signature", None)

    first = ts.get_terminology_service()
    assert not isinstance(first, LocalTerminologyIndex), "no file → HAPI fallback"

    _write_index(db, [("lab", "http://loinc.org", "1", "Glucose")])
    second = ts.get_terminology_service()
    assert isinstance(second, LocalTerminologyIndex), "file appeared → local index, no restart"
    assert ts.get_terminology_service() is second, "unchanged file → same instance"

    # A rebuild renames a new file into place: the service must re-open it.
    tmp = tmp_path / "terminology.db.building"
    _write_index(tmp, [("lab", "http://loinc.org", "1", "Glucose"), ("lab", "http://loinc.org", "2", "Sodium")])
    import os, time
    os.utime(tmp, (time.time() + 5, time.time() + 5))
    os.replace(tmp, db)
    third = ts.get_terminology_service()
    assert third is not second and isinstance(third, LocalTerminologyIndex)

    db.unlink()
    fourth = ts.get_terminology_service()
    assert not isinstance(fourth, LocalTerminologyIndex), "file gone → fallback again"
