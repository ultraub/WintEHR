"""Permission gates shared by admin surfaces.

Two levels, both plain entries in User.permissions (api/auth/config.py,
overridable at runtime via the Command Center's `auth.roles` setting):

  admin   — may READ administrative state (Command Center, user lists)
  system  — may CHANGE the deployment (settings, jobs, roles, policies,
            app registrations)

Use these instead of ad-hoc `in current_user.permissions` checks so the
403 detail and the vocabulary stay consistent.
"""

from fastapi import Depends, HTTPException, status

from .models import User
from .service import get_current_user


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
