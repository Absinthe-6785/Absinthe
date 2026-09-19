from __future__ import annotations

import copy
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from pydantic import ValidationError

from remote_mutation_v2 import (
    ApplyRemoteMutationV2Request,
    PullChangesV2Request,
    RemoteMutationV2Service,
    RemoteMutationV2TransportError,
    derive_v2_idempotency_key,
    derive_v2_mutation_id,
    derive_v2_request_digest,
    payload_hash,
)

OWNER_A = "11111111-1111-4111-8111-111111111111"
OWNER_B = "22222222-2222-4222-8222-222222222222"
ENTITY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ENTITY_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
NAMESPACE = "1" * 64
PROJECT = "project-test"
GENERATION = "generation-1"
EPOCH_A = "33333333-3333-4333-8333-333333333333"
EPOCH_B = "44444444-4444-4444-8444-444444444444"


def request_payload(
    *,
    domain: str = "reference_alpha",
    entity_id: str = ENTITY,
    operation: str = "upsert",
    base_revision: int | None = None,
    local_revision: int = 1,
    label: str = "alpha",
    value: int = 7,
    generation_id: str = GENERATION,
    namespace_key: str = NAMESPACE,
    device_id: str = "device-a",
) -> dict:
    if operation == "tombstone":
        payload = {
            "kind": "tombstone", "entityId": entity_id,
            "deletedAt": "2026-09-18T00:00:00Z", "revision": local_revision,
        }
    elif domain == "reference_beta":
        payload = {
            "kind": "entity_snapshot",
            "record": {"id": entity_id, "metric": "score", "value": value, "observedAt": "2026-09-18T00:00:00Z"},
        }
    else:
        payload = {"kind": "entity_snapshot", "record": {"id": entity_id, "label": label, "ordinal": value}}
    raw = {
        "protocolVersion": 2,
        "mutationId": "mut.00000000-0000-4000-8000-000000000001",
        "idempotencyKey": "k322." + "0" * 64,
        "namespaceKey": namespace_key,
        "generationId": generation_id,
        "deviceId": device_id,
        "domain": domain,
        "entityId": entity_id,
        "operation": operation,
        "baseRevision": base_revision,
        "localRevision": local_revision,
        "payload": payload,
        "payloadHash": payload_hash(payload),
        "createdAt": "2026-09-18T00:00:00Z",
    }
    parsed = ApplyRemoteMutationV2Request.model_validate(raw)
    raw["idempotencyKey"] = derive_v2_idempotency_key(parsed)
    parsed = ApplyRemoteMutationV2Request.model_validate(raw)
    raw["mutationId"] = derive_v2_mutation_id(parsed)
    return raw


class InMemoryV2Gateway:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.generations = {
            (OWNER_A, PROJECT, NAMESPACE, GENERATION): "active",
            (OWNER_B, PROJECT, NAMESPACE, GENERATION): "active",
        }
        self.entities: dict[tuple[str, str, str], dict] = {}
        self.by_idempotency: dict[tuple[str, str], dict] = {}
        self.by_mutation: dict[tuple[str, str], dict] = {}
        self.changes: list[dict] = []
        self.write_count = 0
        self.call_count = 0
        self.fail_before_receipt = False
        self.lose_response_after_commit_once = False
        self.epochs = {OWNER_A: EPOCH_A, OWNER_B: EPOCH_B}
        self.retention_floor = 0

    @staticmethod
    def response(p: dict, *, outcome: str, error: str | None, revision: int | None, sequence: int | None, ref: str | None) -> dict:
        return {
            "protocolVersion": 2,
            "outcome": outcome,
            "mutationId": p["p_mutation_id"],
            "idempotencyKey": p["p_idempotency_key"],
            "domain": p["p_domain"],
            "entityId": p["p_entity_id"],
            "operation": p["p_operation"],
            "payloadHash": p["p_payload_digest"],
            "remoteMutationRef": ref,
            "serverRevision": revision,
            "changeSequence": sequence,
            "serverCommittedAt": "2026-09-18T00:00:01Z" if revision is not None else None,
            "errorCode": error,
            "retryable": False,
        }

    def record(self, p: dict, response: dict) -> None:
        receipt = {
            "mutation": p["p_mutation_id"], "idempotency": p["p_idempotency_key"],
            "digest": p["p_request_digest"], "response": copy.deepcopy(response),
        }
        owner = p["p_authenticated_owner_id"]
        self.by_idempotency[(owner, p["p_idempotency_key"])] = receipt
        self.by_mutation[(owner, p["p_mutation_id"])] = receipt

    def apply(self, p: dict) -> dict:
        with self.lock:
            self.call_count += 1
            owner = p["p_authenticated_owner_id"]
            idem = self.by_idempotency.get((owner, p["p_idempotency_key"]))
            if idem:
                if idem["mutation"] == p["p_mutation_id"] and idem["digest"] == p["p_request_digest"]:
                    return copy.deepcopy(idem["response"])
                return self.response(p, outcome="rejected", error="IDEMPOTENCY_CONFLICT", revision=None, sequence=None, ref=None)
            mutation = self.by_mutation.get((owner, p["p_mutation_id"]))
            if mutation:
                return self.response(p, outcome="rejected", error="MUTATION_ID_CONFLICT", revision=None, sequence=None, ref=None)
            generation = self.generations.get((owner, PROJECT, p["p_namespace_fingerprint"], p["p_generation_id"]))
            if generation is None:
                response = self.response(p, outcome="rejected", error="UNKNOWN_GENERATION", revision=None, sequence=None, ref=None)
                self.record(p, response)
                return response
            if generation != "active":
                response = self.response(p, outcome="rejected", error="STALE_GENERATION", revision=None, sequence=None, ref=None)
                self.record(p, response)
                return response
            key = (owner, p["p_domain"], p["p_entity_id"])
            entity = self.entities.get(key)
            error = None
            if p["p_base_revision"] is None:
                if entity:
                    error = "REMOTE_ENTITY_ALREADY_EXISTS"
                elif p["p_operation"] != "upsert":
                    error = "REMOTE_ENTITY_NOT_FOUND"
            elif not entity:
                error = "REMOTE_ENTITY_NOT_FOUND"
            elif entity["namespace"] != p["p_namespace_fingerprint"] or entity["generation"] != p["p_generation_id"]:
                error = "STALE_GENERATION"
            elif entity["server_revision"] != p["p_base_revision"]:
                error = "REMOTE_REVISION_CONFLICT"
            elif p["p_operation"] == "restore" and not entity["deleted"]:
                error = "REMOTE_ENTITY_NOT_TOMBSTONED"
            elif p["p_operation"] != "restore" and entity["deleted"]:
                error = "REMOTE_ENTITY_TOMBSTONED"
            if error:
                response = self.response(
                    p, outcome="revision_conflict" if error == "REMOTE_REVISION_CONFLICT" else "rejected",
                    error=error, revision=None, sequence=None, ref=None,
                )
                self.record(p, response)
                return response
            snapshot = (copy.deepcopy(self.entities), copy.deepcopy(self.changes), self.write_count)
            revision = (entity["server_revision"] if entity else 0) + 1
            record = entity["record"] if p["p_operation"] == "tombstone" else copy.deepcopy(p["p_payload"]["record"])
            remote_ref = str(uuid.uuid4())
            self.entities[key] = {
                "namespace": p["p_namespace_fingerprint"], "generation": p["p_generation_id"],
                "record": record, "server_revision": revision, "deleted": p["p_operation"] == "tombstone",
            }
            sequence = len(self.changes) + 1
            self.changes.append({
                "sequence": sequence, "owner": owner, "namespace": p["p_namespace_fingerprint"],
                "generation": p["p_generation_id"], "domain": p["p_domain"], "entityId": p["p_entity_id"],
                "operation": p["p_operation"], "serverRevision": revision, "record": copy.deepcopy(record),
                "isDeleted": p["p_operation"] == "tombstone",
                "deletedAt": p["p_payload"].get("deletedAt") if p["p_operation"] == "tombstone" else None,
                "remoteMutationRef": remote_ref, "serverCommittedAt": "2026-09-18T00:00:01Z",
            })
            self.write_count += 1
            if self.fail_before_receipt:
                self.entities, self.changes, self.write_count = snapshot
                raise RuntimeError("synthetic_transaction_abort")
            response = self.response(p, outcome="applied", error=None, revision=revision, sequence=sequence, ref=remote_ref)
            self.record(p, response)
            if self.lose_response_after_commit_once:
                self.lose_response_after_commit_once = False
                raise RuntimeError("synthetic_post_commit_response_loss")
            return response

    def pull(self, p: dict) -> dict:
        owner = p["p_authenticated_owner_id"]
        epoch = self.epochs[owner]
        generation = self.generations.get((owner, PROJECT, p["p_namespace_fingerprint"], p["p_generation_id"]))
        if generation != "active":
            return {
                "protocolVersion": 2, "status": "rejected", "domain": p["p_domain"], "serverEpoch": epoch,
                "retentionFloor": self.retention_floor, "nextCursor": p["p_cursor"], "changes": [],
                "errorCode": "UNKNOWN_GENERATION" if generation is None else "STALE_GENERATION",
            }
        if p["p_server_epoch"] is not None and p["p_server_epoch"] != epoch:
            return {
                "protocolVersion": 2, "status": "full_resync_required", "domain": p["p_domain"],
                "serverEpoch": epoch, "retentionFloor": self.retention_floor,
                "nextCursor": self.retention_floor, "changes": [], "errorCode": "SERVER_EPOCH_MISMATCH",
            }
        if p["p_cursor"] < self.retention_floor:
            return {
                "protocolVersion": 2, "status": "full_resync_required", "domain": p["p_domain"],
                "serverEpoch": epoch, "retentionFloor": self.retention_floor,
                "nextCursor": self.retention_floor, "changes": [], "errorCode": "CURSOR_INVALID",
            }
        page = [
            {key: value for key, value in change.items() if key not in {"owner", "namespace", "generation"}}
            for change in self.changes
            if change["owner"] == owner and change["namespace"] == p["p_namespace_fingerprint"]
            and change["generation"] == p["p_generation_id"] and change["domain"] == p["p_domain"]
            and change["sequence"] > p["p_cursor"]
        ][:p["p_limit"]]
        return {
            "protocolVersion": 2, "status": "changes", "domain": p["p_domain"], "serverEpoch": epoch,
            "retentionFloor": self.retention_floor,
            "nextCursor": page[-1]["sequence"] if page else p["p_cursor"],
            "changes": page, "errorCode": None,
        }


@pytest.fixture
def gateway() -> InMemoryV2Gateway:
    return InMemoryV2Gateway()


@pytest.fixture
def service(gateway: InMemoryV2Gateway) -> RemoteMutationV2Service:
    return RemoteMutationV2Service(gateway, PROJECT)


def parse(service: RemoteMutationV2Service, **kwargs) -> ApplyRemoteMutationV2Request:
    return service.parse_mutation(request_payload(**kwargs))


def test_multi_domain_dispatch_and_server_revision_is_independent(service: RemoteMutationV2Service) -> None:
    alpha = service.apply(parse(service, local_revision=17), OWNER_A)
    beta = service.apply(parse(service, domain="reference_beta", entity_id=ENTITY_2, local_revision=41), OWNER_A)
    assert alpha.outcome == beta.outcome == "applied"
    assert alpha.server_revision == beta.server_revision == 1
    assert alpha.domain == "reference_alpha" and beta.domain == "reference_beta"


def test_unknown_domain_and_invalid_record_fail_before_gateway(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    unknown = request_payload(); unknown["domain"] = "notes"
    parsed_unknown = service.parse_mutation(unknown)
    assert service.apply(parsed_unknown, OWNER_A).error_code == "UNKNOWN_DOMAIN"
    malformed = request_payload(); malformed["payload"]["record"]["unexpected"] = True
    malformed["payloadHash"] = payload_hash(malformed["payload"])
    parsed = ApplyRemoteMutationV2Request.model_validate(malformed)
    malformed["idempotencyKey"] = derive_v2_idempotency_key(parsed)
    parsed = ApplyRemoteMutationV2Request.model_validate(malformed)
    malformed["mutationId"] = derive_v2_mutation_id(parsed)
    assert service.apply(service.parse_mutation(malformed), OWNER_A).error_code == "MALFORMED_PAYLOAD"
    assert gateway.call_count == 0


@pytest.mark.parametrize("change", [
    {"protocolVersion": 1}, {"operation": "purge"}, {"unexpected": True},
    {"baseRevision": 0}, {"localRevision": 1.0}, {"deviceId": ""},
])
def test_invalid_envelopes_fail_closed(change: dict) -> None:
    raw = request_payload(); raw.update(change)
    with pytest.raises((ValidationError, ValueError)):
        ApplyRemoteMutationV2Request.model_validate(raw)


def test_payload_hash_and_payload_bound_identities_are_recomputed(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    changed = request_payload(); changed["payload"]["record"]["label"] = "changed"
    assert service.apply(service.parse_mutation(changed), OWNER_A).error_code == "PAYLOAD_HASH_MISMATCH"
    wrong_idem = request_payload(); wrong_idem["idempotencyKey"] = "k322." + "f" * 64
    assert service.apply(service.parse_mutation(wrong_idem), OWNER_A).error_code == "IDEMPOTENCY_KEY_MISMATCH"
    wrong_mutation = request_payload(); wrong_mutation["mutationId"] = "mut.00000000-0000-4000-8000-000000000099"
    assert service.apply(service.parse_mutation(wrong_mutation), OWNER_A).error_code == "MUTATION_ID_MISMATCH"
    assert gateway.write_count == 0


def test_exact_replay_returns_immutable_receipt(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    request = parse(service)
    original = service.apply(request, OWNER_A)
    retry = service.apply(request, OWNER_A)
    assert retry == original
    assert gateway.write_count == 1 and len(gateway.changes) == 1


def test_post_commit_response_loss_is_ambiguous_and_exact_replay_is_single_write(
    service: RemoteMutationV2Service, gateway: InMemoryV2Gateway,
) -> None:
    request = parse(service)
    gateway.lose_response_after_commit_once = True

    with pytest.raises(RemoteMutationV2TransportError) as error:
        service.apply(request, OWNER_A)

    assert error.value.response.error_code == "TRANSIENT_SERVER_FAILURE"
    assert error.value.response.retryable is True
    assert gateway.write_count == 1 and len(gateway.changes) == 1

    retry = service.apply(request, OWNER_A)
    assert retry.outcome == "applied"
    assert retry.mutation_id == request.mutation_id
    assert retry.idempotency_key == request.idempotency_key
    assert gateway.write_count == 1 and len(gateway.changes) == 1


def test_same_replay_identity_with_changed_context_or_entity_fails_closed(
    service: RemoteMutationV2Service, gateway: InMemoryV2Gateway,
) -> None:
    original = parse(service)
    assert service.apply(original, OWNER_A).outcome == "applied"

    changed_device = parse(service, device_id="device-b")
    assert changed_device.idempotency_key == original.idempotency_key
    assert service.apply(changed_device, OWNER_A).error_code == "IDEMPOTENCY_CONFLICT"

    changed_entity = request_payload(entity_id=ENTITY_2)
    changed_entity["idempotencyKey"] = original.idempotency_key
    changed_entity["mutationId"] = original.mutation_id
    assert service.apply(service.parse_mutation(changed_entity), OWNER_A).error_code == "IDEMPOTENCY_KEY_MISMATCH"

    changed_domain = request_payload(domain="reference_beta", entity_id=ENTITY_2)
    changed_domain["idempotencyKey"] = original.idempotency_key
    changed_domain["mutationId"] = original.mutation_id
    assert service.apply(service.parse_mutation(changed_domain), OWNER_A).error_code == "IDEMPOTENCY_KEY_MISMATCH"
    assert gateway.write_count == 1


def test_account_receipts_and_entities_are_isolated(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    request = parse(service)
    left = service.apply(request, OWNER_A)
    right = service.apply(request, OWNER_B)
    assert left.remote_mutation_ref != right.remote_mutation_ref
    assert gateway.write_count == 2
    assert len(gateway.by_idempotency) == 2


def test_server_cas_rejects_stale_base_and_local_revision_cannot_override(service: RemoteMutationV2Service) -> None:
    assert service.apply(parse(service, local_revision=9), OWNER_A).server_revision == 1
    stale = service.apply(parse(service, base_revision=7, local_revision=500, label="stale"), OWNER_A)
    assert stale.outcome == "revision_conflict" and stale.error_code == "REMOTE_REVISION_CONFLICT"
    applied = service.apply(parse(service, base_revision=1, local_revision=500, label="new"), OWNER_A)
    assert applied.server_revision == 2


def test_tombstone_and_explicit_restore_preserve_revision_history(service: RemoteMutationV2Service) -> None:
    service.apply(parse(service), OWNER_A)
    deleted = service.apply(parse(service, operation="tombstone", base_revision=1, local_revision=2), OWNER_A)
    restored = service.apply(parse(service, operation="restore", base_revision=2, local_revision=8, label="restored"), OWNER_A)
    assert deleted.server_revision == 2 and restored.server_revision == 3
    assert restored.operation == "restore"


def test_duplicate_concurrency_commits_once(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    request = parse(service)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: service.apply(request, OWNER_A), range(2)))
    assert results[0] == results[1]
    assert gateway.write_count == 1


def test_concurrent_distinct_mutations_with_one_base_revision_apply_once(
    service: RemoteMutationV2Service, gateway: InMemoryV2Gateway,
) -> None:
    assert service.apply(parse(service), OWNER_A).server_revision == 1
    contenders = [
        parse(service, base_revision=1, local_revision=2, label="left"),
        parse(service, base_revision=1, local_revision=3, label="right"),
    ]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda request: service.apply(request, OWNER_A), contenders))
    assert sorted(result.outcome for result in results) == ["applied", "revision_conflict"]
    assert gateway.write_count == 2
    assert gateway.entities[(OWNER_A, "reference_alpha", ENTITY)]["server_revision"] == 2


def test_transaction_failure_is_ambiguous_and_rolls_back(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    gateway.fail_before_receipt = True
    with pytest.raises(RemoteMutationV2TransportError) as error:
        service.apply(parse(service), OWNER_A)
    assert error.value.response.error_code == "TRANSIENT_SERVER_FAILURE" and error.value.response.retryable
    assert gateway.entities == {} and gateway.changes == [] and gateway.by_idempotency == {}


def test_pull_orders_changes_and_isolates_domain_and_account(service: RemoteMutationV2Service) -> None:
    service.apply(parse(service), OWNER_A)
    service.apply(parse(service, domain="reference_beta", entity_id=ENTITY_2), OWNER_A)
    service.apply(parse(service), OWNER_B)
    request = PullChangesV2Request.model_validate({
        "protocolVersion": 2, "namespaceKey": NAMESPACE, "generationId": GENERATION,
        "domain": "reference_alpha", "cursor": 0, "serverEpoch": None, "limit": 100,
    })
    page = service.pull(request, OWNER_A)
    assert [change.sequence for change in page.changes] == [1]
    assert all(change.domain == "reference_alpha" for change in page.changes)
    assert page.next_cursor == 1 and page.server_epoch == EPOCH_A


def test_pull_epoch_and_retention_floor_require_full_resync_without_clear_semantics(
    service: RemoteMutationV2Service, gateway: InMemoryV2Gateway,
) -> None:
    base = {
        "protocolVersion": 2, "namespaceKey": NAMESPACE, "generationId": GENERATION,
        "domain": "reference_alpha", "cursor": 0, "serverEpoch": EPOCH_B, "limit": 100,
    }
    epoch = service.pull(PullChangesV2Request.model_validate(base), OWNER_A)
    assert epoch.status == "full_resync_required" and epoch.error_code == "SERVER_EPOCH_MISMATCH"
    assert epoch.changes == []
    gateway.retention_floor = 5
    base["serverEpoch"] = EPOCH_A
    retained = service.pull(PullChangesV2Request.model_validate(base), OWNER_A)
    assert retained.status == "full_resync_required" and retained.error_code == "CURSOR_INVALID"
    assert retained.next_cursor == 5 and retained.changes == []


def test_request_digest_binds_authenticated_owner_and_all_transport_context(service: RemoteMutationV2Service) -> None:
    request = parse(service)
    assert derive_v2_request_digest(request, OWNER_A, PROJECT) != derive_v2_request_digest(request, OWNER_B, PROJECT)
    changed = parse(service, device_id="device-b")
    assert derive_v2_request_digest(request, OWNER_A, PROJECT) != derive_v2_request_digest(changed, OWNER_A, PROJECT)
    changed_time = request.model_copy(update={"created_at": "2026-09-18T00:00:01Z"})
    assert derive_v2_request_digest(request, OWNER_A, PROJECT) != derive_v2_request_digest(changed_time, OWNER_A, PROJECT)


def test_frontend_server_v2_identity_vectors() -> None:
    fixture = json.loads(
        (Path(__file__).parent.parent / "protocol" / "k323-v2-identity-vectors.json").read_text(encoding="utf-8")
    )
    assert fixture["version"] == 2
    for vector in fixture["vectors"]:
        raw = {
            "protocolVersion": 2,
            "mutationId": vector["mutationId"],
            "idempotencyKey": vector["idempotencyKey"],
            "namespaceKey": fixture["namespaceKey"],
            "generationId": fixture["generationId"],
            "deviceId": fixture["deviceId"],
            "domain": vector["domain"],
            "entityId": vector["entityId"],
            "operation": vector["operation"],
            "baseRevision": None if vector["operation"] == "upsert" else 4,
            "localRevision": vector["localRevision"],
            "payload": vector["payload"],
            "payloadHash": vector["payloadHash"],
            "createdAt": "2026-09-18T00:00:00Z",
        }
        parsed = ApplyRemoteMutationV2Request.model_validate(raw)
        assert payload_hash(parsed.payload) == vector["payloadHash"]
        assert derive_v2_idempotency_key(parsed) == vector["idempotencyKey"]
        assert derive_v2_mutation_id(parsed) == vector["mutationId"]


def test_migration_is_additive_locked_immutable_and_service_role_only() -> None:
    sql = (Path(__file__).parent / "migrations" / "202609180001_k323_v2_multi_domain_transport.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert lowered.startswith("begin;") and lowered.rstrip().endswith("commit;")
    assert "pg_advisory_xact_lock" in lowered and "|stream" in lowered and "for update" in lowered
    assert "remote_mutation_receipts" in lowered and "protocol_version" in lowered
    assert "remote_reference_changes_v2" in lowered and "bigserial" in lowered
    assert "remote_reference_changes_v2_immutable" in lowered and "before update or delete" in lowered
    assert "enable row level security" in lowered and "security invoker" in lowered and "to service_role" in lowered
    assert "pg_advisory_xact_lock_shared" in lowered
    assert "remote_sync_generations_transition_lock_v2" in lowered
    assert "revoke all on public.remote_sync_generations from service_role" in lowered
    assert "grant update on public.remote_sync_generations" not in lowered
    assert "grant update on public.remote_mutation_receipts" not in lowered
    assert "from public, anon, authenticated" in lowered
    assert "drop table" not in lowered and "truncate" not in lowered
    assert "delete from" not in lowered and "public.notes" not in lowered


def test_receipts_and_errors_do_not_contain_reference_content(service: RemoteMutationV2Service, gateway: InMemoryV2Gateway) -> None:
    response = service.apply(parse(service, label="private-label"), OWNER_A)
    rendered = json.dumps(response.model_dump(by_alias=True))
    receipts = json.dumps(list(gateway.by_idempotency.values()))
    assert "private-label" not in rendered and "private-label" not in receipts
