from __future__ import annotations

import copy
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from pydantic import ValidationError

from remote_mutation import (
    ApplyRemoteMutationRequest,
    RemoteMutationService,
    RemoteMutationTransportError,
    derive_idempotency_key,
    derive_request_digest,
)

OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"
ENTITY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ENTITY_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
NAMESPACE = "1" * 64
PROJECT = "project-test"
GENERATION = "generation-1"


def request_payload(
    *,
    entity_id: str = ENTITY,
    mutation_id: str = "mut.00000000-0000-4000-8000-000000000001",
    operation: str = "upsert",
    base_revision: int | None = None,
    local_revision: int = 1,
    title: str = "synthetic",
    generation_id: str = GENERATION,
    namespace_fingerprint: str = NAMESPACE,
) -> dict:
    payload = (
        {
            "kind": "entity_snapshot",
            "record": {
                "id": entity_id, "title": title, "body": "synthetic body",
                "createdAt": 1, "lastOpenedAt": None, "updatedAt": local_revision,
                "folderId": None, "deletedAt": None, "starred": False,
                "properties": {"Type": "Test"}, "relations": {},
            },
        }
        if operation == "upsert"
        else {
            "kind": "tombstone", "entityId": entity_id,
            "deletedAt": "2026-07-12T00:00:00Z", "revision": local_revision,
        }
    )
    raw = {
        "protocolVersion": 1, "mutationId": mutation_id,
        "idempotencyKey": "k322." + "0" * 64,
        "namespaceFingerprint": namespace_fingerprint, "generationId": generation_id,
        "domain": "notes", "entityId": entity_id, "operation": operation,
        "baseRevision": base_revision, "localRevision": local_revision,
        "payload": payload, "createdAt": "2026-07-12T00:00:00Z",
    }
    parsed = ApplyRemoteMutationRequest.model_validate(raw)
    raw["idempotencyKey"] = derive_idempotency_key(parsed)
    return raw


class InMemoryTransactionalGateway:
    """Synthetic transaction model used only to exercise the Python/RPC contract."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.generations = {(OWNER_A, PROJECT, NAMESPACE, GENERATION): "active"}
        self.entities: dict[str, dict] = {}
        self.by_idempotency: dict[tuple[str, str, str], dict] = {}
        self.by_mutation: dict[tuple[str, str, str], dict] = {}
        self.entity_write_count = 0
        self.fail_before_receipt = False

    @staticmethod
    def response(parameters: dict, *, outcome: str, error: str | None, revision: int | None, ref: str | None) -> dict:
        return {
            "protocolVersion": 1, "outcome": outcome,
            "mutationId": parameters["p_mutation_id"], "idempotencyKey": parameters["p_idempotency_key"],
            "remoteMutationRef": ref, "appliedRevision": revision,
            "serverCommittedAt": "2026-07-12T00:00:01Z" if revision is not None else None,
            "errorCode": error, "retryable": False,
        }

    def record(self, parameters: dict, response: dict) -> None:
        receipt = {
            "mutation": parameters["p_mutation_id"], "idempotency": parameters["p_idempotency_key"],
            "digest": parameters["p_request_digest"], "response": copy.deepcopy(response),
        }
        self.by_idempotency[(parameters["p_authenticated_owner_id"], parameters["p_project_scope"], parameters["p_idempotency_key"])] = receipt
        self.by_mutation[(parameters["p_authenticated_owner_id"], parameters["p_project_scope"], parameters["p_mutation_id"])] = receipt

    def apply(self, p: dict) -> dict:
        with self.lock:
            owner_scope = (p["p_authenticated_owner_id"], p["p_project_scope"])
            idem = self.by_idempotency.get((*owner_scope, p["p_idempotency_key"]))
            if idem:
                if idem["mutation"] == p["p_mutation_id"] and idem["digest"] == p["p_request_digest"]:
                    return copy.deepcopy(idem["response"])
                return self.response(p, outcome="rejected", error="IDEMPOTENCY_CONFLICT", revision=None, ref=None)
            mutation = self.by_mutation.get((*owner_scope, p["p_mutation_id"]))
            if mutation:
                return self.response(p, outcome="rejected", error="MUTATION_ID_CONFLICT", revision=None, ref=None)
            generation = self.generations.get((p["p_authenticated_owner_id"], p["p_project_scope"], p["p_namespace_fingerprint"], p["p_generation_id"]))
            if generation is None:
                response = self.response(p, outcome="rejected", error="UNKNOWN_GENERATION", revision=None, ref=None)
                self.record(p, response); return response
            if generation != "active":
                response = self.response(p, outcome="rejected", error="STALE_GENERATION", revision=None, ref=None)
                self.record(p, response); return response
            existing = self.entities.get(p["p_entity_id"])
            if existing and existing["owner"] != p["p_authenticated_owner_id"]:
                return self.response(p, outcome="rejected", error="REMOTE_ENTITY_NOT_FOUND", revision=None, ref=None)
            error = None
            if p["p_base_revision"] is None:
                if existing: error = "REMOTE_ENTITY_ALREADY_EXISTS"
            elif not existing:
                error = "REMOTE_ENTITY_NOT_FOUND"
            elif existing["namespace"] != p["p_namespace_fingerprint"] or existing["generation"] != p["p_generation_id"]:
                error = "STALE_GENERATION"
            elif existing["deleted"]:
                error = "REMOTE_ENTITY_TOMBSTONED"
            elif existing["revision"] != p["p_base_revision"]:
                error = "REMOTE_REVISION_CONFLICT"
            if error:
                response = self.response(
                    p, outcome="revision_conflict" if error == "REMOTE_REVISION_CONFLICT" else "rejected",
                    error=error, revision=None, ref=None,
                )
                self.record(p, response); return response
            snapshot = copy.deepcopy(self.entities)
            writes = self.entity_write_count
            remote_ref = str(uuid.uuid4())
            self.entities[p["p_entity_id"]] = {
                "owner": p["p_authenticated_owner_id"], "namespace": p["p_namespace_fingerprint"],
                "generation": p["p_generation_id"],
                "revision": p["p_local_revision"], "deleted": p["p_operation"] == "tombstone",
                "payload_digest": p["p_payload_digest"], "remote_ref": remote_ref,
            }
            self.entity_write_count += 1
            if self.fail_before_receipt:
                self.entities = snapshot; self.entity_write_count = writes
                raise RuntimeError("synthetic_transaction_abort")
            response = self.response(p, outcome="applied", error=None, revision=p["p_local_revision"], ref=remote_ref)
            self.record(p, response)
            return response


@pytest.fixture
def gateway() -> InMemoryTransactionalGateway:
    return InMemoryTransactionalGateway()


@pytest.fixture
def service(gateway: InMemoryTransactionalGateway) -> RemoteMutationService:
    return RemoteMutationService(gateway, PROJECT)


def parse(service: RemoteMutationService, **kwargs) -> ApplyRemoteMutationRequest:
    return service.parse(request_payload(**kwargs))


def test_valid_create_update_and_tombstone(service: RemoteMutationService) -> None:
    create = service.apply(parse(service), OWNER_A)
    assert create.outcome == "applied" and create.applied_revision == 1
    update = service.apply(parse(
        service, mutation_id="mut.00000000-0000-4000-8000-000000000002",
        base_revision=1, local_revision=2, title="updated",
    ), OWNER_A)
    assert update.outcome == "applied" and update.applied_revision == 2
    tombstone = service.apply(parse(
        service, mutation_id="mut.00000000-0000-4000-8000-000000000003",
        operation="tombstone", base_revision=2, local_revision=3,
    ), OWNER_A)
    assert tombstone.outcome == "applied" and tombstone.applied_revision == 3


@pytest.mark.parametrize("change", [
    {"protocolVersion": 2}, {"operation": "purge_request"}, {"domain": "recipes"},
    {"baseRevision": None, "localRevision": 2}, {"createdAt": "not-a-time"},
    {"localRevision": 9_007_199_254_740_992}, {"localRevision": 1.0}, {"unexpected": True},
])
def test_invalid_envelopes_fail(change: dict) -> None:
    raw = request_payload(); raw.update(change)
    with pytest.raises((ValidationError, ValueError)):
        ApplyRemoteMutationRequest.model_validate(raw)


def test_malformed_and_oversized_payloads_fail() -> None:
    malformed = request_payload(); malformed["payload"] = {"kind": "entity_snapshot", "record": {}}
    with pytest.raises(ValidationError): ApplyRemoteMutationRequest.model_validate(malformed)
    oversized = request_payload(); oversized["payload"]["record"]["body"] = "x" * 120_001
    with pytest.raises(ValidationError): ApplyRemoteMutationRequest.model_validate(oversized)
    mismatch = request_payload(operation="tombstone", base_revision=1, local_revision=2)
    mismatch["payload"]["entityId"] = ENTITY_2
    with pytest.raises(ValidationError): ApplyRemoteMutationRequest.model_validate(mismatch)


def test_idempotency_key_mismatch_rejected_before_gateway(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    raw = request_payload(); raw["idempotencyKey"] = "k322." + "f" * 64
    response = service.apply(service.parse(raw), OWNER_A)
    assert response.error_code == "IDEMPOTENCY_KEY_MISMATCH"
    assert gateway.entity_write_count == 0


def test_exact_retry_is_stable_and_not_reapplied(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    request = parse(service)
    first = service.apply(request, OWNER_A)
    second = service.apply(request, OWNER_A)
    assert second == first
    assert gateway.entity_write_count == 1


def test_idempotency_and_mutation_conflicts(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    original = request_payload(); service.apply(service.parse(original), OWNER_A)
    different_payload = copy.deepcopy(original); different_payload["payload"]["record"]["title"] = "conflict"
    assert service.apply(service.parse(different_payload), OWNER_A).error_code == "IDEMPOTENCY_CONFLICT"
    reused_mutation = request_payload(entity_id=ENTITY_2)
    reused_mutation["mutationId"] = original["mutationId"]
    parsed = ApplyRemoteMutationRequest.model_validate(reused_mutation)
    reused_mutation["idempotencyKey"] = derive_idempotency_key(parsed)
    assert service.apply(service.parse(reused_mutation), OWNER_A).error_code == "MUTATION_ID_CONFLICT"
    assert gateway.entity_write_count == 1


def test_concurrent_duplicates_converge(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    request = parse(service)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: service.apply(request, OWNER_A), range(2)))
    assert results[0] == results[1]
    assert gateway.entity_write_count == 1


def test_concurrent_same_base_allows_one(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    service.apply(parse(service), OWNER_A)
    left = parse(service, mutation_id="mut.00000000-0000-4000-8000-000000000002", base_revision=1, local_revision=2, title="left")
    right = parse(service, mutation_id="mut.00000000-0000-4000-8000-000000000003", base_revision=1, local_revision=2, title="right")
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda item: service.apply(item, OWNER_A), [left, right]))
    assert sorted(result.outcome for result in results) == ["applied", "rejected"]
    assert sorted(result.error_code or "" for result in results) == ["", "IDEMPOTENCY_CONFLICT"]
    assert gateway.entity_write_count == 2


def test_concurrent_conflicting_idempotency_allows_one(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    left = parse(service, title="left")
    right = parse(
        service, mutation_id="mut.00000000-0000-4000-8000-000000000002", title="right",
    )
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda item: service.apply(item, OWNER_A), [left, right]))
    assert sorted(result.outcome for result in results) == ["applied", "rejected"]
    assert sorted(result.error_code or "" for result in results) == ["", "IDEMPOTENCY_CONFLICT"]
    assert gateway.entity_write_count == 1


def test_concurrent_mutation_id_reuse_allows_one(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    left = parse(service)
    raw = request_payload(entity_id=ENTITY_2)
    raw["mutationId"] = left.mutation_id
    parsed = ApplyRemoteMutationRequest.model_validate(raw)
    raw["idempotencyKey"] = derive_idempotency_key(parsed)
    right = service.parse(raw)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda item: service.apply(item, OWNER_A), [left, right]))
    assert sorted(result.outcome for result in results) == ["applied", "rejected"]
    assert sorted(result.error_code or "" for result in results) == ["", "MUTATION_ID_CONFLICT"]
    assert gateway.entity_write_count == 1


def test_revision_generation_and_ownership_fences(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    assert service.apply(parse(service, generation_id="unknown"), OWNER_A).error_code == "UNKNOWN_GENERATION"
    gateway.generations[(OWNER_A, PROJECT, NAMESPACE, "stale")] = "stale"
    assert service.apply(parse(
        service, mutation_id="mut.00000000-0000-4000-8000-000000000002", generation_id="stale",
    ), OWNER_A).error_code == "STALE_GENERATION"
    service.apply(parse(service, mutation_id="mut.00000000-0000-4000-8000-000000000003"), OWNER_A)
    other = RemoteMutationService(gateway, PROJECT)
    gateway.generations[(OWNER_B, PROJECT, NAMESPACE, GENERATION)] = "active"
    hidden = other.apply(parse(other,
        mutation_id="mut.00000000-0000-4000-8000-000000000004",
        base_revision=1, local_revision=2,
    ), OWNER_B)
    assert hidden.error_code == "REMOTE_ENTITY_NOT_FOUND"


def test_cross_namespace_revision_continuation_is_rejected(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    service.apply(parse(service), OWNER_A)
    other_namespace = "2" * 64
    gateway.generations[(OWNER_A, PROJECT, other_namespace, GENERATION)] = "active"
    request = parse(
        service, mutation_id="mut.00000000-0000-4000-8000-000000000002",
        base_revision=1, local_revision=2, namespace_fingerprint=other_namespace,
    )
    assert service.apply(request, OWNER_A).error_code == "STALE_GENERATION"


def test_transaction_abort_rolls_back_entity_and_receipt(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    gateway.fail_before_receipt = True
    with pytest.raises(RemoteMutationTransportError) as error:
        service.apply(parse(service), OWNER_A)
    assert error.value.response.error_code == "TRANSACTION_FAILED"
    assert gateway.entities == {} and gateway.by_idempotency == {} and gateway.entity_write_count == 0


def test_request_digest_normalizes_object_key_order(service: RemoteMutationService) -> None:
    left = parse(service)
    raw = request_payload(); raw["payload"]["record"]["properties"] = {"b": "2", "a": "1"}
    right_raw = copy.deepcopy(raw); right_raw["payload"]["record"]["properties"] = {"a": "1", "b": "2"}
    right = service.parse(right_raw)
    left_raw = copy.deepcopy(raw); left_raw["payload"]["record"]["properties"] = {"b": "2", "a": "1"}
    left_ordered = service.parse(left_raw)
    assert derive_request_digest(left_ordered, OWNER_A, PROJECT) == derive_request_digest(right, OWNER_A, PROJECT)
    assert derive_request_digest(left, OWNER_A, PROJECT) != derive_request_digest(right, OWNER_A, PROJECT)


def test_migration_contains_atomic_security_contract() -> None:
    sql = (Path(__file__).parent / "migrations" / "202607120001_k323_idempotent_remote_mutation.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert lowered.startswith("begin;") and lowered.rstrip().endswith("commit;")
    assert "pg_advisory_xact_lock" in lowered and "for update" in lowered
    assert "remote_mutation_receipts_immutable" in lowered
    assert "enable row level security" in lowered
    assert "to service_role" in lowered
    assert "from public, anon, authenticated" in lowered
    assert "delete from public.notes" not in lowered
    assert "drop table" not in lowered and "truncate" not in lowered
    receipt_definition = lowered.split("create table if not exists public.remote_mutation_receipts", 1)[1].split("create index", 1)[0]
    assert "p_payload" not in receipt_definition and "payload_digest" in receipt_definition


def test_frontend_server_golden_vectors() -> None:
    fixture = json.loads((Path(__file__).parent.parent / "protocol" / "k323-idempotency-vectors.json").read_text(encoding="utf-8"))
    assert fixture["version"] == 1
    for vector in fixture["vectors"]:
        raw = request_payload(
            operation=vector["operation"],
            base_revision=None if vector["localRevision"] == 1 else vector["localRevision"] - 1,
            local_revision=vector["localRevision"],
        )
        raw.update({
            "namespaceFingerprint": vector["namespaceFingerprint"],
            "generationId": vector["generationId"], "domain": vector["domain"],
            "entityId": vector["entityId"],
        })
        if vector["operation"] == "upsert": raw["payload"]["record"]["id"] = vector["entityId"]
        else: raw["payload"]["entityId"] = vector["entityId"]
        parsed = ApplyRemoteMutationRequest.model_validate(raw)
        assert derive_idempotency_key(parsed) == vector["expected"]


def test_error_and_receipt_data_do_not_contain_note_content(service: RemoteMutationService, gateway: InMemoryTransactionalGateway) -> None:
    raw = request_payload(title="private-title")
    response = service.apply(service.parse(raw), OWNER_A)
    rendered = json.dumps(response.model_dump(by_alias=True))
    receipts = json.dumps(list(gateway.by_idempotency.values()))
    assert "private-title" not in rendered and "synthetic body" not in rendered
    assert "private-title" not in receipts and "synthetic body" not in receipts
