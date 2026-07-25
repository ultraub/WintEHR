"""Session ids must not be able to escape the sessions directory.

Session ids arrive from request bodies and were interpolated straight into a
filesystem path, so a crafted id could read (get_session) or DELETE
(delete_session) files outside the sessions directory.
"""

import pytest

from api.ui_composer.session_manager import SessionManager, _is_safe_session_id


TRAVERSAL_IDS = [
    "../../etc/passwd",
    "../secrets",
    "a/../../b",
    "foo/bar",
    "/absolute/path",
    "..",
    "",
    "with space",
    "semi;colon",
    "null\x00byte",
]


@pytest.mark.parametrize("bad_id", TRAVERSAL_IDS)
def test_unsafe_ids_rejected(bad_id):
    assert not _is_safe_session_id(bad_id)


@pytest.mark.parametrize("good_id", [
    "550e8400-e29b-41d4-a716-446655440000",  # uuid4, the generated shape
    "abc123",
    "A_B-c",
])
def test_safe_ids_accepted(good_id):
    assert _is_safe_session_id(good_id)


def test_session_file_returns_none_for_traversal(tmp_path):
    mgr = SessionManager(base_dir=str(tmp_path))
    for bad_id in TRAVERSAL_IDS:
        assert mgr._session_file(bad_id) is None


def test_session_file_stays_inside_sessions_dir(tmp_path):
    mgr = SessionManager(base_dir=str(tmp_path))
    path = mgr._session_file("550e8400-e29b-41d4-a716-446655440000")
    assert path is not None
    assert path.resolve().parent == mgr.sessions_dir.resolve()


@pytest.mark.asyncio
async def test_delete_session_cannot_unlink_outside(tmp_path):
    """The traversal that mattered most: delete_session unlinks the path."""
    victim = tmp_path / "victim.json"
    victim.write_text("{}")

    mgr = SessionManager(base_dir=str(tmp_path))
    # sessions_dir is tmp_path/sessions, so ../victim escapes to the victim
    deleted = await mgr.delete_session("../victim")

    assert deleted is False
    assert victim.exists(), "traversal id deleted a file outside sessions_dir"


@pytest.mark.asyncio
async def test_get_session_cannot_read_outside(tmp_path):
    secret = tmp_path / "secret.json"
    secret.write_text('{"session_id": "x", "created_at": "2026-01-01T00:00:00", '
                      '"updated_at": "2026-01-01T00:00:00"}')

    mgr = SessionManager(base_dir=str(tmp_path))
    assert await mgr.get_session("../secret") is None
