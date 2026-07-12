"""K-323 authenticated, idempotent remote mutation protocol.

The Python boundary validates and canonicalizes one mutation, then invokes one
PostgreSQL RPC. Transactional entity/receipt behavior lives in the migration's
database function; this module never decomposes it into independent requests.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

MAX_REQUEST_BYTES = 262_144
MAX_CANONICAL_PAYLOAD_BYTES = 131_072
MAX_SAFE_INTEGER = 9_007_199_254_740_991
SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
MUTATION_ID_PATTERN = re.compile(r"^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)
FINGERPRINT_PATTERN = re.compile(r"^[a-f0-9]{64}$")
IDEMPOTENCY_PATTERN = re.compile(r"^k322\.[a-f0-9]{64}$")

RemoteOutcome = Literal["applied", "revision_conflict", "rejected"]


def _valid_timestamp(value: str) -> str:
    if len(value) > 40:
        raise ValueError("timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp")
    return value


def _safe_integer(value: int, *, positive: bool = False) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or abs(value) > MAX_SAFE_INTEGER:
        raise ValueError("unsafe_integer")
    if positive and value < 1:
        raise ValueError("unsafe_integer")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=False, strict=True)


class NoteSnapshot(StrictModel):
    id: str = Field(max_length=64)
    title: str = Field(max_length=1_024)
    body: str = Field(max_length=120_000)
    created_at: int | None = Field(default=None, alias="createdAt")
    last_opened_at: int | None = Field(default=None, alias="lastOpenedAt")
    updated_at: int = Field(alias="updatedAt")
    folder_id: str | None = Field(default=None, alias="folderId", max_length=64)
    deleted_at: None = Field(default=None, alias="deletedAt")
    starred: bool | None = None
    properties: dict[str, str] | None = None
    relations: dict[str, list[str]] | None = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not UUID_PATTERN.fullmatch(value):
            raise ValueError("id")
        return value

    @field_validator("folder_id")
    @classmethod
    def validate_folder_id(cls, value: str | None) -> str | None:
        if value is not None and not UUID_PATTERN.fullmatch(value):
            raise ValueError("folder_id")
        return value

    @field_validator("created_at", "last_opened_at", "updated_at")
    @classmethod
    def validate_integer_timestamp(cls, value: int | None) -> int | None:
        if value is not None:
            _safe_integer(value)
            if value < 0:
                raise ValueError("timestamp")
        return value

    @field_validator("properties")
    @classmethod
    def validate_properties(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return value
        if len(value) > 128 or any(not key or len(key) > 128 or len(item) > 4_096 for key, item in value.items()):
            raise ValueError("properties")
        return value

    @field_validator("relations")
    @classmethod
    def validate_relations(cls, value: dict[str, list[str]] | None) -> dict[str, list[str]] | None:
        if value is None:
            return value
        if len(value) > 128:
            raise ValueError("relations")
        for key, targets in value.items():
            if not key or len(key) > 128 or len(targets) > 1_024:
                raise ValueError("relations")
            if any(not UUID_PATTERN.fullmatch(target) for target in targets):
                raise ValueError("relations")
        return value


class EntitySnapshotPayload(StrictModel):
    kind: Literal["entity_snapshot"]
    record: NoteSnapshot


class TombstonePayload(StrictModel):
    kind: Literal["tombstone"]
    entity_id: str = Field(alias="entityId", max_length=64)
    deleted_at: str = Field(alias="deletedAt", max_length=40)
    revision: int

    @field_validator("entity_id")
    @classmethod
    def validate_entity_id(cls, value: str) -> str:
        if not UUID_PATTERN.fullmatch(value):
            raise ValueError("entity_id")
        return value

    @field_validator("deleted_at")
    @classmethod
    def validate_deleted_at(cls, value: str) -> str:
        return _valid_timestamp(value)

    @field_validator("revision")
    @classmethod
    def validate_revision(cls, value: int) -> int:
        return _safe_integer(value, positive=True)


class ApplyRemoteMutationRequest(StrictModel):
    protocol_version: Literal[1] = Field(alias="protocolVersion")
    mutation_id: str = Field(alias="mutationId", max_length=64)
    idempotency_key: str = Field(alias="idempotencyKey", max_length=70)
    namespace_fingerprint: str = Field(alias="namespaceFingerprint", max_length=64)
    generation_id: str = Field(alias="generationId", max_length=128)
    domain: Literal["notes"]
    entity_id: str = Field(alias="entityId", max_length=64)
    operation: Literal["upsert", "tombstone"]
    base_revision: int | None = Field(alias="baseRevision")
    local_revision: int = Field(alias="localRevision")
    payload: EntitySnapshotPayload | TombstonePayload = Field(discriminator="kind")
    created_at: str = Field(alias="createdAt", max_length=40)

    @field_validator("mutation_id")
    @classmethod
    def validate_mutation_id(cls, value: str) -> str:
        if not MUTATION_ID_PATTERN.fullmatch(value):
            raise ValueError("mutation_id")
        return value

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key(cls, value: str) -> str:
        if not IDEMPOTENCY_PATTERN.fullmatch(value):
            raise ValueError("idempotency_key")
        return value

    @field_validator("namespace_fingerprint")
    @classmethod
    def validate_fingerprint(cls, value: str) -> str:
        if not FINGERPRINT_PATTERN.fullmatch(value):
            raise ValueError("namespace_fingerprint")
        return value

    @field_validator("generation_id")
    @classmethod
    def validate_generation(cls, value: str) -> str:
        if not SAFE_IDENTIFIER.fullmatch(value):
            raise ValueError("generation_id")
        return value

    @field_validator("entity_id")
    @classmethod
    def validate_entity_id(cls, value: str) -> str:
        if not UUID_PATTERN.fullmatch(value):
            raise ValueError("entity_id")
        return value

    @field_validator("created_at")
    @classmethod
    def validate_created_at(cls, value: str) -> str:
        return _valid_timestamp(value)

    @field_validator("base_revision")
    @classmethod
    def validate_base_revision(cls, value: int | None) -> int | None:
        if value is not None:
            return _safe_integer(value, positive=True)
        return value

    @field_validator("local_revision")
    @classmethod
    def validate_local_revision(cls, value: int) -> int:
        return _safe_integer(value, positive=True)

    @model_validator(mode="after")
    def validate_relationships(self) -> "ApplyRemoteMutationRequest":
        if self.base_revision is None:
            if self.operation != "upsert" or self.local_revision != 1:
                raise ValueError("revision_relationship")
        elif self.local_revision != self.base_revision + 1:
            raise ValueError("revision_relationship")
        if self.operation == "upsert":
            if not isinstance(self.payload, EntitySnapshotPayload) or self.payload.record.id != self.entity_id:
                raise ValueError("payload_relationship")
        else:
            if not isinstance(self.payload, TombstonePayload):
                raise ValueError("payload_relationship")
            if self.payload.entity_id != self.entity_id or self.payload.revision != self.local_revision:
                raise ValueError("payload_relationship")
        if len(canonical_json(self.payload.model_dump(by_alias=True, exclude_none=False))) > MAX_CANONICAL_PAYLOAD_BYTES:
            raise ValueError("payload_size")
        return self


class ApplyRemoteMutationResponse(StrictModel):
    protocol_version: Literal[1] = Field(default=1, alias="protocolVersion")
    outcome: RemoteOutcome
    mutation_id: str = Field(alias="mutationId", max_length=64)
    idempotency_key: str = Field(alias="idempotencyKey", max_length=70)
    remote_mutation_ref: str | None = Field(alias="remoteMutationRef", max_length=64)
    applied_revision: int | None = Field(alias="appliedRevision")
    server_committed_at: str | None = Field(alias="serverCommittedAt", max_length=40)
    error_code: str | None = Field(alias="errorCode", max_length=64)
    retryable: bool

    @model_validator(mode="after")
    def validate_response(self) -> "ApplyRemoteMutationResponse":
        if self.mutation_id != "mut.invalid" and not MUTATION_ID_PATTERN.fullmatch(self.mutation_id):
            raise ValueError("mutation_id")
        if not IDEMPOTENCY_PATTERN.fullmatch(self.idempotency_key):
            raise ValueError("idempotency_key")
        if self.remote_mutation_ref is not None and not UUID_PATTERN.fullmatch(self.remote_mutation_ref):
            raise ValueError("remote_mutation_ref")
        if self.applied_revision is not None:
            _safe_integer(self.applied_revision, positive=True)
        if self.server_committed_at is not None:
            _valid_timestamp(self.server_committed_at)
        if self.error_code is not None and not re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", self.error_code):
            raise ValueError("error_code")
        if self.outcome == "applied":
            if (self.remote_mutation_ref is None or self.applied_revision is None or self.server_committed_at is None
                    or self.error_code is not None or self.retryable):
                raise ValueError("applied_response")
        elif (self.remote_mutation_ref is not None or self.applied_revision is not None or self.server_committed_at is not None
                or self.error_code is None):
            raise ValueError("rejected_response")
        return self


def canonical_json(value: Any) -> bytes:
    """Canonical JSON for validated protocol values.

    Object keys are sorted, arrays retain order, omitted optional model values are
    normalized to explicit null before this function, and non-finite/floating
    values are rejected to avoid cross-runtime numeric ambiguity.
    """

    def inspect(item: Any) -> None:
        if item is None or isinstance(item, (str, bool)):
            return
        if isinstance(item, int) and not isinstance(item, bool):
            _safe_integer(item)
            return
        if isinstance(item, float):
            if not math.isfinite(item):
                raise ValueError("non_finite_number")
            raise ValueError("floating_number")
        if isinstance(item, list):
            for child in item:
                inspect(child)
            return
        if isinstance(item, dict) and all(isinstance(key, str) for key in item):
            for key in sorted(item):
                inspect(item[key])
            return
        raise ValueError("unsupported_json_value")

    inspect(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def derive_idempotency_key(request: ApplyRemoteMutationRequest) -> str:
    encoded = json.dumps([
        "absinthe-outbox-v1",
        request.namespace_fingerprint,
        request.generation_id,
        request.domain,
        request.entity_id,
        request.local_revision,
        request.operation,
    ], ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return f"k322.{hashlib.sha256(encoded).hexdigest()}"


def derive_request_digest(request: ApplyRemoteMutationRequest, owner_id: str, project_scope: str) -> tuple[str, str]:
    payload_bytes = canonical_json(request.payload.model_dump(by_alias=True, exclude_none=False))
    payload_digest = hashlib.sha256(payload_bytes).hexdigest()
    semantics = [
        "absinthe-remote-mutation-v1", request.protocol_version, owner_id, project_scope,
        request.namespace_fingerprint, request.generation_id, request.domain, request.entity_id,
        request.mutation_id, request.operation, request.base_revision, request.local_revision, payload_digest,
    ]
    return hashlib.sha256(canonical_json(semantics)).hexdigest(), payload_digest


class RemoteMutationGateway(Protocol):
    def apply(self, parameters: dict[str, Any]) -> dict[str, Any]: ...


class SupabaseRpcGateway:
    def __init__(self, client: Any) -> None:
        self._client = client

    def apply(self, parameters: dict[str, Any]) -> dict[str, Any]:
        result = self._client.rpc("apply_remote_note_mutation_v1", parameters).execute().data
        if not isinstance(result, dict):
            raise RuntimeError("invalid_rpc_response")
        return result


class RemoteMutationTransportError(RuntimeError):
    def __init__(self, response: ApplyRemoteMutationResponse) -> None:
        super().__init__("remote_mutation_transport")
        self.response = response


def rejected_response(
    mutation_id: str,
    idempotency_key: str,
    error_code: str,
    *,
    retryable: bool = False,
    outcome: RemoteOutcome = "rejected",
) -> ApplyRemoteMutationResponse:
    return ApplyRemoteMutationResponse.model_validate({
        "protocolVersion": 1, "outcome": outcome, "mutationId": mutation_id,
        "idempotencyKey": idempotency_key, "remoteMutationRef": None,
        "appliedRevision": None, "serverCommittedAt": None,
        "errorCode": error_code, "retryable": retryable,
    })


class RemoteMutationService:
    def __init__(self, gateway: RemoteMutationGateway, project_scope: str) -> None:
        if not SAFE_IDENTIFIER.fullmatch(project_scope):
            raise ValueError("invalid_project_scope")
        self._gateway = gateway
        self._project_scope = project_scope

    def parse(self, raw: Any) -> ApplyRemoteMutationRequest:
        try:
            return ApplyRemoteMutationRequest.model_validate(raw)
        except (ValidationError, ValueError) as error:
            raise ValueError("INVALID_MUTATION") from error

    def apply(self, request: ApplyRemoteMutationRequest, owner_id: str) -> ApplyRemoteMutationResponse:
        if not UUID_PATTERN.fullmatch(owner_id):
            return rejected_response(request.mutation_id, request.idempotency_key, "UNAUTHORIZED_SCOPE")
        expected = derive_idempotency_key(request)
        if request.idempotency_key != expected:
            return rejected_response(request.mutation_id, request.idempotency_key, "IDEMPOTENCY_KEY_MISMATCH")
        request_digest, payload_digest = derive_request_digest(request, owner_id, self._project_scope)
        parameters = {
            "p_authenticated_owner_id": owner_id,
            "p_project_scope": self._project_scope,
            "p_namespace_fingerprint": request.namespace_fingerprint,
            "p_generation_id": request.generation_id,
            "p_domain": request.domain,
            "p_entity_id": request.entity_id,
            "p_mutation_id": request.mutation_id,
            "p_idempotency_key": request.idempotency_key,
            "p_operation": request.operation,
            "p_base_revision": request.base_revision,
            "p_local_revision": request.local_revision,
            "p_payload": request.payload.model_dump(by_alias=True, exclude_none=False),
            "p_payload_digest": payload_digest,
            "p_request_digest": request_digest,
            "p_created_at": request.created_at,
        }
        try:
            raw_response = self._gateway.apply(parameters)
            return ApplyRemoteMutationResponse.model_validate(raw_response)
        except Exception as error:
            response = rejected_response(
                request.mutation_id, request.idempotency_key, "TRANSACTION_FAILED", retryable=True,
            )
            raise RemoteMutationTransportError(response) from error
