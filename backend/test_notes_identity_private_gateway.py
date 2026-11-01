"""Unit checks only. Fake calls/driver below are NOT PostgreSQL authority proof."""
from contextlib import contextmanager
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import time
from types import SimpleNamespace
import uuid

import jwt
import pytest

from auth import SupabaseJWTVerifier
from identity_candidates.notes_private_gateway import AUDIENCE, GatewayDenied, PrivateGateway, PsycopgCalls

OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"
JWT_SECRET = "synthetic-jwt-signing-key-at-least-32-bytes"


def token(owner=OWNER_A, **claims):
    payload = dict(sub=owner, exp=int(time.time())+300, iss="https://example.supabase.co/auth/v1",
                   aud="authenticated", role="authenticated")
    payload.update(claims)
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verifier():
    return SupabaseJWTVerifier("https://example.supabase.co", JWT_SECRET)


class Calls:
    def __init__(self):
        self.seen = []

    def call(self, name, text, mac):
        self.seen.append((name, text, mac))
        doc = json.loads(text)
        if name == "prepare":
            return dict(context_id=str(uuid.uuid4()), generation=1, expires=doc["expires"],
                        intent={k:v for k,v in doc.items() if k not in {"aud", "expires"}})
        return "CREATED"


def gateway(calls=None, **kwargs):
    return PrivateGateway(verifier(), calls or Calls(), secrets.token_bytes(32), **kwargs)


def test_default_off_and_separate_signing_key():
    g = gateway()
    with pytest.raises(GatewayDenied, match="NOT_ACTIVATED"):
        g.prepare(token(), "reserve", "operation")
    assert not g.calls.seen
    with pytest.raises(GatewayDenied, match="SEPARATE_SIGNING_KEY"):
        PrivateGateway(verifier(), Calls(), JWT_SECRET.encode())


@pytest.mark.parametrize("value", ["", "malformed", token(exp=1), token(sub="not-a-uuid"),
                                     token(role="service_role"), token(aud="foreign")])
def test_bad_authentication_never_dispatches(value):
    g = gateway(enabled=True)
    with pytest.raises(GatewayDenied, match="AUTHENTICATION_DENIED"):
        g.prepare(value, "reserve", "operation")
    assert not g.calls.seen


def test_owner_is_verified_subject_and_assertion_binds_exact_intent():
    g = gateway(enabled=True)
    c = g.prepare(token(), "reserve", "operation")
    name, text, mac = g.calls.seen[0]
    doc = json.loads(text)
    assert name == "prepare" and doc["owner"] == OWNER_A
    assert doc["aud"] == AUDIENCE+".prepare"
    assert set(doc) == {"aud", "expires", "owner", "action", "operation_id", "note_id", "payload"}
    assert hmac.compare_digest(mac, hmac.new(g.signing_key, text.encode(), hashlib.sha256).digest())
    assert c["intent"]["owner"] == OWNER_A
    with pytest.raises(TypeError):
        g.prepare(token(), "reserve", "x", owner=OWNER_B)
    with pytest.raises(TypeError):
        g.prepare(token(), "reserve", "x", generation=3)


def test_shared_signer_has_no_current_user_state_and_denies_foreign_context():
    g = gateway(enabled=True)
    a = g.prepare(token(), "reserve", "a")
    b = g.prepare(token(OWNER_B), "reserve", "b")
    before = len(g.calls.seen)
    with pytest.raises(GatewayDenied, match="CONTEXT_ACCOUNT_MISMATCH"):
        g.apply(token(OWNER_B), a)
    assert len(g.calls.seen) == before
    assert g.apply(token(), a) == g.apply(token(OWNER_B), b) == g.apply(token(), a) == "CREATED"


@pytest.mark.parametrize("kwargs", [
    dict(note_id="existing"), dict(payload={}), dict(provenance="trusted"),
])
def test_reservation_never_adopts_existing_identity(kwargs):
    g = gateway(enabled=True)
    with pytest.raises((GatewayDenied, TypeError)):
        g.prepare(token(), "reserve", "x", **kwargs)
    assert not g.calls.seen


def test_context_expiry_and_malformed_database_context_fail_closed():
    g = gateway(enabled=True)
    c = g.prepare(token(), "reserve", "a")
    c["expires"] = 1
    before = len(g.calls.seen)
    with pytest.raises(GatewayDenied, match="AUTHORITY_EXPIRED"):
        g.apply(token(), c)
    assert len(g.calls.seen) == before
    g.calls.call = lambda *args: {"generation": 1}
    with pytest.raises(GatewayDenied, match="UNCONFIRMED_DATABASE_CONTEXT"):
        g.prepare(token(), "reserve", "b")


@pytest.mark.parametrize("failure", ["commit", "connection_exit", "query", "not_idle"])
def test_driver_does_not_acknowledge_before_successful_commit(failure):
    class Connection:
        info = SimpleNamespace(transaction_status=1 if failure == "not_idle" else 0)

        @contextmanager
        def transaction(self):
            yield
            if failure == "commit":
                raise RuntimeError("synthetic commit failure")

        def execute(self, query, params):
            assert query == "select notes_identity_candidate.private_apply(%s, %s)"
            assert params == ("signed synthetic envelope", b"synthetic-mac")
            if failure == "query":
                raise RuntimeError("synthetic query failure")
            return SimpleNamespace(fetchone=lambda: ("CREATED",))

    @contextmanager
    def connect():
        yield Connection()
        if failure == "connection_exit":
            raise RuntimeError("synthetic connection failure")

    with pytest.raises(GatewayDenied):
        PsycopgCalls(connect).call("apply", "signed synthetic envelope", b"synthetic-mac")


def test_production_routes_remain_disconnected():
    main = (Path(__file__).parent/"main.py").read_text(encoding="utf-8")
    assert "notes_private_gateway" not in main
    import ast
    for path in Path(__file__).parent.glob("*.py"):
        if path.name.startswith("test_"):
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.ImportFrom):
                assert node.module != "identity_candidates.notes_private_gateway", path
            elif isinstance(node, ast.Import):
                assert all(n.name != "identity_candidates.notes_private_gateway" for n in node.names), path
    sql = (Path(__file__).parent/"identity_candidates"/"notes_identity_private_gateway.sql").read_text()
    assert "enabled boolean not null default false" in sql
    assert "create role" not in sql.lower()
    assert "grant execute" in sql.lower()
    assert "to authenticated" not in sql.lower() and "to service_role" not in sql.lower()
