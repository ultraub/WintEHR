"""Roles and permissions — the editable layer over the built-in role map.

Roles are the four demo roles in `api/auth/config.py` (physician, nurse,
pharmacist, admin) plus whatever a Practitioner login assigns. Each role's
permissions come from TRAINING_USERS by default; the `auth.roles` setting
(json, live tier) overrides a role's permission list without a redeploy:

    {"nurse": {"permissions": ["read", "write", "order:lab", "order:imaging"]}}

Applied in `api/auth/service.get_current_user` on every request through
`effective_permissions()`, so a change takes effect on the user's next
request, not their next login.

Guard rails (validated here):
  - permissions must come from KNOWN_PERMISSIONS (typos would silently
    grant nothing)
  - the `admin` role always keeps `admin` and `system`, so the Command
    Center cannot lock out the only role that can undo a mistake
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .settings_registry import SettingValueError

# The permission vocabulary the codebase actually checks or assigns. Keep
# the descriptions honest: most are assigned to roles and shown in the UI
# but only `admin` and `system` gate endpoints today (slice 8 of
# docs/COMMAND_CENTER.md lists where each is enforced).
KNOWN_PERMISSIONS: List[Dict[str, str]] = [
    {"key": "read", "label": "Read charts", "description": "View patient data."},
    {"key": "write", "label": "Write charts", "description": "Create and edit clinical data."},
    {"key": "prescribe", "label": "Prescribe", "description": "Sign medication orders."},
    {"key": "order:medication", "label": "Order medications", "description": "Place medication orders in CPOE."},
    {"key": "order:lab", "label": "Order labs", "description": "Place laboratory orders."},
    {"key": "order:imaging", "label": "Order imaging", "description": "Place imaging orders."},
    {"key": "pharmacy:dispense", "label": "Dispense", "description": "Dispense in the pharmacy queue."},
    {"key": "pharmacy:review", "label": "Pharmacy review", "description": "Verify and review prescriptions."},
    {"key": "admin", "label": "Administrator", "description": "Open the Command Center and list users (read-only administration)."},
    {"key": "system", "label": "System administrator", "description": "Change settings, start jobs, edit roles and policies in the Command Center."},
]
KNOWN_PERMISSION_KEYS = [p["key"] for p in KNOWN_PERMISSIONS]
LOCKED = {"admin": ["admin", "system"]}  # role → permissions it can never lose


def default_roles() -> Dict[str, Dict[str, Any]]:
    """Role → {permissions, users} from the built-in user map."""
    from api.auth.config import TRAINING_USERS

    roles: Dict[str, Dict[str, Any]] = {}
    for username, user in TRAINING_USERS.items():
        role = user.get("role")
        if not role:
            continue
        entry = roles.setdefault(role, {"permissions": [], "users": []})
        for perm in user.get("permissions", []):
            if perm not in entry["permissions"]:
                entry["permissions"].append(perm)
        entry["users"].append(username)
    roles.setdefault("physician", {"permissions": ["read", "write"], "users": []})
    return roles


def normalize_roles(doc: Any) -> Dict[str, Dict[str, List[str]]]:
    """Validator for the `auth.roles` setting."""
    if doc is None:
        doc = {}
    if not isinstance(doc, dict):
        raise SettingValueError("roles must be an object keyed by role name")
    out: Dict[str, Dict[str, List[str]]] = {}
    for role, spec in doc.items():
        if not isinstance(role, str) or not role.strip():
            raise SettingValueError("role names must be non-empty strings")
        role = role.strip()
        if not isinstance(spec, dict) or set(spec) - {"permissions"}:
            raise SettingValueError(f"roles.{role} must be {{\"permissions\": [...]}}")
        perms = spec.get("permissions", [])
        if not isinstance(perms, list) or not all(isinstance(p, str) for p in perms):
            raise SettingValueError(f"roles.{role}.permissions must be a list of strings")
        unknown = [p for p in perms if p not in KNOWN_PERMISSION_KEYS]
        if unknown:
            raise SettingValueError(f"roles.{role}: unknown permission(s) {unknown}; known: {KNOWN_PERMISSION_KEYS}")
        cleaned: List[str] = []
        for p in perms:
            if p not in cleaned:
                cleaned.append(p)
        for locked in LOCKED.get(role, []):
            if locked not in cleaned:
                raise SettingValueError(f"roles.{role} must keep '{locked}' (it is the only role that can undo a change)")
        out[role] = {"permissions": cleaned}
    return out


def effective_permissions(role: Optional[str], defaults: List[str], overrides: Optional[Dict[str, Any]]) -> List[str]:
    """The permissions a user with `role` has right now."""
    if role and overrides and role in overrides:
        perms = list(overrides[role].get("permissions", []))
        for locked in LOCKED.get(role, []):
            if locked not in perms:
                perms.append(locked)
        return perms
    return list(defaults)
