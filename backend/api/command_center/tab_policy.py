"""Chart workspace tab policy — shape validation and the public read model.

The policy is one JSON document stored as the `ui.tabs.policy` setting:

    {
      "org":      {"hidden": [...tab ids], "order": [...tab ids], "default": "summary",
                   "sections": {"chart-review": {"hidden": [...], "order": [...], "added": [...]}}},
      "roles":    {"nurse": {...same shape...}, "pharmacist": {...}},
      "contexts": {"inpatient": {...same shape...}}
    }

`sections` (slice 7b) governs the panels INSIDE a tab: hide its own, reorder,
or `add` a hostable section from another tab or module (e.g. put the
Flowsheet on Chart Review). Section ids are frontend facts too.

Layers narrow or reorder what the layer above allows (org → role →
context); the frontend resolves them (src/components/clinical/workspace/
tabPolicy.js). The backend knows nothing about which tab ids exist — the
tab catalog is built from frontend manifests at build time — so this
module checks shape only and lets the frontend ignore unknown ids with a
warning, the same way `insertAfter` tolerates a bad anchor.

`summary` can never be hidden: it is stripped from every layer's hidden
list here, and the resolver refuses it again on the client.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .settings_registry import SettingValueError

ALWAYS_VISIBLE = ("summary",)
LAYER_FIELDS = ("hidden", "order", "default", "sections")
SECTION_FIELDS = ("hidden", "order", "added")


def _id_list(value: Any, where: str) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
        raise SettingValueError(f"{where} must be a list of tab ids")
    seen: List[str] = []
    for v in value:
        v = v.strip()
        if v not in seen:
            seen.append(v)
    return seen


def _layer(value: Any, where: str) -> Dict[str, Any]:
    if value is None:
        value = {}
    if not isinstance(value, dict):
        raise SettingValueError(f"{where} must be an object with hidden / order / default")
    unknown = set(value) - set(LAYER_FIELDS)
    if unknown:
        raise SettingValueError(f"{where}: unknown field(s) {sorted(unknown)}")
    hidden = [t for t in _id_list(value.get("hidden"), f"{where}.hidden") if t not in ALWAYS_VISIBLE]
    order = _id_list(value.get("order"), f"{where}.order")
    default = value.get("default")
    if default is not None and (not isinstance(default, str) or not default.strip()):
        raise SettingValueError(f"{where}.default must be a tab id or null")
    if default in hidden:
        raise SettingValueError(f"{where}.default ({default}) is also hidden")
    return {
        "hidden": hidden,
        "order": order,
        "default": default.strip() if default else None,
        "sections": _sections(value.get("sections"), f"{where}.sections"),
    }


def _sections(value: Any, where: str) -> Dict[str, Dict[str, List[str]]]:
    """Per-tab section specs: {tab id: {hidden, order, added}} (slice 7b)."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise SettingValueError(f"{where} must be an object keyed by tab id")
    out: Dict[str, Dict[str, List[str]]] = {}
    for tab_id, spec in value.items():
        if not isinstance(tab_id, str) or not tab_id.strip():
            raise SettingValueError(f"{where}: tab ids must be non-empty strings")
        if spec is None:
            spec = {}
        if not isinstance(spec, dict):
            raise SettingValueError(f"{where}.{tab_id} must be an object with hidden / order / added")
        unknown = set(spec) - set(SECTION_FIELDS)
        if unknown:
            raise SettingValueError(f"{where}.{tab_id}: unknown field(s) {sorted(unknown)}")
        entry = {field: _id_list(spec.get(field), f"{where}.{tab_id}.{field}") for field in SECTION_FIELDS}
        if entry["hidden"] or entry["order"] or entry["added"]:
            out[tab_id.strip()] = entry
    return out


def _named_layers(value: Any, where: str) -> Dict[str, Dict[str, Any]]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise SettingValueError(f"{where} must be an object keyed by name")
    out: Dict[str, Dict[str, Any]] = {}
    for name, layer in value.items():
        if not isinstance(name, str) or not name.strip():
            raise SettingValueError(f"{where}: names must be non-empty strings")
        out[name.strip()] = _layer(layer, f"{where}.{name}")
    return out


def normalize_tab_policy(doc: Any) -> Dict[str, Any]:
    """Validate and normalize a policy document (the `ui.tabs.policy` validator)."""
    if doc is None:
        doc = {}
    if not isinstance(doc, dict):
        raise SettingValueError("tab policy must be a JSON object")
    unknown = set(doc) - {"org", "roles", "contexts"}
    if unknown:
        raise SettingValueError(f"tab policy: unknown top-level field(s) {sorted(unknown)}")
    return {
        "org": _layer(doc.get("org"), "org"),
        "roles": _named_layers(doc.get("roles"), "roles"),
        "contexts": _named_layers(doc.get("contexts"), "contexts"),
    }


EMPTY_POLICY = normalize_tab_policy({})


def known_roles() -> List[str]:
    """Roles a user can carry: the training users' roles plus the practitioner default."""
    from api.auth.config import TRAINING_USERS

    roles = {u.get("role") for u in TRAINING_USERS.values() if u.get("role")}
    roles.add("physician")
    return sorted(roles)
