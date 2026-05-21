"""Unit tests for app.core.security — JWT and password hashing."""
import time
from datetime import timedelta
from unittest.mock import patch

import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def test_hash_password_is_not_plaintext():
    hashed = hash_password("MySecret1!")
    assert hashed != "MySecret1!"
    assert len(hashed) > 20


def test_verify_password_correct():
    plain = "Correct1!"
    assert verify_password(plain, hash_password(plain)) is True


def test_verify_password_wrong():
    assert verify_password("Wrong1!", hash_password("Right1!")) is False


def test_hash_password_unique_salts():
    h1 = hash_password("Same1!")
    h2 = hash_password("Same1!")
    assert h1 != h2


# ---------------------------------------------------------------------------
# create_access_token / decode_token round-trip
# ---------------------------------------------------------------------------

def test_access_token_contains_subject_and_role():
    token = create_access_token("user-uuid-123", "shipper")
    payload = decode_token(token)
    assert payload["sub"] == "user-uuid-123"
    assert payload["role"] == "shipper"
    assert payload["type"] == "access"


def test_access_token_with_admin_role():
    token = create_access_token("admin-uuid", "admin", admin_role="super_admin")
    payload = decode_token(token)
    assert payload["admin_role"] == "super_admin"


def test_access_token_without_admin_role_has_no_admin_role_key():
    token = create_access_token("user-uuid", "owner")
    payload = decode_token(token)
    assert "admin_role" not in payload


# ---------------------------------------------------------------------------
# create_refresh_token
# ---------------------------------------------------------------------------

def test_refresh_token_type():
    token = create_refresh_token("user-uuid-456")
    payload = decode_token(token)
    assert payload["type"] == "refresh"
    assert payload["sub"] == "user-uuid-456"


# ---------------------------------------------------------------------------
# decode_token error cases
# ---------------------------------------------------------------------------

def test_decode_invalid_token_raises():
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_token("not.a.valid.jwt")


def test_decode_tampered_token_raises():
    token = create_access_token("user", "shipper")
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(ValueError):
        decode_token(tampered)


def test_decode_expired_token_raises():
    with patch("app.core.security.timedelta", return_value=timedelta(seconds=-1)):
        token = create_access_token("user", "shipper")
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_token(token)
