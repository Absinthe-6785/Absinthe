"""Inactive Notes-only authentication gateway, kept outside live backend modules.

The signer is a trusted backend boundary, separate from the restricted DB login.
No environment configuration, HTTP route, pool or credentials are created here.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
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
CLOUD_ACTIONS = {name: "cloud_" + name for name in ("reserve", "publish", "retire", "read")}
# Deliberately narrow Markdown snapshot, not a serializer for a complete local
# Note. Reject binary-bearing syntax instead of silently dropping originals.
BINARY_REFERENCE = r"(?i)(data:|blob:|attachment:|resource:|!\[|<(img|video|audio|object|embed|iframe)\b)"


def cloud_snapshot_supported(payload: object) -> bool:
    return supported_snapshot(payload) and re.search(BINARY_REFERENCE, payload["body"]) is None


class GatewayDenied(RuntimeError):
    """Bounded error: never include tokens, signatures, DSNs or Note content."""


class GatewayIndeterminate(GatewayDenied):
    """Possible committed dispatch: reconcile explicitly, never auto-retry."""


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
        dispatched = False
        rollback_confirmed = False
        transaction_completed = False
        try:
            with self._connect() as conn:
                if int(conn.info.transaction_status) != 0:
                    raise GatewayDenied("TRANSPORT_NOT_IDLE")
                statement_error = None
                try:
                    with conn.transaction():
                        try:
                            dispatched = True
                            row = conn.execute(CALLS[name], (text, mac)).fetchone()
                            if row is None:
                                raise GatewayDenied("UNCONFIRMED_DATABASE_RESULT")
                            result = row[0]
                        except Exception as exc:
                            statement_error = exc
                            raise
                except Exception as exc:
                    # Original exception survived the transaction's successful
                    # rollback. A rollback/connection error replacing it is NOT
                    # evidence of rollback or permission for another dispatch.
                    rollback_confirmed = exc is statement_error
                    raise
                transaction_completed = True
            return result
        except Exception as exc:
            state = getattr(exc, "sqlstate", None)
            server_rejected = (type(state) is str and len(state) == 5
                               and not state.startswith("08") and state != "40003")
            # A later connection/pool cleanup exception cannot undo an already
            # completed transaction, even when that exception has a SQLSTATE.
            if dispatched and (transaction_completed or (not rollback_confirmed and not server_rejected)):
                raise GatewayIndeterminate("RESULT_INDETERMINATE") from None
            if isinstance(exc, GatewayDenied):
                raise
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
                note_id: str | None = None, payload: object = None,
                local_note_id: str | None = None) -> dict:
        owner, expiry = self._authenticate(token)
        cloud = action in CLOUD_ACTIONS.values()
        if (action not in {"reserve", "publish", "retire", *CLOUD_ACTIONS.values()}
                or type(operation_id) is not str or not operation_id.strip() or len(operation_id) > 200):
            raise GatewayDenied("INVALID_INTENT")
        if cloud:
            if type(local_note_id) is not str or not local_note_id.strip():
                raise GatewayDenied("INVALID_INTENT")
        elif local_note_id is not None:
            raise GatewayDenied("INVALID_INTENT")
        if action in {"reserve", "cloud_reserve", "cloud_read"}:
            if note_id is not None or payload is not None:
                raise GatewayDenied("INVALID_INTENT")
        elif type(note_id) is not str or not note_id.strip():
            raise GatewayDenied("INVALID_INTENT")
        if ((action == "publish" and not supported_snapshot(payload))
                or (action == "cloud_publish" and not cloud_snapshot_supported(payload))
                or (action not in {"publish", "cloud_publish"} and payload is not None)):
            raise GatewayDenied("INVALID_INTENT")
        intent = dict(owner=owner, action=action, operation_id=operation_id, note_id=note_id, payload=payload)
        if cloud:
            intent["local_note_id"] = local_note_id
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

    def apply(self, token: str, context: dict) -> str | dict:
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
        intent = context["intent"]
        if intent.get("action") == "cloud_read":
            return self._cloud_read_result(result, intent)
        if intent.get("action") in CLOUD_ACTIONS.values():
            allowed = {"cloud_publish": {"CREATED", "REPLAY_LIVE", "APPLIED_THEN_RETIRED"},
                       "cloud_retire": {"RETIRED", "ALREADY_RETIRED"}}
            try:
                valid = (str(UUID(result)) == result and UUID(result).int != 0
                         if intent["action"] == "cloud_reserve"
                         else result in allowed[intent["action"]])
            except (ValueError, TypeError, AttributeError):
                valid = False
            if not valid:
                raise GatewayIndeterminate("UNCONFIRMED_DATABASE_RESULT")
        if type(result) is not str or not result:
            raise GatewayIndeterminate("UNCONFIRMED_DATABASE_RESULT")
        return result

    def prepare_cloud_copy(self, token: str, action: str, operation_id: str, *,
                           local_note_id: str, cloud_id: str | None = None,
                           payload: object = None) -> dict:
        if action not in CLOUD_ACTIONS:
            raise GatewayDenied("INVALID_INTENT")
        return self.prepare(token, CLOUD_ACTIONS[action], operation_id,
                            local_note_id=local_note_id, note_id=cloud_id, payload=payload)

    def run_cloud_copy(self, token: str, action: str, operation_id: str, **kwargs) -> str | dict:
        # One explicit dispatch only. 'read' issues no lifecycle mutation, receipt,
        # or renewed mutation authority; it uses its own immutable read context.
        return self.apply(token, self.prepare_cloud_copy(token, action, operation_id, **kwargs))

    @staticmethod
    def _cloud_read_result(result: object, intent: dict) -> dict:
        try:
            value = json.loads(result) if type(result) is str else None
            if (type(value) is not dict or set(value) != {"account_id", "local_note_id", "cloud_note_id",
                    "state", "reserve_operation_id", "publication", "retire_operation_id"}
                    or value["account_id"] != intent["owner"]
                    or value["local_note_id"] != intent["local_note_id"]
                    or str(UUID(value["cloud_note_id"])) != value["cloud_note_id"]
                    or type(value["reserve_operation_id"]) is not str or not value["reserve_operation_id"]):
                raise ValueError()
            publication, retirement = value["publication"], value["retire_operation_id"]
            if publication is not None:
                if (type(publication) is not dict or set(publication) != {"operation_id", "payload", "digest"}
                        or type(publication["operation_id"]) is not str or not publication["operation_id"]
                        or not cloud_snapshot_supported(publication["payload"])
                        or re.fullmatch(r"[0-9a-f]{64}", publication["digest"]) is None):
                    raise ValueError()
            if ((value["state"] == "RESERVED" and (publication is not None or retirement is not None))
                    or (value["state"] == "LIVE" and (publication is None or retirement is not None))
                    or (value["state"] == "RETIRED" and (type(retirement) is not str or not retirement))
                    or value["state"] not in {"RESERVED", "LIVE", "RETIRED"}):
                raise ValueError()
            return value
        except (ValueError, TypeError, KeyError, AttributeError):
            raise GatewayIndeterminate("UNCONFIRMED_CLOUD_READBACK") from None

    def run(self, token: str, action: str, operation_id: str, **kwargs) -> str:
        # A retry reuses prepare's immutable account/operation context. Neither
        # this helper nor SQL refreshes an old operation to a newer generation.
        return self.apply(token, self.prepare(token, action, operation_id, **kwargs))
