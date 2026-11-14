"""Synthetic HTTP/INSERT contract. No production client or credentials used."""
import copy
import json
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
import main
from test_notes_identity_postgres import db as proof_db, OWNER_A, OWNER_B, quote, _run, command
from concurrent.futures import ThreadPoolExecutor
import uuid
from notes_initial_publication import InitialPublicationService, POLICY, AUTHORITY
from notes_laptop_publication import LaptopPublicationError

SNAPSHOT = dict(title="한글 / 日本語", body="Original\n\ntext", updated_at=12, starred=True)


def payload(**changes):
    return main.NotesInitialPublicationRequest.model_validate(dict(
        noteId="laptop-id", policy=POLICY, snapshot=SNAPSHOT.copy(), knownDeletedIds=[], **changes))


def harness(handler=None):
    seen = []
    row = dict(id="laptop-id", user_id="A", **SNAPSHOT, folder_id=None, deleted_at=None)
    def respond(request):
        seen.append(request)
        return handler(request, row) if handler else httpx.Response(201 if request.method == "POST" else 200, json=[row])
    transport = httpx.MockTransport(respond)
    verifier = SimpleNamespace(verify_token=lambda token: "A" if token == "token-A" else "B")
    service = InitialPublicationService("https://synthetic.invalid", "synthetic-key", verifier, "A",
        lambda **kwargs: httpx.Client(transport=transport, **kwargs))
    return service, seen


def test_one_insert_then_separate_account_scoped_readback_preserves_original():
    service, seen = harness()
    request = payload()
    before = copy.deepcopy(request.model_dump())
    assert service.request("token-A", "A", request) == dict(status="VERIFIED", noteId="laptop-id", policy=POLICY)
    assert [r.method for r in seen] == ["POST", "GET"]
    assert seen[0].headers["prefer"] == "return=representation"
    assert all(r.headers["authorization"] == "Bearer token-A" for r in seen)
    assert seen[1].url.params["user_id"] == "eq.A"
    assert seen[1].url.params["id"] == "eq.laptop-id"
    assert json.loads(seen[0].content) == dict(id="laptop-id", user_id="A", **SNAPSHOT, folder_id=None, deleted_at=None)
    assert request.model_dump() == before


@pytest.mark.parametrize("change", [dict(body="changed"), dict(user_id="B"), dict(id="other"),
    dict(starred=1), dict(deleted_at=5), dict(properties={"x":"y"}), dict(relations={"x":["y"]})])
def test_unconfirmed_or_changed_readback_never_verifies(change):
    service, seen = harness(lambda req, row: httpx.Response(201 if req.method == "POST" else 200,
        json=[row if req.method == "POST" else row | change]))
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        service.request("token-A", "A", payload())
    assert len(seen) == 2


@pytest.mark.parametrize("status,body", [(409, {"code":"23505"}), (503, {}), (201, []), (201, None)])
def test_collision_or_ambiguous_insert_is_not_retried(status, body):
    service, seen = harness(lambda req, row: httpx.Response(status, json=body))
    with pytest.raises(LaptopPublicationError) as error:
        service.request("token-A", "A", payload())
    assert error.value.code == ("INITIAL_PUBLICATION_CONFLICT" if status == 409 else "INITIAL_PUBLICATION_INDETERMINATE")
    assert len(seen) == 1


def test_lost_completion_no_retry_manual_status_only_reads():
    def lost(req, row):
        if req.method == "POST":
            raise httpx.ReadTimeout("synthetic lost completion")
        return httpx.Response(200, json=[row])
    service, seen = harness(lost)
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        service.request("token-A", "A", payload())
    assert service.request("token-A", "A", payload(), read_only=True)["status"] == "VERIFIED"
    assert [r.method for r in seen] == ["POST", "GET"]


def test_authentication_replacement_after_insert_suppresses_verified_readback():
    service, seen = harness()
    service.verifier.verify_token = lambda token: "A" if not seen else "B"
    with pytest.raises(LaptopPublicationError, match="INDETERMINATE"):
        service.request("token-A", "A", payload())
    assert [r.method for r in seen] == ["POST"]


def test_repeat_publication_conflicts_instead_of_updating_existing_content():
    inserted = []
    def once(req, row):
        if req.method == "POST":
            if inserted:
                return httpx.Response(409, json={"code": "23505"})
            inserted.append(json.loads(req.content))
        return httpx.Response(201 if req.method == "POST" else 200, json=[row])
    service, seen = harness(once)
    assert service.request("token-A", "A", payload())["status"] == "VERIFIED"
    with pytest.raises(LaptopPublicationError, match="CONFLICT"):
        service.request("token-A", "A", payload())
    assert len(inserted) == 1 and [r.method for r in seen] == ["POST", "GET", "POST"]


@pytest.mark.parametrize("kind", ["deleted", "policy", "account", "token", "attachments", "relations", "folder"])
def test_denied_before_any_write(kind):
    service, seen = harness()
    request = payload()
    owner, token = "A", "token-A"
    if kind == "deleted": request.knownDeletedIds = [request.noteId]
    if kind == "policy": request.policy = "unacknowledged"
    if kind == "account": owner = "B"
    if kind == "token": token = "token-B"
    if kind == "attachments": request.snapshot["body"] = "![x](attachment:original)"
    if kind == "relations": request.snapshot["relations"] = {"x":["id"]}
    if kind == "folder": request.snapshot["folder_id"] = "folder"
    with pytest.raises(LaptopPublicationError): service.request(token, owner, request)
    assert not seen


@pytest.mark.parametrize("mode", ["", "/status"])
def test_http_default_off_and_operator_prerequisites(monkeypatch, mode):
    main.app.dependency_overrides[main.get_remote_mutation_user] = lambda: "A"
    try:
        monkeypatch.delenv("NOTES_INITIAL_PUBLISH_ENABLED", raising=False)
        client = TestClient(main.app)
        assert client.post("/api/notes/initial-publication"+mode, headers={"Authorization":"Bearer token-A"}, json={}).status_code == 423
        monkeypatch.setenv("NOTES_INITIAL_PUBLISH_ENABLED", "enabled")
        assert client.post("/api/notes/initial-publication"+mode, headers={"Authorization":"Bearer token-A"}, json={}).status_code == 503
        monkeypatch.setenv("NOTES_INITIAL_PUBLISH_ACCOUNT_ID", "A")
        monkeypatch.setenv("NOTES_INITIAL_PUBLISH_AUTHORITY", AUTHORITY)
        assert main._notes_initial_publication_service().account == "A"
        service, seen = harness()
        monkeypatch.setattr(main, "_notes_initial_publication_service", lambda: service)
        request = payload().model_dump()
        assert client.post("/api/notes/initial-publication"+mode, headers={"Authorization":"Bearer token-A"}, json=request).status_code == 200
        assert [r.method for r in seen] == (["GET"] if mode else ["POST","GET"])
        assert client.post("/api/notes/initial-publication"+mode, headers={"Authorization":"Bearer token-A"}, json=request | {"user_id":"B"}).status_code == 400
    finally:
        main.app.dependency_overrides.clear()


@pytest.fixture(scope="module")
def initial_db(proof_db):
    # Disposable model of existing public Notes PK + account RLS, not a migration.
    proof_db.sql(f"""create table public.notes(id text primary key,user_id uuid not null,
      title text not null,body text not null,updated_at bigint not null,
      starred boolean not null,folder_id text,deleted_at bigint);
      alter table public.notes enable row level security;
      grant select,insert on public.notes to proof_a,proof_b;
      create policy owner_only on public.notes for all to proof_a,proof_b
      using (user_id=case current_user when 'proof_a' then '{OWNER_A}'::uuid else '{OWNER_B}'::uuid end)
      with check (user_id=case current_user when 'proof_a' then '{OWNER_A}'::uuid else '{OWNER_B}'::uuid end);""")
    return proof_db


def insert_sql(key, owner=OWNER_A, deleted="null"):
    return (f"insert into public.notes(id,user_id,title,body,updated_at,starred,folder_id,deleted_at)"
            f" values({quote(key)},'{owner}',{quote(SNAPSHOT['title'])},{quote(SNAPSHOT['body'])},12,true,null,{deleted});")


@pytest.mark.parametrize("owner,deleted", [(OWNER_A, "null"), (OWNER_B, "null"), (OWNER_A, "7")])
def test_postgres_existing_same_foreign_and_tombstoned_ids_reject_atomically(initial_db, owner, deleted):
    key = uuid.uuid4().hex
    initial_db.sql(insert_sql(key, owner, deleted))
    initial_db.sql(insert_sql(key), "proof_a", error="23505")
    assert initial_db.sql(f"select count(*) from public.notes where id={quote(key)};") == "1"
    assert initial_db.sql(f"select user_id::text from public.notes where id={quote(key)};") == owner


def test_postgres_concurrent_insert_has_one_winner_and_no_overwrite(initial_db):
    key = uuid.uuid4().hex
    def create(_):
        return _run(command(initial_db.docker, initial_db.name, "proof_a") + ["-c", insert_sql(key)], timeout=20, encoding="utf-8")
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(create, [1, 2]))
    assert sum(result.returncode == 0 for result in outcomes) == 1
    assert all(result.returncode == 0 or "23505" in result.stderr for result in outcomes)
    assert initial_db.sql(f"select count(*) from public.notes where id={quote(key)};") == "1"
    actual = json.loads(initial_db.sql(f"select row_to_json(n) from public.notes n where id={quote(key)};", "proof_a"))
    assert {k: actual[k] for k in SNAPSHOT} == SNAPSHOT


def test_postgres_account_rls_denies_foreign_insert_and_read(initial_db):
    key = uuid.uuid4().hex
    initial_db.sql(insert_sql(key, OWNER_B), "proof_a", error="42501")
    initial_db.sql(insert_sql(key, OWNER_B), "proof_b")
    assert initial_db.sql(f"select count(*) from public.notes where id={quote(key)};", "proof_a") == "0"
