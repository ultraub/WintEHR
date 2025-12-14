"""
CDS Hooks Feedback Module

Feedback persistence and analytics for CDS card responses.
"""

from .persistence import (
    FeedbackOutcome,
    FeedbackPersistenceManager,
    get_feedback_manager,
    process_cds_feedback,
    get_service_analytics,
    log_hook_execution,
)

__all__ = [
    # Enums
    "FeedbackOutcome",
    # Manager
    "FeedbackPersistenceManager",
    # Utility functions
    "get_feedback_manager",
    "process_cds_feedback",
    "get_service_analytics",
    "log_hook_execution",
]
