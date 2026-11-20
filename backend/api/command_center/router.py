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

from .models import SettingUpdate, SettingView, StatusReport
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
