"""Inactive Notes-only authentication gateway, kept outside live backend modules.

The signer is a trusted backend boundary, separate from the restricted DB login.
No environment configuration, HTTP route, pool or credentials are created here.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import Callable
from uuid import UUID

import jwt

from auth import SupabaseJWTVerifier
from notes_identity_guard_candidate import supported_snapshot

AUDIENCE = "absinthe.notes.private-gateway.candidate.v1"
SCHEMA = "notes_identity_candidate"
CALLS = {
    "prepare": f"select {SCHEMA}.private_prepare(%s, %s)",
    "apply": f"select {SCHEMA}.private_apply(%s, %s)",
}


class GatewayDenied(RuntimeError):
    """Bounded error: never include tokens, signatures, DSNs or Note content."""


class PsycopgCalls:
    """Fixed, parameterized calls using an injected trusted psycopg 3 factory.

    A factory must yield an idle restricted connection. No application/user state
    is set on it. Return only AFTER both transaction/connection contexts succeed.
    Deployment credentials, TLS and actual pool configuration are NOT provided.
    """

    def __init__(self, connect: Callable):
        self._connect = connect

    def call(self, name: str, text: str, mac: bytes):
        if name not in CALLS:
            raise GatewayDenied("INVALID_CALL")
        try:
            with self._connect() as conn:
                if int(conn.info.transaction_status) != 0:
                    raise GatewayDenied("TRANSPORT_NOT_IDLE")
                with conn.transaction():
                    row = conn.execute(CALLS[name], (text, mac)).fetchone()
                    if row is None:
                        raise GatewayDenied("UNCONFIRMED_DATABASE_RESULT")
                    result = row[0]
            return result
        except GatewayDenied:
            raise
        except Exception:
            raise GatewayDenied("DATABASE_DENIED") from None


@dataclass
class PrivateGateway:
    verifier: SupabaseJWTVerifier
    calls: object = field(repr=False)
    signing_key: bytes = field(repr=False)
    enabled: bool = False
    clock: Callable[[], float] = field(default=time.time, repr=False)

    def __post_init__(self):
        if not isinstance(self.verifier, SupabaseJWTVerifier):
            raise GatewayDenied("VERIFIER_REQUIRED")
        if type(self.signing_key) is not bytes or len(self.signing_key) < 32:
            raise GatewayDenied("SEPARATE_SIGNING_KEY_REQUIRED")
        legacy = self.verifier._jwt_secret
        if legacy and hmac.compare_digest(self.signing_key, legacy.encode()):
            raise GatewayDenied("SEPARATE_SIGNING_KEY_REQUIRED")

    def _authenticate(self, token: str) -> tuple[str, int]:
        if self.enabled is not True:
            raise GatewayDenied("CANDIDATE_NOT_ACTIVATED")
        try:
            owner = self.verifier.verify_token(token)
            if str(UUID(owner)) != owner or UUID(owner).int == 0:
                raise ValueError()
            # The SAME token was fully verified above. Only its signed expiry is
            # extracted here, never an unverified source of owner authority.
            expiry = jwt.decode(token, options={"verify_signature": False})["exp"]
            now = int(self.clock())
            if type(expiry) is not int or expiry <= now:
                raise ValueError()
            return owner, min(expiry, now + 30)
        except Exception:
            raise GatewayDenied("AUTHENTICATION_DENIED") from None

    def _sign(self, value: dict) -> tuple[str, bytes]:
        text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        return text, hmac.new(self.signing_key, text.encode("utf-8"), hashlib.sha256).digest()

    def prepare(self, token: str, action: str, operation_id: str, *,
                note_id: str | None = None, payload: object = None) -> dict:
        owner, expiry = self._authenticate(token)
        if (action not in {"reserve", "publish", "retire"}
                or type(operation_id) is not str or not operation_id.strip() or len(operation_id) > 200):
            raise GatewayDenied("INVALID_INTENT")
        if action == "reserve":
            if note_id is not None or payload is not None:
                raise GatewayDenied("INVALID_INTENT")
        elif type(note_id) is not str or not note_id.strip():
            raise GatewayDenied("INVALID_INTENT")
        if (action == "publish" and not supported_snapshot(payload)) or (action != "publish" and payload is not None):
            raise GatewayDenied("INVALID_INTENT")
        intent = dict(owner=owner, action=action, operation_id=operation_id, note_id=note_id, payload=payload)
        text, mac = self._sign(dict(intent, aud=AUDIENCE + ".prepare", expires=expiry))
        context = self.calls.call("prepare", text, mac)
        if not self._valid_context(context, intent):
            raise GatewayDenied("UNCONFIRMED_DATABASE_CONTEXT")
        return context

    @staticmethod
    def _valid_context(context: object, intent: dict | None = None) -> bool:
        if type(context) is not dict or set(context) != {"context_id", "generation", "expires", "intent"}:
            return False
        try:
            if str(UUID(context["context_id"])) != context["context_id"]:
                return False
        except (ValueError, TypeError, AttributeError):
            return False
        return (type(context["generation"]) is int and context["generation"] > 0
                and type(context["expires"]) is int
                and type(context["intent"]) is dict
                and (intent is None or context["intent"] == intent))

    def apply(self, token: str, context: dict) -> str:
        owner, expiry = self._authenticate(token)
        if not self._valid_context(context) or context["intent"].get("owner") != owner:
            raise GatewayDenied("CONTEXT_ACCOUNT_MISMATCH")
        # No API accepts owner/generation arguments. DB verifies the complete
        # immutable context, even if a caller changes this in-memory dictionary.
        if context["expires"] <= int(self.clock()):
            raise GatewayDenied("AUTHORITY_EXPIRED")
        text, mac = self._sign(dict(aud=AUDIENCE + ".apply", context=context,
                                   expires=min(expiry, context["expires"])))
        result = self.calls.call("apply", text, mac)
        if type(result) is not str or not result:
            raise GatewayDenied("UNCONFIRMED_DATABASE_RESULT")
        return result

    def run(self, token: str, action: str, operation_id: str, **kwargs) -> str:
        # A retry reuses prepare's immutable account/operation context. Neither
        # this helper nor SQL refreshes an old operation to a newer generation.
        return self.apply(token, self.prepare(token, action, operation_id, **kwargs))
