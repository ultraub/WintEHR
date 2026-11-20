"""Command Center HTTP surface — thin stubs over CommandCenterService.

Registers via MODULE_ROUTERS in api/routers/__init__.py; disable per
deployment with WINTEHR_DISABLED_MODULES=command-center.

Every route here is admin-only. Reads require the `admin` permission;
later slices gate writes (settings, jobs) on `system`.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from api.auth.models import User
from api.auth.service import get_current_user

from .models import StatusReport
from .service import CommandCenterService, get_command_center_service

router = APIRouter(prefix="/api/command-center", tags=["Command Center"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if "admin" not in current_user.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.get("/status", response_model=StatusReport)
async def get_status(
    _user: User = Depends(require_admin),
    service: CommandCenterService = Depends(get_command_center_service),
):
    """Deployment status: routers, FHIR store, database, Redis, terminology index, VNA."""
    return await service.status()
