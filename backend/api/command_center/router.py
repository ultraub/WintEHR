"""Command Center HTTP surface — thin stubs over the module's services.

Registers via MODULE_ROUTERS in api/routers/__init__.py; disable per
deployment with WINTEHR_DISABLED_MODULES=command-center.

Permissions: reads need `admin`; anything that changes the deployment
(settings now, jobs later) needs `system`. Both are plain entries in
User.permissions (api/auth/config.py).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from api.auth.models import User
from api.auth.service import get_current_user

from .jobs_service import JobsError, JobsService, default_jobs_service
from .models import (
    JobKindView,
    JobLogChunk,
    JobStartRequest,
    JobView,
    SettingUpdate,
    SettingView,
    StatusReport,
)
from .service import CommandCenterService, get_command_center_service
from .settings_service import SettingsError, SettingsService, default_settings_service

router = APIRouter(prefix="/api/command-center", tags=["Command Center"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if "admin" not in current_user.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_system(current_user: User = Depends(get_current_user)) -> User:
    if "system" not in current_user.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator access required",
        )
    return current_user


def get_settings_service() -> SettingsService:
    return default_settings_service()


def get_jobs_service() -> JobsService:
    return default_jobs_service()


# --- status ---------------------------------------------------------------------


@router.get("/status", response_model=StatusReport)
async def get_status(
    _user: User = Depends(require_admin),
    service: CommandCenterService = Depends(get_command_center_service),
):
    """Deployment status: routers, FHIR store, database, Redis, terminology index, VNA."""
    return await service.status()


# --- settings -------------------------------------------------------------------


@router.get("/settings", response_model=List[SettingView])
async def list_settings(
    _user: User = Depends(require_admin),
    settings: SettingsService = Depends(get_settings_service),
):
    """Every managed setting with its effective value, source, and tier."""
    return await settings.list()


@router.put("/settings/{key}", response_model=SettingView)
async def update_setting(
    key: str,
    body: SettingUpdate,
    user: User = Depends(require_system),
    settings: SettingsService = Depends(get_settings_service),
):
    """Store an override. Secrets require WINTEHR_SETTINGS_KEY on the backend."""
    try:
        return await settings.set(key, body.value, user.id)
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.delete("/settings/{key}", response_model=SettingView)
async def reset_setting(
    key: str,
    user: User = Depends(require_system),
    settings: SettingsService = Depends(get_settings_service),
):
    """Drop the override; the setting falls back to its env var or default."""
    try:
        return await settings.reset(key, user.id)
    except SettingsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


# --- jobs ------------------------------------------------------------------------


@router.get("/jobs/kinds", response_model=List[JobKindView])
async def list_job_kinds(
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    """The jobs this deployment can run, with their parameter schemas."""
    return jobs.kinds_view()


@router.get("/jobs", response_model=List[JobView])
async def list_jobs(
    limit: int = 50,
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    """Recent jobs, newest first. Also reconciles jobs whose worker died."""
    return await jobs.list(limit=max(1, min(limit, 500)))


@router.post("/jobs", response_model=JobView, status_code=status.HTTP_202_ACCEPTED)
async def start_job(
    body: JobStartRequest,
    user: User = Depends(require_system),
    jobs: JobsService = Depends(get_jobs_service),
):
    """Start a job. 409 if one is already active or a patient cap would be exceeded."""
    try:
        return await jobs.start(body.kind, body.params, user.id)
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.get("/jobs/{job_id}", response_model=JobView)
async def get_job(
    job_id: str,
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    try:
        return await jobs.get(job_id)
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.get("/jobs/{job_id}/log", response_model=JobLogChunk)
async def get_job_log(
    job_id: str,
    offset: int = 0,
    _user: User = Depends(require_admin),
    jobs: JobsService = Depends(get_jobs_service),
):
    """A chunk of the job's log from `offset`; poll with `next_offset` until `finished`."""
    try:
        return await jobs.tail_log(job_id, offset=max(0, offset))
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None


@router.post("/jobs/{job_id}/cancel", response_model=JobView)
async def cancel_job(
    job_id: str,
    user: User = Depends(require_system),
    jobs: JobsService = Depends(get_jobs_service),
):
    """Request cancellation; the running worker terminates the process at its next heartbeat."""
    try:
        return await jobs.cancel(job_id, user.id)
    except JobsError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
