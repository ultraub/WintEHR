"""
JWT token handling utilities
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import bcrypt
import jwt

from .config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_DELTA

# Direct bcrypt, not passlib. passlib 1.7.4 (its final release, 2020) reads
# bcrypt.__about__.__version__, which bcrypt 5.0 removed — failing that probe
# silently enabled a $2$ workaround bcrypt then rejected, so every login died
# on any modern bcrypt (see the near-miss recorded in
# tests/api/auth/test_password_hashing.py). bcrypt's own API is two calls.


def _truncate(password: str) -> bytes:
    # bcrypt only reads the first 72 bytes; 5.x raises on longer input rather
    # than truncating silently. Truncate explicitly so behavior is identical
    # to the passlib era and long passphrases keep verifying against their
    # stored hashes.
    return password.encode("utf-8")[:72]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash"""
    try:
        return bcrypt.checkpw(_truncate(plain_password), hashed_password.encode("utf-8"))
    except ValueError:
        # Malformed/non-bcrypt stored hash — treat as non-matching, never 500.
        return False


def get_password_hash(password: str) -> str:
    """Hash a password with bcrypt (unique salt per call)"""
    return bcrypt.hashpw(_truncate(password), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + JWT_ACCESS_TOKEN_EXPIRE_DELTA
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.PyJWTError:
        return None