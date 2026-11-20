"""Job runner: start, watch, cancel long-running admin tasks.

A job is a subprocess (argv from jobs_registry.py) run inside the backend
container by whichever uvicorn worker accepted the request. State lives in
`system.jobs`, so every worker can list, tail, and cancel it; the log is a
file under JOB_LOG_DIR (/app/data/jobs, a bind mount) that any worker can
read with an offset — the UI polls, which is multi-worker safe where a
websocket broadcast from one worker is not.

Guarantees:
  - one active job per deployment (partial unique index; 409 otherwise)
  - a job that adds patients is refused when it would exceed
    `system.patient_count_cap` (live setting)
  - the running worker heartbeats; if it dies, the next list() marks the
    job `lost` instead of leaving it `running` forever
  - cancel works from any worker: the flag is in the row, the running
    worker sees it at its next heartbeat and terminates the process
  - every start and cancel is a FHIR AuditEvent
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Protocol

from .jobs_registry import JobKind, JobParamError, KINDS, get_kind
from .jobs_repository import ActiveJobExists, JobsRepository, SqlJobsRepository, StoredJob
from .models import JobKindView, JobLogChunk, JobView

logger = logging.getLogger(__name__)

JOB_LOG_DIR = os.getenv("COMMAND_CENTER_JOB_LOG_DIR", "/app/data/jobs")
HEARTBEAT_SECONDS = float(os.getenv("COMMAND_CENTER_JOB_HEARTBEAT", "5"))
LOST_AFTER_SECONDS = HEARTBEAT_SECONDS * 12
PATIENT_CAP_SETTING = "system.patient_count_cap"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class JobsError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


# --- process abstraction ---------------------------------------------------------


class RunningProcess(Protocol):
    async def lines(self):  # async iterator of str
        ...
    async def wait(self) -> int: ...
    def terminate(self) -> None: ...


class ProcessRunner(Protocol):
    async def start(self, argv: List[str], cwd: str) -> RunningProcess: ...


class _Subprocess:
    def __init__(self, proc: asyncio.subprocess.Process):
        self.proc = proc

    async def lines(self):
        assert self.proc.stdout is not None
        while True:
            raw = await self.proc.stdout.readline()
            if not raw:
                return
            yield raw.decode("utf-8", errors="replace").rstrip("\n")

    async def wait(self) -> int:
        return await self.proc.wait()

    def terminate(self) -> None:
        if self.proc.returncode is None:
            self.proc.terminate()


class SubprocessRunner:
    async def start(self, argv: List[str], cwd: str) -> RunningProcess:
        proc = await asyncio.create_subprocess_exec(
            *argv, cwd=cwd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        return _Subprocess(proc)


# --- service --------------------------------------------------------------------


PatientCounter = Callable[[], Awaitable[int]]
SettingReader = Callable[[str], Awaitable[Any]]


async def _default_patient_count() -> int:
    from services.hapi_fhir_client import HAPIFHIRClient

    bundle = await HAPIFHIRClient().search("Patient", {"_summary": "count"})
    return int(bundle.get("total") or 0)


async def _default_setting(key: str) -> Any:
    from .settings_service import get_setting

    return await get_setting(key)


class JobsService:
    def __init__(
        self,
        repository: JobsRepository,
        runner: Optional[ProcessRunner] = None,
        patient_count: PatientCounter = _default_patient_count,
        setting: SettingReader = _default_setting,
        audit: Any = None,
        log_dir: str = JOB_LOG_DIR,
        heartbeat_seconds: float = HEARTBEAT_SECONDS,
        kinds: Dict[str, JobKind] = KINDS,
        worker_name: Optional[str] = None,
    ):
        self.repository = repository
        self.runner = runner or SubprocessRunner()
        self.patient_count = patient_count
        self.setting = setting
        self.audit = audit
        self.log_dir = Path(log_dir)
        self.heartbeat_seconds = heartbeat_seconds
        self.kinds = kinds
        self.worker_name = worker_name or f"{socket.gethostname()}:{os.getpid()}"
        self._tasks: Dict[str, asyncio.Task] = {}
        self._processes: Dict[str, RunningProcess] = {}

    # --- views ---------------------------------------------------------------------

    def kinds_view(self) -> List[JobKindView]:
        return [
            JobKindView(key=k.key, label=k.label, description=k.description,
                        param_schema=k.param_schema, adds_patients=k.patients_added is not None)
            for k in self.kinds.values()
        ]

    @staticmethod
    def _view(row: StoredJob) -> JobView:
        return JobView(
            id=row.id, kind=row.kind, params=json.loads(row.params or "{}"), status=row.status,
            progress=row.progress, message=row.message, started_by=row.started_by,
            created_at=row.created_at, started_at=row.started_at, finished_at=row.finished_at,
            cancel_requested=row.cancel_requested, exit_code=row.exit_code, worker=row.worker,
        )

    async def list(self, limit: int = 50) -> List[JobView]:
        await self._reconcile()
        return [self._view(r) for r in await self.repository.recent(limit)]

    async def get(self, job_id: str) -> JobView:
        await self._reconcile()
        row = await self.repository.get(job_id)
        if row is None:
            raise JobsError(404, f"No job {job_id}")
        return self._view(row)

    async def tail_log(self, job_id: str, offset: int = 0, max_bytes: int = 64_000) -> JobLogChunk:
        row = await self.repository.get(job_id)
        if row is None:
            raise JobsError(404, f"No job {job_id}")
        text = ""
        next_offset = offset
        if row.log_path and Path(row.log_path).exists():
            with open(row.log_path, "rb") as fh:
                fh.seek(max(offset, 0))
                data = fh.read(max_bytes)
            text = data.decode("utf-8", errors="replace")
            next_offset = offset + len(data)
        return JobLogChunk(job_id=job_id, offset=offset, next_offset=next_offset, text=text,
                           finished=row.status not in ("queued", "running"))

    # --- start / cancel ------------------------------------------------------------

    async def start(self, kind_key: str, params: Dict[str, Any], user_id: Optional[str]) -> JobView:
        try:
            kind = get_kind(kind_key)
        except KeyError as exc:
            raise JobsError(404, str(exc)) from None
        try:
            clean = kind.validate(params or {})
        except JobParamError as exc:
            raise JobsError(400, str(exc)) from None

        if kind.patients_added is not None:
            cap = int(await self.setting(PATIENT_CAP_SETTING))
            current = await self.patient_count()
            adding = kind.patients_added(clean)
            if current + adding > cap:
                raise JobsError(
                    409,
                    f"This job would add {adding} patients to the {current} loaded, exceeding the "
                    f"patient count cap of {cap} ({PATIENT_CAP_SETTING}). Raise the cap or load fewer.",
                )

        await self._reconcile()
        job_id = uuid.uuid4().hex[:12]
        self.log_dir.mkdir(parents=True, exist_ok=True)
        row = StoredJob(
            id=job_id, kind=kind.key, params=json.dumps(clean), status="queued", progress=0.0,
            message="Queued", started_by=user_id, created_at=_now(),
            log_path=str(self.log_dir / f"{job_id}.log"), worker=self.worker_name,
        )
        try:
            await self.repository.insert(row)
        except ActiveJobExists:
            active = await self.repository.active()
            what = f"{active[0].kind} ({active[0].id})" if active else "another job"
            raise JobsError(409, f"A job is already active: {what}. Wait for it to finish or cancel it.") from None

        await self._audit("system.job.started", user_id, {"job_id": job_id, "kind": kind.key, "params": clean, "action": "create"})
        self._tasks[job_id] = asyncio.get_running_loop().create_task(self._run(row, kind))
        return self._view(row)

    async def cancel(self, job_id: str, user_id: Optional[str]) -> JobView:
        row = await self.repository.get(job_id)
        if row is None:
            raise JobsError(404, f"No job {job_id}")
        if row.status not in ("queued", "running"):
            raise JobsError(409, f"Job {job_id} is {row.status}; nothing to cancel")
        row = await self.repository.update(job_id, cancel_requested=True, message="Cancel requested")
        proc = self._processes.get(job_id)
        if proc is not None:  # it is running on this worker: stop it now
            proc.terminate()
        await self._audit("system.job.cancelled", user_id, {"job_id": job_id, "kind": row.kind, "action": "update"})
        return self._view(row)

    async def wait(self, job_id: str) -> None:
        """Test helper: block until this worker's task for the job finishes."""
        task = self._tasks.get(job_id)
        if task is not None:
            await task

    # --- the run loop ---------------------------------------------------------------

    async def _run(self, row: StoredJob, kind: JobKind) -> None:
        job_id = row.id
        parser = kind.progress()
        argv = kind.command(json.loads(row.params))
        status, exit_code, message, progress = "failed", None, "Did not start", 0.0
        try:
            await self.repository.update(job_id, status="running", started_at=_now(), heartbeat_at=_now(),
                                         message="Starting", worker=self.worker_name)
            with open(row.log_path, "a", encoding="utf-8") as log:
                log.write(f"$ {' '.join(argv)}\n")
                log.flush()
                proc = await self.runner.start(argv, kind.cwd)
                self._processes[job_id] = proc
                last_beat = asyncio.get_running_loop().time()
                message = "Running"
                dirty = False
                async for line in proc.lines():
                    log.write(line + "\n")
                    update = parser.feed(line)
                    if update is not None:
                        if update.progress is not None:
                            progress = update.progress
                        if update.message:
                            message = update.message
                        dirty = True
                    now = asyncio.get_running_loop().time()
                    if dirty or now - last_beat >= self.heartbeat_seconds:
                        log.flush()
                        fresh = await self.repository.update(job_id, progress=progress, message=message, heartbeat_at=_now())
                        last_beat, dirty = now, False
                        if fresh is not None and fresh.cancel_requested:
                            proc.terminate()
                exit_code = await proc.wait()
                log.write(f"\n[exit {exit_code}]\n")
            fresh = await self.repository.get(job_id)
            if fresh is not None and fresh.cancel_requested:
                status, message = "cancelled", "Cancelled"
            elif exit_code == 0:
                status, message = "succeeded", message if progress >= 1.0 else "Finished"
            else:
                status = "failed"
                message = f"Exited with code {exit_code}: {message}"
        except Exception as exc:  # the runner itself broke, not the job
            logger.exception("Job %s crashed in the runner", job_id)
            status, message = "failed", f"Runner error: {type(exc).__name__}: {exc}"
            try:
                with open(row.log_path, "a", encoding="utf-8") as log:
                    log.write(f"\n[runner error] {exc}\n")
            except OSError:
                pass
        finally:
            self._processes.pop(job_id, None)
            self._tasks.pop(job_id, None)
            await self.repository.update(
                job_id, status=status, finished_at=_now(), exit_code=exit_code, message=message,
                progress=1.0 if status == "succeeded" else progress,
            )

    async def _reconcile(self) -> None:
        """Mark jobs whose worker stopped heartbeating as lost (survives worker restarts)."""
        cutoff = _now() - timedelta(seconds=LOST_AFTER_SECONDS)
        for row in await self.repository.active():
            if row.id in self._tasks:
                continue  # ours and alive
            last = row.heartbeat_at or row.created_at
            if last is not None and last < cutoff:
                await self.repository.update(
                    row.id, status="lost", finished_at=_now(),
                    message=f"Worker {row.worker or '?'} stopped reporting; the process may have been killed by a restart",
                )

    async def _audit(self, event_type: str, user_id: Optional[str], details: Dict[str, Any]) -> None:
        if self.audit is None:
            return
        try:
            await self.audit.log_event(event_type=event_type, user_id=user_id, action=details.get("action"),
                                       outcome="success", details=details)
        except Exception as exc:  # audit must never block an admin action
            logger.warning("Audit of job event failed: %s", exc)


_default_service: Optional[JobsService] = None


def default_jobs_service() -> JobsService:
    global _default_service
    if _default_service is None:
        from api.services.audit_event_service import AuditEventService

        _default_service = JobsService(SqlJobsRepository(), audit=AuditEventService())
    return _default_service
