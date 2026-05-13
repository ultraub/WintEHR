"""
Tests for Phase 1 CDS Studio operations reliability (#125 + #130):
- log_service_execution writes to cds_visual_builder.execution_logs
- _log_failure invokes log_service_execution with success=False
- log_service_execution swallows DB errors (non-fatal)
"""

from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from api.cds_hooks.feedback.persistence import log_service_execution


def _mk_db(scalar_value=42):
    """Mock AsyncSession that records the INSERT call and returns a row id."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar = MagicMock(return_value=scalar_value)
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_log_service_execution_inserts_with_all_fields():
    """The helper must call db.execute exactly once with all positional params
    forwarded to the SQL INSERT, then commit."""
    db = _mk_db(scalar_value=99)

    row_id = await log_service_execution(
        db,
        service_id="diabetes-screening",
        patient_id="Patient/123",
        user_id="Practitioner/u1",
        hook_instance="abc-uuid",
        success=True,
        execution_time_ms=42,
        cards_returned=2,
        error_message=None,
    )

    assert row_id == 99
    db.execute.assert_awaited_once()
    db.commit.assert_awaited_once()
    # The bound params on the INSERT — second positional arg to execute()
    _, params = db.execute.call_args.args
    assert params["service_id"] == "diabetes-screening"
    assert params["patient_id"] == "Patient/123"
    assert params["user_id"] == "Practitioner/u1"
    assert params["hook_instance"] == "abc-uuid"
    assert params["success"] is True
    assert params["execution_time_ms"] == 42
    assert params["cards_returned"] == 2
    assert params["error_message"] is None


@pytest.mark.asyncio
async def test_log_service_execution_records_failure_with_error_message():
    """Failure path: success=False + error_message gets persisted as-is."""
    db = _mk_db(scalar_value=7)

    row_id = await log_service_execution(
        db,
        service_id="broken-cql-service",
        patient_id=None,
        user_id=None,
        hook_instance=None,
        success=False,
        execution_time_ms=120,
        cards_returned=0,
        error_message="HAPI 500: Could not compile CQL",
    )

    assert row_id == 7
    _, params = db.execute.call_args.args
    assert params["success"] is False
    assert params["error_message"] == "HAPI 500: Could not compile CQL"
    assert params["cards_returned"] == 0


@pytest.mark.asyncio
async def test_log_service_execution_swallows_db_errors():
    """A logging failure must NEVER propagate — the hook fire it's attached
    to has already happened by the time we log, so any DB hiccup here is a
    metrics blind spot, not a user-visible 500. Verifies the helper returns
    None and rolls back instead of raising."""
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=IntegrityError("INSERT", {}, Exception("FK gone")))
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    row_id = await log_service_execution(
        db,
        service_id="ghost-service",
        patient_id="Patient/123",
        user_id="Practitioner/u1",
        hook_instance="x",
        success=True,
        execution_time_ms=10,
        cards_returned=0,
    )

    assert row_id is None
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_log_service_failure_extracts_dict_context():
    """log_service_failure extracts patientId/userId from a dict
    request_context and forwards them to log_service_execution with
    success=False."""
    from unittest.mock import patch as mock_patch
    from api.cds_hooks.feedback.persistence import log_service_failure

    db = AsyncMock()
    start = datetime.now()

    with mock_patch(
        "api.cds_hooks.feedback.persistence.log_service_execution",
        new=AsyncMock(return_value=1),
    ) as mock_log:
        await log_service_failure(
            db,
            service_id="svc-1",
            request_context={"patientId": "Patient/p7", "userId": "Practitioner/u2"},
            hook_instance="hi-uuid",
            start_time=start,
            error_message="Boom from upstream",
        )

    mock_log.assert_awaited_once()
    kwargs = mock_log.call_args.kwargs
    assert kwargs["service_id"] == "svc-1"
    assert kwargs["patient_id"] == "Patient/p7"
    assert kwargs["user_id"] == "Practitioner/u2"
    assert kwargs["hook_instance"] == "hi-uuid"
    assert kwargs["success"] is False
    assert kwargs["cards_returned"] == 0
    assert "Boom from upstream" in kwargs["error_message"]


@pytest.mark.asyncio
async def test_log_service_failure_extracts_model_context():
    """request_context may be a Pydantic model instead of a dict; the
    helper uses getattr so both shapes work."""
    from unittest.mock import patch as mock_patch
    from api.cds_hooks.feedback.persistence import log_service_failure

    ctx = MagicMock()
    ctx.patientId = "Patient/x"
    ctx.userId = "Practitioner/y"
    # Force isinstance(ctx, dict) → False
    type(ctx).__bool__ = lambda self: True
    db = AsyncMock()

    with mock_patch(
        "api.cds_hooks.feedback.persistence.log_service_execution",
        new=AsyncMock(return_value=1),
    ) as mock_log:
        await log_service_failure(
            db,
            service_id="svc",
            request_context=ctx,
            hook_instance=None,
            start_time=datetime.now(),
            error_message="err",
        )

    kwargs = mock_log.call_args.kwargs
    assert kwargs["patient_id"] == "Patient/x"
    assert kwargs["user_id"] == "Practitioner/y"


@pytest.mark.asyncio
async def test_log_service_failure_truncates_long_error_messages():
    """Long stack traces or upstream payloads must be trimmed so the
    error_message TEXT column doesn't get poisoned with multi-MB payloads.
    Truncation cap is 1000 chars."""
    from unittest.mock import patch as mock_patch
    from api.cds_hooks.feedback.persistence import log_service_failure

    db = AsyncMock()
    huge = "x" * 5000

    with mock_patch(
        "api.cds_hooks.feedback.persistence.log_service_execution",
        new=AsyncMock(return_value=1),
    ) as mock_log:
        await log_service_failure(
            db,
            service_id="svc",
            request_context={},
            hook_instance=None,
            start_time=datetime.now(),
            error_message=huge,
        )

    kwargs = mock_log.call_args.kwargs
    assert len(kwargs["error_message"]) == 1000


@pytest.mark.asyncio
async def test_log_service_failure_never_raises_even_if_logger_crashes():
    """If log_service_execution itself blows up (e.g. DB pool exhausted),
    log_service_failure must catch and continue so the exception arm of
    execute_service still returns its CDSHookResponse(cards=[])."""
    from unittest.mock import patch as mock_patch
    from api.cds_hooks.feedback.persistence import log_service_failure

    db = AsyncMock()

    with mock_patch(
        "api.cds_hooks.feedback.persistence.log_service_execution",
        new=AsyncMock(side_effect=RuntimeError("connection pool exhausted")),
    ):
        # Must not raise
        await log_service_failure(
            db,
            service_id="svc",
            request_context={},
            hook_instance=None,
            start_time=datetime.now(),
            error_message="err",
        )
