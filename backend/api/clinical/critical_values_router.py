"""Critical-value reference endpoint (R33).

Serves the single critical-value threshold table defined in
``api/clinical/critical_values.py`` so every frontend consumer classifies lab
values against the same source instead of carrying its own copy.

Resolved path: ``GET /api/clinical/critical-values`` (full prefix carried
here; registered without an extra prefix in ``api/routers/__init__.py``).
"""

from typing import Any, Dict

from fastapi import APIRouter

from api.clinical.critical_values import get_critical_value_table

router = APIRouter(prefix="/api/clinical", tags=["clinical-reference"])


@router.get("/critical-values")
async def get_critical_values_reference() -> Dict[str, Any]:
    """Return the critical-value threshold table.

    Static reference data — one entry per LOINC code:
    ``{loinc, label, unit, criticalLow, criticalHigh, low, high}``.
    ``low``/``high`` are the abnormal (non-critical) bounds; any bound may be
    ``null`` when the source tables define no threshold for that direction.
    """
    table = get_critical_value_table()
    return {"criticalValues": table, "count": len(table)}
