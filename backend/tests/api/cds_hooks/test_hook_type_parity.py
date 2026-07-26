"""
Hook-type parity pin (bug B4, docs/ARCHITECTURE_DEBT.md).

The HookType enum here is the authority; the frontend mirrors it in
frontend/src/constants/cdsHookTypes.js, whose test pins the SAME literal
list. Adding or removing a hook must touch both files — this test (or its
frontend twin) failing is the alarm.
"""

from api.cds_hooks.models import HookType

MIRRORED_IN_FRONTEND = [
    "patient-view",
    "medication-prescribe",
    "order-sign",
    "order-select",
    "encounter-start",
    "encounter-discharge",
    "allergyintolerance-create",
    "appointment-book",
    "medication-refill",
    "order-dispatch",
    "problem-list-item-create",
]


def test_hook_type_enum_matches_the_frontend_mirror():
    assert sorted(h.value for h in HookType) == sorted(MIRRORED_IN_FRONTEND)
