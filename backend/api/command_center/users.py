"""User management (slice 16): the editable layer over the built-in training users.

The four demo logins stay defined in code (`api/auth/config.TRAINING_USERS`).
The `auth.users` setting (json, live tier) adds to and adjusts that map
without a redeploy:

    {
      "nurse":  {"disabled": true},                       # a built-in: `disabled` and/or
      "admin":  {"password_hash": "$2b$12$..."},          #   its own `password_hash`
      "jsmith": {"name": "Jane Smith", "role": "nurse",   # a custom user: full record
                 "email": "jsmith@example.com", "department": "ICU",
                 "permissions": ["read", "write"],        # optional; default = the role's
                 "password_hash": "$2b$12$...", "disabled": false}
    }

Passwords are bcrypt hashes (`api/auth/jwt_handler.get_password_hash`); the
plain password exists only in the create / update request. The setting's
value is redacted from the audit trail (`audit_value=False`) and the Users
API never returns the hash; `GET /settings` and the config export do carry
it, which is what makes a configuration portable.

Login (`api/auth/service.resolve_login_user`) and every authenticated
request (`get_current_user` → `user_disabled`) read this setting live, so
disabling a user takes effect on their next request, not their next login.
`admin` can never be disabled or deleted (the lockout guard, like roles).
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from .models import UserCreate, UserUpdate, UserView
from .roles import KNOWN_PERMISSION_KEYS, default_roles
from .settings_registry import SettingValueError
from .settings_service import SettingsError, SettingsService

logger = logging.getLogger(__name__)

USERS_SETTING = "auth.users"
USERNAME = re.compile(r"^[a-z0-9][a-z0-9._-]{1,31}$")
PROTECTED = ("admin",)           # never disabled, never deleted
CUSTOM_FIELDS = ("name", "email", "role", "department", "permissions", "password_hash", "disabled")
DEFAULT_EMAIL_DOMAIN = "wintehr.example.com"


def builtin_users() -> Dict[str, Dict[str, Any]]:
    from api.auth.config import TRAINING_USERS

    return TRAINING_USERS


def normalize_users(doc: Any) -> Dict[str, Dict[str, Any]]:
    """Validator for the `auth.users` setting."""
    if doc is None:
        doc = {}
    if not isinstance(doc, dict):
        raise SettingValueError("users must be an object keyed by username")
    builtin = builtin_users()
    out: Dict[str, Dict[str, Any]] = {}
    for username, spec in doc.items():
        if not isinstance(username, str) or not USERNAME.match(username):
            raise SettingValueError(f"users: {username!r} is not a valid username (lowercase letters, digits, . _ -, 2-32 chars)")
        if not isinstance(spec, dict):
            raise SettingValueError(f"users.{username} must be an object")
        disabled = spec.get("disabled", False)
        if not isinstance(disabled, bool):
            raise SettingValueError(f"users.{username}.disabled must be true or false")
        if username in PROTECTED and disabled:
            raise SettingValueError(f"users.{username} cannot be disabled (it is the only login that can undo a change)")
        if username in builtin:
            extra = set(spec) - {"disabled", "password_hash"}
            if extra:
                raise SettingValueError(f"users.{username} is built in; only 'disabled' and 'password_hash' can be set (got {sorted(extra)})")
            entry_builtin: Dict[str, Any] = {}
            if disabled:
                entry_builtin["disabled"] = True
            builtin_hash = spec.get("password_hash")
            if builtin_hash is not None:
                if not isinstance(builtin_hash, str) or not builtin_hash.startswith("$2"):
                    raise SettingValueError(f"users.{username}.password_hash must be a bcrypt hash")
                entry_builtin["password_hash"] = builtin_hash
            if entry_builtin:
                out[username] = entry_builtin
            continue
        unknown = set(spec) - set(CUSTOM_FIELDS)
        if unknown:
            raise SettingValueError(f"users.{username}: unknown field(s) {sorted(unknown)}")
        name = spec.get("name")
        role = spec.get("role")
        if not isinstance(name, str) or not name.strip():
            raise SettingValueError(f"users.{username}.name is required")
        if not isinstance(role, str) or not role.strip():
            raise SettingValueError(f"users.{username}.role is required")
        password_hash = spec.get("password_hash")
        if not isinstance(password_hash, str) or not password_hash.startswith("$2"):
            raise SettingValueError(f"users.{username}.password_hash must be a bcrypt hash")
        perms = spec.get("permissions")
        if perms is not None:
            if not isinstance(perms, list) or not all(isinstance(p, str) for p in perms):
                raise SettingValueError(f"users.{username}.permissions must be a list of strings")
            unknown_perms = [p for p in perms if p not in KNOWN_PERMISSION_KEYS]
            if unknown_perms:
                raise SettingValueError(f"users.{username}: unknown permission(s) {unknown_perms}")
            perms = list(dict.fromkeys(perms))
        email = spec.get("email") or f"{username}@{DEFAULT_EMAIL_DOMAIN}"
        if not isinstance(email, str) or "@" not in email:
            raise SettingValueError(f"users.{username}.email must be an email address")
        department = spec.get("department")
        if department is not None and not isinstance(department, str):
            raise SettingValueError(f"users.{username}.department must be a string")
        entry: Dict[str, Any] = {"name": name.strip(), "role": role.strip(), "email": email.strip(),
                                 "password_hash": password_hash, "disabled": disabled}
        if department:
            entry["department"] = department.strip()
        if perms is not None:
            entry["permissions"] = perms
        out[username] = entry
    return out


def role_permissions(role: str) -> List[str]:
    return list(default_roles().get(role, {}).get("permissions", []))


def user_record(username: str, doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The User fields for `username` (built-in or custom) plus `disabled`; None if unknown."""
    builtin = builtin_users()
    if username in builtin:
        return {**builtin[username], "disabled": bool((doc.get(username) or {}).get("disabled"))}
    spec = doc.get(username)
    if not isinstance(spec, dict) or "password_hash" not in spec:
        return None
    return {
        "id": f"user-{username}", "username": username, "name": spec["name"], "email": spec["email"],
        "role": spec["role"], "permissions": list(spec.get("permissions") or role_permissions(spec["role"])),
        "department": spec.get("department"), "disabled": bool(spec.get("disabled")),
    }


def _password_kind(username: str, spec: Dict[str, Any], source: str) -> str:
    """'own' (set here), 'server' (admin, from WINTEHR_ADMIN_PASSWORD) or 'training' (the shared one)."""
    if source == "custom":
        return "own"
    from api.auth.service import builtin_password_rule

    rule = builtin_password_rule(username, spec, False)
    return rule if rule in ("own", "server") else "training"


def user_views(doc: Dict[str, Any]) -> List[UserView]:
    views = []
    for username in list(builtin_users()) + sorted(u for u in doc if u not in builtin_users()):
        rec = user_record(username, doc)
        if rec is None:
            continue
        source = "builtin" if username in builtin_users() else "custom"
        views.append(UserView(
            username=username, id=rec["id"], name=rec["name"], email=rec["email"], role=rec["role"],
            department=rec.get("department"), permissions=list(rec["permissions"]), source=source,
            disabled=rec["disabled"], protected=username in PROTECTED,
            credential=_password_kind(username, doc.get(username) or {}, source),
            permissions_explicit=source == "custom" and "permissions" in (doc.get(username) or {}),
        ))
    return views


class UsersService:
    """Create / update / delete over the `auth.users` setting. Every write goes through
    SettingsService.set (validated, cached, versioned, audited with the value redacted)
    plus one `system.user.*` audit event naming the user, never the hash."""

    def __init__(self, settings: SettingsService):
        self.settings = settings

    async def doc(self) -> Dict[str, Any]:
        return dict(await self.settings.get(USERS_SETTING) or {})

    async def list(self) -> List[UserView]:
        return user_views(await self.doc())

    async def create(self, body: UserCreate, by: Optional[str]) -> UserView:
        from api.auth.jwt_handler import get_password_hash

        doc = await self.doc()
        if body.username in builtin_users() or body.username in doc:
            raise SettingsError(409, f"user '{body.username}' already exists")
        entry: Dict[str, Any] = {"name": body.name, "role": body.role, "password_hash": get_password_hash(body.password), "disabled": False}
        if body.email:
            entry["email"] = body.email
        if body.department:
            entry["department"] = body.department
        if body.permissions is not None:
            entry["permissions"] = body.permissions
        doc[body.username] = entry
        await self._save(doc, by, "system.user.created", {"username": body.username, "role": body.role, "action": "create"})
        return await self._one(body.username)

    async def update(self, username: str, body: UserUpdate, by: Optional[str], acting_username: Optional[str] = None) -> UserView:
        from api.auth.jwt_handler import get_password_hash

        doc = await self.doc()
        builtin = username in builtin_users()
        if not builtin and username not in doc:
            raise SettingsError(404, f"no user '{username}'")
        changed: List[str] = []
        if body.disabled is not None:
            if body.disabled and username == acting_username:
                raise SettingsError(409, "you cannot disable your own login")
            if builtin:
                entry_builtin = dict(doc.get(username) or {})
                if body.disabled:
                    entry_builtin["disabled"] = True
                else:
                    entry_builtin.pop("disabled", None)
                self._put_builtin(doc, username, entry_builtin)
            else:
                doc[username]["disabled"] = body.disabled
            changed.append("disabled" if body.disabled else "enabled")
        if builtin:
            other = [f for f in ("name", "role", "email", "department", "permissions") if getattr(body, f) is not None]
            if other:
                raise SettingsError(409, f"'{username}' is built in; only its password and disabled can change here (edit api/auth/config.py for {other})")
            # A built-in user can be given its own password, which replaces the
            # shared training password for that login; removing it goes back.
            entry_builtin = dict(doc.get(username) or {})
            if body.password is not None:
                entry_builtin["password_hash"] = get_password_hash(body.password)
                changed.append("password")
            elif body.remove_password and "password_hash" in entry_builtin:
                if username in PROTECTED and await self._admin_would_be_locked_out():
                    raise SettingsError(409, "passwords are required and the server sets no admin password; "
                                             "removing this one would lock the administrator out")
                entry_builtin.pop("password_hash")
                changed.append("password removed")
            self._put_builtin(doc, username, entry_builtin)
        else:
            entry = doc[username]
            for field in ("name", "role", "email", "department"):
                value = getattr(body, field)
                if value is not None:
                    entry[field] = value
                    changed.append(field)
            if body.permissions is not None:
                entry["permissions"] = body.permissions
                changed.append("permissions")
            if body.password is not None:
                entry["password_hash"] = get_password_hash(body.password)
                changed.append("password")
        if not changed:
            return await self._one(username)
        await self._save(doc, by, "system.user.updated", {"username": username, "changed": changed, "action": "update"})
        return await self._one(username)

    async def delete(self, username: str, by: Optional[str], acting_username: Optional[str] = None) -> None:
        doc = await self.doc()
        if username in builtin_users():
            raise SettingsError(409, f"'{username}' is built in; disable it instead of deleting")
        if username not in doc:
            raise SettingsError(404, f"no user '{username}'")
        if username == acting_username:
            raise SettingsError(409, "you cannot delete your own login")
        doc.pop(username)
        await self._save(doc, by, "system.user.deleted", {"username": username, "action": "delete"})

    async def _admin_would_be_locked_out(self) -> bool:
        """True when passwords are required and only the stored hash lets admin in."""
        from api.auth import config as auth_config

        return bool(await self.settings.get("auth.require_passwords")) and not auth_config.ADMIN_PASSWORD

    @staticmethod
    def _put_builtin(doc: Dict[str, Any], username: str, entry: Dict[str, Any]) -> None:
        """A built-in user is stored only while it differs from the code's defaults."""
        if entry:
            doc[username] = entry
        else:
            doc.pop(username, None)

    async def _save(self, doc: Dict[str, Any], by: Optional[str], event_type: str, details: Dict[str, Any]) -> None:
        await self.settings.set(USERS_SETTING, doc, by)
        if self.settings.audit is None:
            return
        try:
            await self.settings.audit.log_event(event_type=event_type, user_id=by, action=details.get("action"), outcome="success", details=details)
        except Exception as exc:  # noqa: BLE001 — audit must never block an admin action
            logger.warning("Audit of %s failed: %s", event_type, exc)

    async def _one(self, username: str) -> UserView:
        # Re-read: the stored document is the validator's normalized form (defaults filled in).
        return next(v for v in user_views(await self.doc()) if v.username == username)
