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
from identity_candidates.notes_private_gateway import (
    AUDIENCE, GatewayDenied, GatewayIndeterminate, PrivateGateway, PsycopgCalls,
)

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


def test_cloud_copy_gateway_is_bound_only_to_the_default_off_route():
    import ast
    main_path = Path(__file__).parent/"main.py"
    main = main_path.read_text(encoding="utf-8")
    tree = ast.parse(main)

    # The feature remains opt-in even when the server has gateway settings.
    assert ('NOTES_CLOUD_COPY_ENABLED = os.getenv("NOTES_CLOUD_COPY_ENABLED", "disabled")'
            '.strip().lower() == "enabled"') in main

    functions = {
        node.name: node for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    factory = functions["_notes_cloud_copy_service"]
    routes = [functions["create_notes_cloud_copy"], functions["read_notes_cloud_copy_status"]]

    def is_gateway_import(node):
        if isinstance(node, ast.ImportFrom):
            return (node.module == "identity_candidates.notes_private_gateway"
                    or (node.module == "identity_candidates"
                        and any(name.name == "notes_private_gateway" for name in node.names)))
        return isinstance(node, ast.Import) and any(
            name.name == "identity_candidates.notes_private_gateway" for name in node.names
        )

    def assert_disabled_guard(function, flag="NOTES_CLOUD_COPY_ENABLED"):
        statements = function.body
        if (statements and isinstance(statements[0], ast.Expr)
                and isinstance(statements[0].value, ast.Constant)
                and isinstance(statements[0].value.value, str)):
            statements = statements[1:]
        guard = statements[0]
        assert isinstance(guard, ast.If)
        assert isinstance(guard.test, ast.UnaryOp) and isinstance(guard.test.op, ast.Not)
        assert isinstance(guard.test.operand, ast.Name)
        assert guard.test.operand.id == flag
        assert isinstance(guard.body[0], ast.Raise)
        assert ("NOTES_CLOUD_COPY_DISABLED" if flag == "NOTES_CLOUD_COPY_ENABLED"
                else "NOTES_LAPTOP_PUBLISH_DISABLED") in ast.unparse(guard.body[0])

    assert_disabled_guard(factory)
    for route in routes:
        assert_disabled_guard(route)

    laptop_factory = functions["_notes_laptop_publication_service"]
    assert_disabled_guard(laptop_factory, "NOTES_LAPTOP_PUBLISH_ENABLED")
    assert_disabled_guard(functions["_handle_laptop_publication"], "NOTES_LAPTOP_PUBLISH_ENABLED")
    factory_nodes = set(ast.walk(factory)) | set(ast.walk(laptop_factory))
    route_nodes = [set(ast.walk(route)) for route in routes]
    gateway_imports = [node for node in ast.walk(tree) if is_gateway_import(node)]
    driver_imports = [node for node in ast.walk(tree)
                      if (isinstance(node, ast.ImportFrom)
                          and (node.module == "psycopg" or node.module.startswith("psycopg.")))
                      or (isinstance(node, ast.Import)
                          and any(name.name == "psycopg" or name.name.startswith("psycopg.")
                                  for name in node.names))]
    assert len(gateway_imports) == 2 and all(node in factory_nodes for node in gateway_imports)
    assert len(driver_imports) == 4 and all(node in factory_nodes for node in driver_imports)
    for candidate_factory in (factory, laptop_factory):
        nodes = set(ast.walk(candidate_factory))
        assert sum(node in nodes for node in gateway_imports) == 1
        assert sum(node in nodes for node in driver_imports) == 2
    assert all(isinstance(node, ast.ImportFrom) for node in driver_imports)
    assert (isinstance(gateway_imports[0], ast.ImportFrom)
            and gateway_imports[0].module == "identity_candidates.notes_private_gateway"
            and [(name.name, name.asname) for name in gateway_imports[0].names]
            == [("PrivateGateway", None), ("PsycopgCalls", None)])
    assert {(node.module, tuple((name.name, name.asname) for name in node.names))
            for node in driver_imports} == {
                ("psycopg", (("connect", None),)),
                ("psycopg.conninfo", (("conninfo_to_dict", None),)),
            }

    for name in ("PrivateGateway", "PsycopgCalls", "connect", "conninfo_to_dict"):
        calls = [node for node in ast.walk(tree)
                 if isinstance(node, ast.Call)
                 and ((isinstance(node.func, ast.Name) and node.func.id == name)
                      or (isinstance(node.func, ast.Attribute) and node.func.attr == name))]
        assert calls and all(node in factory_nodes for node in calls), name
    service_factory_calls = [node for node in ast.walk(tree)
                             if isinstance(node, ast.Call)
                             and isinstance(node.func, ast.Name)
                             and node.func.id == "_notes_cloud_copy_service"]
    assert (len(service_factory_calls) == 2
            and all(any(call in route for route in route_nodes) for call in service_factory_calls)
            and all(call.func.id == "_notes_cloud_copy_service" for call in service_factory_calls))

    for path in Path(__file__).parent.glob("*.py"):
        if path.name.startswith("test_"):
            continue
        if path == main_path:
            continue
        module = ast.parse(path.read_text(encoding="utf-8"))
        if path.name in {"notes_cloud_copy_candidate.py", "notes_laptop_publication.py"}:
            candidate_gateway_imports = [node for node in ast.walk(module) if is_gateway_import(node)]
            assert (len(candidate_gateway_imports) == 1
                    and isinstance(candidate_gateway_imports[0], ast.ImportFrom)
                    and candidate_gateway_imports[0].module == "identity_candidates.notes_private_gateway"
                    and [(name.name, name.asname) for name in candidate_gateway_imports[0].names]
                    == [("GatewayDenied", None), ("GatewayIndeterminate", None),
                        ("cloud_snapshot_supported", None)])
            driver_imports = [node for node in ast.walk(module)
                              if (isinstance(node, ast.ImportFrom)
                                  and node.module.startswith("psycopg"))
                              or (isinstance(node, ast.Import)
                                  and any(name.name == "psycopg" or name.name.startswith("psycopg.")
                                          for name in node.names))]
            assert not driver_imports

            class ModuleCalls(ast.NodeVisitor):
                def __init__(self):
                    self.calls = []

                def visit_Call(self, node):
                    name = (node.func.id if isinstance(node.func, ast.Name)
                            else node.func.attr if isinstance(node.func, ast.Attribute) else None)
                    if name in {"PrivateGateway", "PsycopgCalls", "connect"}:
                        self.calls.append(node)
                    self.generic_visit(node)

                def visit_FunctionDef(self, node):
                    self._visit_header(node)

                def visit_AsyncFunctionDef(self, node):
                    self._visit_header(node)

                def visit_Lambda(self, node):
                    for value in node.args.defaults + [value for value in node.args.kw_defaults if value]:
                        self.visit(value)

                def _visit_header(self, node):
                    for value in node.decorator_list + node.args.defaults + [
                        value for value in node.args.kw_defaults if value
                    ]:
                        self.visit(value)

            module_calls = ModuleCalls()
            module_calls.visit(module)
            assert not module_calls.calls
        else:
            assert not any(is_gateway_import(node) for node in ast.walk(module)), path
    sql = (Path(__file__).parent/"identity_candidates"/"notes_identity_private_gateway.sql").read_text()
    assert "enabled boolean not null default false" in sql
    assert "create role" not in sql.lower()
    assert "grant execute" in sql.lower()
    assert "to authenticated" not in sql.lower() and "to service_role" not in sql.lower()


SNAPSHOT = dict(title="동명", body="원문 [[note:local-id|표시]]", updated_at=123, starred=False)


@pytest.mark.parametrize("action", ["reserve", "publish", "retire", "read"])
def test_cloud_intent_binds_verified_owner_exact_local_id_and_payload(action):
    g = gateway(enabled=True)
    cloud = str(uuid.uuid4()) if action in {"publish", "retire"} else None
    payload = SNAPSHOT.copy() if action == "publish" else None
    c = g.prepare_cloud_copy(token(), action, "cloud-op", local_note_id="local-id", cloud_id=cloud, payload=payload)
    doc = json.loads(g.calls.seen[0][1])
    assert doc["action"] == "cloud_" + action
    assert doc["local_note_id"] == "local-id" and doc["note_id"] == cloud
    assert doc["owner"] == OWNER_A and doc["payload"] == payload
    assert c["intent"] == {k:v for k,v in doc.items() if k not in {"aud", "expires"}}
    with pytest.raises(TypeError):
        g.prepare_cloud_copy(token(), action, "x", local_note_id="local-id", owner=OWNER_B)


@pytest.mark.parametrize("payload", [
    {}, dict(SNAPSHOT, properties={}), dict(SNAPSHOT, relations=[]), dict(SNAPSHOT, folder_id="folder"),
    dict(SNAPSHOT, attachments=[]), dict(SNAPSHOT, complete=False),
    *[dict(SNAPSHOT, body=body) for body in ("![original](https://example.test/a)",
       "[original](attachment://a)", "absinthe-resource://a", "data:image/png;base64,AA", "blob:a", "<img src='x'>")],
])
def test_cloud_unsupported_or_incomplete_content_is_not_dispatched(payload):
    g = gateway(enabled=True)
    before = json.dumps(payload, sort_keys=True)
    with pytest.raises(GatewayDenied, match="INVALID_INTENT"):
        g.prepare_cloud_copy(token(), "publish", "x", local_note_id="local", cloud_id=str(uuid.uuid4()), payload=payload)
    assert not g.calls.seen and json.dumps(payload, sort_keys=True) == before


@pytest.mark.parametrize("action,kwargs", [
    ("reserve", dict(cloud_id="old")), ("read", dict(payload=SNAPSHOT)),
    ("read", dict(cloud_id="old")), ("retire", dict(payload=SNAPSHOT)),
])
def test_cloud_read_and_reservation_never_accept_mutation_or_adoption_inputs(action, kwargs):
    g = gateway(enabled=True)
    with pytest.raises(GatewayDenied):
        g.prepare_cloud_copy(token(), action, "x", local_note_id="local", **kwargs)
    assert not g.calls.seen


def test_cloud_readback_must_confirm_exact_account_alias_state_receipt_and_snapshot():
    g = gateway(enabled=True)
    c = g.prepare_cloud_copy(token(), "read", "read-op", local_note_id="local-id")
    result = dict(account_id=OWNER_A, local_note_id="local-id", cloud_note_id=str(uuid.uuid4()),
                  state="LIVE", reserve_operation_id="reserve-op", retire_operation_id=None,
                  publication=dict(operation_id="publish-op", payload=SNAPSHOT, digest="a"*64))
    g.calls.call = lambda *args: json.dumps(result)
    assert g.apply(token(), c) == result
    for change in (dict(account_id=OWNER_B), dict(local_note_id="another"), dict(publication=None),
                   dict(retire_operation_id="retired"), dict(state="UNKNOWN")):
        g.calls.call = lambda *args, change=change: json.dumps(dict(result, **change))
        with pytest.raises(GatewayIndeterminate, match="UNCONFIRMED_CLOUD_READBACK"):
            g.apply(token(), c)


@pytest.mark.parametrize("stage", ["before_dispatch", "server_rollback", "unknown_commit", "after_commit", "after_commit_sqlstate"])
def test_cloud_transport_distinguishes_rollback_from_indeterminate_without_retry(stage):
    counts = []
    class SqlError(Exception):
        sqlstate = "23514"
    class Connection:
        info = SimpleNamespace(transaction_status=0)
        @contextmanager
        def transaction(self):
            yield
            if stage == "unknown_commit":
                raise ConnectionError("synthetic ambiguous commit")
        def execute(self, *args):
            counts.append("dispatch")
            if stage == "server_rollback":
                raise SqlError("synthetic rollback")
            return SimpleNamespace(fetchone=lambda: ("CREATED",))
    @contextmanager
    def connect():
        if stage == "before_dispatch":
            raise ConnectionError("synthetic connect failure")
        yield Connection()
        if stage == "after_commit":
            raise ConnectionError("synthetic loss after commit")
        if stage == "after_commit_sqlstate":
            raise SqlError("synthetic cleanup error after successful commit")
    uncertain = stage in {"unknown_commit", "after_commit", "after_commit_sqlstate"}
    expected = GatewayIndeterminate if uncertain else GatewayDenied
    with pytest.raises(expected) as caught:
        PsycopgCalls(connect).call("apply", "synthetic", b"mac")
    assert isinstance(caught.value, GatewayIndeterminate) == uncertain
    assert counts == ([] if stage == "before_dispatch" else ["dispatch"])
