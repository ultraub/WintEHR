"""
Password hashing round-trip for `api/auth/jwt_handler.py`.

This exists because of a near-miss. The dependabot bump bcrypt 4.1.2 -> 5.0.0
(PR #241) passed the whole backend suite while making **every login fail**.

passlib 1.7.4 reads `bcrypt.__about__.__version__`, which bcrypt 5.0 removed.
Detecting no version, passlib silently enables its `$2$` compatibility
workaround, and bcrypt 5.0 then rejects what that produces:

    ValueError: password cannot be longer than 72 bytes

— raised for an 8-byte password. Nothing in the suite called `hash()` or
`verify()`, so nothing caught it.

These tests exercise the real `pwd_context` (no mocks). If the passlib/bcrypt
pairing breaks again, they fail here instead of in production.
"""

import pytest

from api.auth.jwt_handler import get_password_hash, verify_password


def test_hash_then_verify_accepts_the_right_password():
    """The round trip the login path actually performs."""
    hashed = get_password_hash("password")
    assert verify_password("password", hashed) is True


def test_hash_then_verify_rejects_the_wrong_password():
    """A wrong password must not verify — the half that matters for safety."""
    hashed = get_password_hash("password")
    assert verify_password("wrong-password", hashed) is False


def test_hashing_a_short_password_does_not_raise():
    """
    Direct regression guard for the bcrypt 5.0 failure mode: this raised
    ValueError("password cannot be longer than 72 bytes") for an 8-byte input.
    """
    assert get_password_hash("password")


def test_hash_is_bcrypt_and_salted():
    """
    Two hashes of the same password must differ (unique salt), and both must
    verify. A backend that stopped salting would still pass the round-trip
    tests above.
    """
    first = get_password_hash("password")
    second = get_password_hash("password")

    assert first.startswith("$2")
    assert first != second
    assert verify_password("password", first)
    assert verify_password("password", second)


@pytest.mark.parametrize(
    "password",
    [
        "short",
        "a-fairly-ordinary-passphrase",
        "unicode-ok-café-señor",
        "x" * 72,  # bcrypt's real input ceiling
    ],
)
def test_round_trip_across_representative_passwords(password):
    """Guards the boundary the spurious 72-byte error pointed at."""
    hashed = get_password_hash(password)
    assert verify_password(password, hashed) is True

    # Differ in the FIRST character, not by appending. bcrypt truncates input
    # at 72 bytes, so for the 72-byte case `password + "!"` is the very same
    # input and correctly verifies true.
    wrong = ("y" if password[0] != "y" else "z") + password[1:]
    assert verify_password(wrong, hashed) is False
