from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path

import pytest

from remote_mutation_v2 import canonical_payload_bytes, payload_hash
from workout_remote_authority import (
    MAX_WORKOUT_BYTES, WorkoutMutationRequest, validate_workout_session,
    workout_request_digest,
)


VECTORS = json.loads((Path(__file__).parents[1] / "protocol" / "rel05g4a-workout-vectors.json").read_text(
    encoding="utf-8",
))


def wire(vector: dict) -> dict:
    payload = ({
        "kind": "tombstone", "entityId": vector["record"]["id"],
        "revision": vector["localRevision"], "deletedAt": vector["deletedAt"],
    } if vector["operation"] == "tombstone" else {
        "kind": "entity_snapshot", "record": vector["record"],
    })
    return {
        "protocolVersion": 2, "namespaceKey": VECTORS["namespaceKey"],
        "generationId": VECTORS["generationId"], "deviceId": VECTORS["deviceId"],
        "bindingId": VECTORS["bindingId"], "authorityEpoch": VECTORS["authorityEpoch"],
        "domain": "health_workout_session", "entityId": vector["record"]["id"],
        "mutationId": vector["mutationId"], "idempotencyKey": vector["idempotencyKey"],
        "operation": vector["operation"],
        "remoteCasBaseRevision": vector["remoteCasBaseRevision"],
        "localRevision": vector["localRevision"], "payload": payload,
        "payloadHash": vector["expectedPayloadHash"],
        "requestDigest": vector["expectedRequestDigest"],
    }


@pytest.mark.parametrize("vector", VECTORS["vectors"], ids=lambda value: value["name"])
def test_shared_workout_content_payload_and_request_golden_vectors(vector: dict) -> None:
    assert validate_workout_session(vector["record"]) == vector["expectedContentHash"]
    assert payload_hash(vector["record"]) == vector["expectedContentHash"]
    request = WorkoutMutationRequest.model_validate(wire(vector))
    assert payload_hash(request.payload) == vector["expectedPayloadHash"]
    assert workout_request_digest(request, VECTORS["ownerId"], VECTORS["projectScope"]) \
        == vector["expectedRequestDigest"]
    if vector["operation"] != "tombstone":
        assert request.content_hash() == vector["expectedContentHash"]


def test_request_digest_binds_every_authoritative_field_but_not_created_at() -> None:
    base = wire(VECTORS["vectors"][0])
    request = WorkoutMutationRequest.model_validate(base)
    original = workout_request_digest(request, VECTORS["ownerId"], VECTORS["projectScope"])
    for key, replacement in {
        "namespace_key": "f" * 64, "generation_id": "generation-mobile",
        "device_id": "device-mobile", "binding_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "authority_epoch": 2, "mutation_id": VECTORS["vectors"][1]["mutationId"],
        "idempotency_key": VECTORS["vectors"][1]["idempotencyKey"],
        "entity_id": VECTORS["vectors"][1]["record"]["id"],
        "operation": "restore", "remote_cas_base_revision": 1,
        "local_revision": 2, "payload_hash": "f" * 64,
    }.items():
        changed = request.model_copy(update={key: replacement})
        assert workout_request_digest(changed, VECTORS["ownerId"], VECTORS["projectScope"]) != original, key
    assert workout_request_digest(request, "22222222-2222-4222-8222-222222222222",
                                  VECTORS["projectScope"]) != original
    assert workout_request_digest(request, VECTORS["ownerId"], "other-project") != original
    metadata = {**base, "createdAt": "2026-09-25T01:02:03Z"}
    assert workout_request_digest(
        WorkoutMutationRequest.model_validate(metadata), VECTORS["ownerId"], VECTORS["projectScope"],
    ) == original


@pytest.mark.parametrize("path,value", [
    (("version",), 2),
    (("entries", 0, "sets", 0, "ordinal"), 2),
    (("entries", 0, "sets", 0, "sourceValue"), "10.50"),
    (("entries", 0, "sets", 0, "reps"), 9_007_199_254_740_992),
    (("entries", 0, "sets", 0, "kind"), "cardio"),
    (("entries", 0, "exercise", "type"), "cardio"),
    (("entries", 0, "sets", 0, "weightKg"), "10.6"),
])
def test_server_rejects_noncanonical_workout_shape(path: tuple, value: object) -> None:
    record = deepcopy(VECTORS["vectors"][0]["record"])
    target = record
    for part in path[:-1]:
        target = target[part]
    target[path[-1]] = value
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)


def test_server_rejects_duplicate_identity_unknown_key_and_unbounded_decimal() -> None:
    record = deepcopy(VECTORS["vectors"][0]["record"])
    record["entries"][0]["sets"][1]["id"] = record["entries"][0]["sets"][0]["id"]
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)
    record = deepcopy(VECTORS["vectors"][0]["record"])
    record["extra"] = True
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)
    record = deepcopy(VECTORS["vectors"][0]["record"])
    record["entries"][0]["sets"][0]["sourceValue"] = "1.234"
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)


@pytest.mark.parametrize("local_date", ["٢٠٢٦-٠٩-٢٤", "２０２６-０９-２４", "2025-02-29", "2026-13-01", "2026-02-30"])
def test_non_ascii_or_invalid_calendar_date_is_not_canonical(local_date: str) -> None:
    record = deepcopy(VECTORS["vectors"][0]["record"])
    record["localDate"] = local_date
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)


@pytest.mark.parametrize("local_date", ["2026-09-24", "2024-02-29"])
def test_ascii_calendar_dates_remain_valid(local_date: str) -> None:
    record = deepcopy(VECTORS["vectors"][0]["record"])
    record["localDate"] = local_date
    assert validate_workout_session(record) == payload_hash(record)


@pytest.mark.parametrize("field,value", [
    ("mutationId", "mut.AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"),
    ("mutationId", "mut.Aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ("entityId", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"),
    ("bindingId", "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB"),
])
def test_remote_wire_rejects_noncanonical_identifier_case(field: str, value: str) -> None:
    request = deepcopy(wire(VECTORS["vectors"][0]))
    request[field] = value
    if field == "entityId":
        request["payload"]["record"]["id"] = value
    with pytest.raises(ValueError):
        WorkoutMutationRequest.model_validate(request)


def test_session_uuid_text_is_lowercase_on_remote_wire() -> None:
    record = deepcopy(VECTORS["vectors"][3]["record"])
    record["entries"][0]["id"] = record["entries"][0]["id"].upper()
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)


def test_exact_canonical_utf8_boundary_and_one_multibyte_character_over() -> None:
    record = deepcopy(VECTORS["vectors"][1]["record"])
    exercise = record["entries"][0]["exercise"]
    base = len(canonical_payload_bytes(record)) - len(exercise["name"].encode("utf-8"))
    exercise["name"] = "A" * (MAX_WORKOUT_BYTES - base)
    assert len(canonical_payload_bytes(record)) == MAX_WORKOUT_BYTES
    validate_workout_session(record)
    exercise["name"] += "가"
    with pytest.raises(ValueError, match="INVALID_PAYLOAD"):
        validate_workout_session(record)
