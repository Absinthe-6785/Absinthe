"""Local Supabase JWT verification — no remote auth round-trip per request."""

from __future__ import annotations

import os
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

JWT_ALGORITHM_LEGACY = "HS256"
JWT_ALGORITHMS_ASYMMETRIC = ("ES256", "RS256")
JWT_AUDIENCE = "authenticated"
JWT_ROLE = "authenticated"


@dataclass
class AuthStats:
    local_verifications: int = 0
    remote_verifications: int = 0
    jwks_fetches: int = 0
    failures: int = 0


auth_stats = AuthStats()


class AuthConfigurationError(RuntimeError):
    pass


class SupabaseJWTVerifier:
    """Verify Supabase access tokens locally (signature, exp, iss, aud, role).

    Supports asymmetric signing keys (ES256/RS256 via JWKS) and legacy HS256
    symmetric secrets when configured.
    """

    def __init__(
        self,
        supabase_url: str,
        jwt_secret: str | None = None,
        *,
        jwks_client: PyJWKClient | None = None,
    ) -> None:
        if not supabase_url:
            raise AuthConfigurationError("SUPABASE_URL is required for JWT verification")

        self._jwt_secret = jwt_secret or None
        self._issuer = f"{supabase_url.rstrip('/')}/auth/v1"
        self._jwks_url = f"{self._issuer}/.well-known/jwks.json"
        self._jwks_client = jwks_client or PyJWKClient(self._jwks_url, cache_keys=True)

    @classmethod
    def from_env(cls) -> SupabaseJWTVerifier:
        supabase_url = os.getenv("SUPABASE_URL", "")
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "").strip() or None
        return cls(supabase_url=supabase_url, jwt_secret=jwt_secret)

    @property
    def issuer(self) -> str:
        return self._issuer

    @property
    def jwks_url(self) -> str:
        return self._jwks_url

    def _decode_payload(self, token: str) -> dict:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")

        decode_kwargs = {
            "algorithms": [algorithm] if algorithm else [],
            "audience": JWT_AUDIENCE,
            "issuer": self._issuer,
            "options": {"require": ["sub", "exp", "iss", "aud"]},
        }

        if algorithm in JWT_ALGORITHMS_ASYMMETRIC:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            auth_stats.jwks_fetches += 1
            return jwt.decode(token, signing_key.key, **decode_kwargs)

        if algorithm == JWT_ALGORITHM_LEGACY and self._jwt_secret:
            return jwt.decode(token, self._jwt_secret, **decode_kwargs)

        auth_stats.failures += 1
        if algorithm == JWT_ALGORITHM_LEGACY and not self._jwt_secret:
            raise InvalidTokenError(
                "HS256 token requires SUPABASE_JWT_SECRET; project may use asymmetric JWKS signing"
            )
        raise InvalidTokenError(f"Unsupported JWT algorithm: {algorithm!r}")

    def verify_token(self, token: str) -> str:
        try:
            payload = self._decode_payload(token)
        except InvalidTokenError:
            auth_stats.failures += 1
            raise

        role = payload.get("role")
        if role != JWT_ROLE:
            auth_stats.failures += 1
            raise InvalidTokenError("Invalid token role")

        user_id = payload.get("sub")
        if not user_id or not isinstance(user_id, str):
            auth_stats.failures += 1
            raise InvalidTokenError("Missing sub claim")

        auth_stats.local_verifications += 1
        return user_id
