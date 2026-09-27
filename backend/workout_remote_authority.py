"""Dormant REL-05G4A workout authority wire contract.

PostgreSQL RPCs own every authority decision and atomic write. This module
validates the frozen WorkoutSessionV1 shape, canonical hashes, and client
request digest before the trusted service-role call. It is not wired into the
Health product runtime.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from remote_mutation_v2 import (
    DIGEST_PATTERN, IDEMPOTENCY_PATTERN, SAFE_IDENTIFIER,
    canonical_payload_bytes, payload_hash,
)

DOMAIN = "health_workout_session"
MAX_SAFE_INTEGER = 9_007_199_254_740_991
MAX_WORKOUT_BYTES = 131_072
UUID_WIRE_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
UUID_V4_WIRE_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
UUID_V4_PAYLOAD_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
# main.py imports this for snapshot-token/server-epoch query validation.
UUID_PATTERN = UUID_WIRE_PATTERN
MUTATION_ID_PATTERN = re.compile(r"^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
DECIMAL = re.compile(r"^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$")
DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def _exact(value: Any, keys: set[str]) -> bool:
    return type(value) is dict and set(value) == keys


def _payload_uuid4(value: Any) -> bool:
    return type(value) is str and UUID_V4_PAYLOAD_PATTERN.fullmatch(value) is not None


def _wire_uuid4(value: Any) -> bool:
    return type(value) is str and UUID_V4_WIRE_PATTERN.fullmatch(value) is not None


def _safe_int(value: Any, *, positive: bool = False) -> bool:
    return type(value) is int and (1 if positive else 0) <= value <= MAX_SAFE_INTEGER


def _decimal(value: Any, scale: int) -> bool:
    return type(value) is str and DECIMAL.fullmatch(value) is not None and (
        "." not in value or len(value.split(".")[1]) <= scale
    )


def _nullable_decimal(value: Any, scale: int) -> bool:
    return value is None or _decimal(value, scale)


def _weight_kg(source_value: str, source_unit: str) -> str:
    if source_unit == "kg":
        return source_value
    with localcontext() as context:
        context.prec = max(50, len(source_value) + 12)
        value = (Decimal(source_value) * Decimal("0.45359237")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )
    return format(value, "f").rstrip("0").rstrip(".") if "." in format(value, "f") else format(value, "f")


def _valid_reps(reps: Any, assisted: Any) -> bool:
    if reps is not None and not _safe_int(reps):
        return False
    if assisted is None:
        return True
    return _safe_int(assisted, positive=True) and reps is not None and assisted <= reps


def _valid_set(value: Any, kind: str, ordinal: int) -> bool:
    if type(value) is not dict or not _payload_uuid4(value.get("id")) or value.get("ordinal") != ordinal \
            or not _safe_int(value.get("ordinal"), positive=True) or type(value.get("done")) is not bool \
            or value.get("kind") != kind:
        return False
    if kind == "strength":
        if not _exact(value, {"id", "ordinal", "kind", "loadKind", "weightKg", "sourceValue",
                              "sourceUnit", "reps", "assistedReps", "dropset", "done"}) \
                or value["loadKind"] != "external_weight" or type(value["dropset"]) is not bool \
                or not _nullable_decimal(value["weightKg"], 2) \
                or not _nullable_decimal(value["sourceValue"], 2) \
                or not _valid_reps(value["reps"], value["assistedReps"]):
            return False
        if value["sourceValue"] is None or value["sourceUnit"] is None:
            return value["sourceValue"] is None and value["sourceUnit"] is None and value["weightKg"] is None
        return type(value["sourceUnit"]) is str and value["sourceUnit"] in {"kg", "lbs"} \
            and value["weightKg"] == _weight_kg(
            value["sourceValue"], value["sourceUnit"],
        )
    if kind == "bodyweight":
        return _exact(value, {"id", "ordinal", "kind", "loadKind", "reps",
                              "assistedReps", "dropset", "done"}) \
            and value["loadKind"] == "bodyweight" \
            and _valid_reps(value["reps"], value["assistedReps"]) \
            and type(value["dropset"]) is bool
    return _exact(value, {"id", "ordinal", "kind", "durationSeconds", "distanceMeters", "done"}) \
        and (value["durationSeconds"] is None or _safe_int(value["durationSeconds"])) \
        and _nullable_decimal(value["distanceMeters"], 3)


def validate_workout_session(record: Any) -> str:
    """Return the canonical content hash, or reject the entire record."""
    if not _exact(record, {"version", "id", "localDate", "entries"}) \
            or type(record["version"]) is not int or record["version"] != 1 \
            or not _payload_uuid4(record["id"]) or type(record["localDate"]) is not str \
            or DATE.fullmatch(record["localDate"]) is None \
            or type(record["entries"]) is not list or not record["entries"]:
        raise ValueError("INVALID_PAYLOAD")
    year, month, day = map(int, record["localDate"].split("-"))
    leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    days_by_month = (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
    if month < 1 or month > 12 or day < 1 or day > days_by_month[month - 1]:
        raise ValueError("INVALID_PAYLOAD")
    # UUID identity is value-based; original spelling remains untouched for hashes.
    identities = {UUID(record["id"])}
    for entry in record["entries"]:
        if not _exact(entry, {"id", "exercise", "sets"}) or not _payload_uuid4(entry["id"]) \
                or UUID(entry["id"]) in identities or type(entry["sets"]) is not list or not entry["sets"]:
            raise ValueError("INVALID_PAYLOAD")
        identities.add(UUID(entry["id"]))
        exercise = entry["exercise"]
        if not _exact(exercise, {"id", "name", "type", "tags", "cardioMode"}) \
                or (exercise["id"] is not None and type(exercise["id"]) is not str) \
                or type(exercise["name"]) is not str \
                or type(exercise["type"]) is not str \
                or exercise["type"] not in {"strength", "bodyweight", "cardio"} \
                or type(exercise["tags"]) is not list \
                or any(type(tag) is not str for tag in exercise["tags"]):
            raise ValueError("INVALID_PAYLOAD")
        if (exercise["type"] == "cardio" and exercise["cardioMode"] not in {"time", "distance", "both"}) \
                or (exercise["type"] != "cardio" and exercise["cardioMode"] is not None):
            raise ValueError("INVALID_PAYLOAD")
        for ordinal, workout_set in enumerate(entry["sets"], 1):
            if not _valid_set(workout_set, exercise["type"], ordinal) or UUID(workout_set["id"]) in identities:
                raise ValueError("INVALID_PAYLOAD")
            identities.add(UUID(workout_set["id"]))
    try:
        canonical = canonical_payload_bytes(record)
    except ValueError as error:
        raise ValueError("INVALID_PAYLOAD") from error
    if len(canonical) > MAX_WORKOUT_BYTES:
        raise ValueError("INVALID_PAYLOAD")
    return hashlib.sha256(canonical).hexdigest()


def _canonical_json(value: Any) -> bytes:
    """Same sorted-key, compact UTF-8 representation as K-323 and browser."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def workout_request_digest(request: "WorkoutMutationRequest", owner: str, project: str) -> str:
    """Immutable v1 tuple; createdAt and transmission metadata are excluded."""
    # JWT subject is trusted, but PostgreSQL renders its uuid in lowercase.
    # Match that single wire spelling before hashing the authority tuple.
    canonical_owner = str(UUID(owner))
    fields = [
        "absinthe-workout-remote-v1", 2, canonical_owner, project, DOMAIN,
        request.namespace_key, request.generation_id, request.device_id,
        request.binding_id, request.authority_epoch, request.mutation_id,
        request.idempotency_key, request.entity_id, request.operation,
        request.remote_cas_base_revision, request.local_revision, request.payload_hash,
    ]
    return hashlib.sha256(_canonical_json(fields)).hexdigest()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=False, strict=True)


class WorkoutGenerationRequest(StrictModel):
    protocol_version: Literal[2] = Field(alias="protocolVersion")
    namespace_key: str = Field(alias="namespaceKey")
    generation_id: str = Field(alias="generationId")
    device_id: str = Field(alias="deviceId")

    @model_validator(mode="after")
    def validate_identity(self) -> "WorkoutGenerationRequest":
        if not DIGEST_PATTERN.fullmatch(self.namespace_key) or any(
            SAFE_IDENTIFIER.fullmatch(value) is None for value in (self.generation_id, self.device_id)
        ):
            raise ValueError("INVALID_GENERATION")
        return self


class WorkoutBindingRequest(WorkoutGenerationRequest):
    binding_id: str = Field(alias="bindingId")
    authority_epoch: int = Field(alias="authorityEpoch")

    @model_validator(mode="after")
    def validate_binding(self) -> "WorkoutBindingRequest":
        if not UUID_WIRE_PATTERN.fullmatch(self.binding_id) or not _safe_int(self.authority_epoch, positive=True):
            raise ValueError("INVALID_BINDING")
        return self


class WorkoutMutationRequest(WorkoutBindingRequest):
    domain: Literal["health_workout_session"]
    entity_id: str = Field(alias="entityId")
    mutation_id: str = Field(alias="mutationId")
    idempotency_key: str = Field(alias="idempotencyKey")
    operation: Literal["upsert", "tombstone", "restore"]
    remote_cas_base_revision: int | None = Field(alias="remoteCasBaseRevision")
    local_revision: int = Field(alias="localRevision")
    payload: dict[str, Any]
    payload_hash: str = Field(alias="payloadHash")
    request_digest: str = Field(alias="requestDigest")
    created_at: str | None = Field(default=None, alias="createdAt")

    @model_validator(mode="after")
    def validate_mutation(self) -> "WorkoutMutationRequest":
        if not _wire_uuid4(self.entity_id) or MUTATION_ID_PATTERN.fullmatch(self.mutation_id) is None \
                or IDEMPOTENCY_PATTERN.fullmatch(self.idempotency_key) is None \
                or DIGEST_PATTERN.fullmatch(self.payload_hash) is None \
                or DIGEST_PATTERN.fullmatch(self.request_digest) is None \
                or not _safe_int(self.local_revision, positive=True) \
                or (self.remote_cas_base_revision is not None
                    and not _safe_int(self.remote_cas_base_revision, positive=True)):
            raise ValueError("INVALID_MUTATION")
        if self.created_at is not None:
            try:
                if len(self.created_at) > 40 or datetime.fromisoformat(
                    self.created_at.replace("Z", "+00:00")
                ).tzinfo is None:
                    raise ValueError("INVALID_MUTATION")
            except ValueError as error:
                raise ValueError("INVALID_MUTATION") from error
        if self.operation in {"upsert", "restore"}:
            if not _exact(self.payload, {"kind", "record"}) \
                    or self.payload["kind"] != "entity_snapshot" \
                    or type(self.payload["record"]) is not dict:
                raise ValueError("INVALID_PAYLOAD")
            validate_workout_session(self.payload["record"])
            if UUID(self.payload["record"]["id"]) != UUID(self.entity_id):
                raise ValueError("INVALID_PAYLOAD")
        else:
            if not _exact(self.payload, {"kind", "entityId", "revision", "deletedAt"}) \
                    or self.payload["kind"] != "tombstone" \
                    or self.payload["entityId"] != self.entity_id \
                    or self.payload["revision"] != self.local_revision \
                    or type(self.payload["deletedAt"]) is not str:
                raise ValueError("INVALID_PAYLOAD")
            try:
                if datetime.fromisoformat(self.payload["deletedAt"].replace("Z", "+00:00")).tzinfo is None:
                    raise ValueError("INVALID_PAYLOAD")
            except ValueError as error:
                raise ValueError("INVALID_PAYLOAD") from error
        if hashlib.sha256(_canonical_json(self.payload)).hexdigest() != self.payload_hash:
            raise ValueError("INVALID_PAYLOAD")
        return self

    def content_hash(self) -> str | None:
        return payload_hash(self.payload["record"]) if self.operation != "tombstone" else None


class WorkoutRemoteGateway:
    def __init__(self, client: Any) -> None:
        self._client = client

    def call(self, name: str, params: dict[str, Any]) -> dict[str, Any]:
        value = self._client.rpc(name, params).execute().data
        if not isinstance(value, dict):
            raise RuntimeError("invalid_rpc_response")
        return value


def binding_params(request: WorkoutBindingRequest, owner: str, project: str) -> dict[str, Any]:
    return {
        "p_owner": owner, "p_project": project,
        "p_namespace": request.namespace_key, "p_generation": request.generation_id,
        "p_device": request.device_id, "p_binding": request.binding_id,
        "p_authority_epoch": request.authority_epoch,
    }
