"""Tests for local Supabase JWT verification."""

from __future__ import annotations

import time
import uuid

import jwt
import pytest
from jwt.exceptions import (
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidTokenError,
)

from auth import (
    JWT_ALGORITHM_LEGACY,
    JWT_AUDIENCE,
    JWT_ROLE,
    AuthStats,
    SupabaseJWTVerifier,
    auth_stats,
)

TEST_SECRET = "test-jwt-secret-for-k91g-unit-tests-32b"
TEST_SUPABASE_URL = "https://example.supabase.co"
TEST_ISSUER = f"{TEST_SUPABASE_URL}/auth/v1"


def _make_token(
    *,
    secret: str = TEST_SECRET,
    sub: str | None = None,
    exp_offset: int = 3600,
    aud: str = JWT_AUDIENCE,
    iss: str = TEST_ISSUER,
    role: str = JWT_ROLE,
) -> str:
    now = int(time.time())
    payload = {
        "sub": sub or str(uuid.uuid4()),
        "exp": now + exp_offset,
        "iat": now,
        "iss": iss,
        "aud": aud,
        "role": role,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM_LEGACY)


@pytest.fixture
def verifier() -> SupabaseJWTVerifier:
    return SupabaseJWTVerifier(supabase_url=TEST_SUPABASE_URL, jwt_secret=TEST_SECRET)


@pytest.fixture(autouse=True)
def reset_stats() -> None:
    auth_stats.local_verifications = 0
    auth_stats.remote_verifications = 0
    auth_stats.failures = 0


def test_verify_valid_token_returns_sub(verifier: SupabaseJWTVerifier) -> None:
    user_id = str(uuid.uuid4())
    token = _make_token(sub=user_id)

    assert verifier.verify_token(token) == user_id
    assert auth_stats.local_verifications == 1
    assert auth_stats.remote_verifications == 0


def test_rejects_expired_token(verifier: SupabaseJWTVerifier) -> None:
    token = _make_token(exp_offset=-60)

    with pytest.raises(ExpiredSignatureError):
        verifier.verify_token(token)

    assert auth_stats.failures == 1


def test_rejects_wrong_signature(verifier: SupabaseJWTVerifier) -> None:
    token = _make_token(secret="wrong-secret")

    with pytest.raises(InvalidTokenError):
        verifier.verify_token(token)

    assert auth_stats.failures == 1


def test_rejects_wrong_issuer(verifier: SupabaseJWTVerifier) -> None:
    token = _make_token(iss="https://evil.example.com/auth/v1")

    with pytest.raises(InvalidIssuerError):
        verifier.verify_token(token)

    assert auth_stats.failures == 1


def test_rejects_wrong_audience(verifier: SupabaseJWTVerifier) -> None:
    token = _make_token(aud="service_role")

    with pytest.raises(InvalidAudienceError):
        verifier.verify_token(token)

    assert auth_stats.failures == 1


def test_rejects_wrong_role(verifier: SupabaseJWTVerifier) -> None:
    token = _make_token(role="anon")

    with pytest.raises(InvalidTokenError, match="Invalid token role"):
        verifier.verify_token(token)

    assert auth_stats.failures == 1


def test_rejects_missing_sub(verifier: SupabaseJWTVerifier) -> None:
    now = int(time.time())
    payload = {
        "exp": now + 3600,
        "iat": now,
        "iss": TEST_ISSUER,
        "aud": JWT_AUDIENCE,
        "role": JWT_ROLE,
    }
    token = jwt.encode(payload, TEST_SECRET, algorithm=JWT_ALGORITHM_LEGACY)

    with pytest.raises(InvalidTokenError, match="sub"):
        verifier.verify_token(token)

    assert auth_stats.failures == 1


def test_from_env_requires_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)

    from auth import AuthConfigurationError

    with pytest.raises(AuthConfigurationError):
        SupabaseJWTVerifier.from_env()


def test_100_local_verifications_zero_remote(verifier: SupabaseJWTVerifier) -> None:
    token = _make_token()
    stats = AuthStats()

    for _ in range(100):
        verifier.verify_token(token)
        stats.local_verifications += 1

    assert stats.local_verifications == 100
    assert stats.remote_verifications == 0
