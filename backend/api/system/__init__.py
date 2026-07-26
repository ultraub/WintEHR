"""
System Module - Infrastructure and Monitoring

Contains system-level functionality:
- debug_router.py: Debug endpoints (development only, DEBUG=true)
- monitoring.py: System monitoring and health metrics

(health.py was deleted: its router was never registered, so its
FAILED_ROUTER_GROUPS reporting never ran. App health lives in main.py —
/health minimal, /api/health with per-router failure detail.)
"""

from .monitoring import monitoring_router
from .debug_router import debug_router

__all__ = [
    "monitoring_router",
    "debug_router",
]
