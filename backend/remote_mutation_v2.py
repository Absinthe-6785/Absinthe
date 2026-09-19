"""Dormant K-323 v2 authenticated multi-domain sync transport.

The service owns protocol validation, explicit domain dispatch, wire-level
canonical hashing, and authenticated-owner binding.  PostgreSQL owns the
atomic CAS/entity/change/receipt transaction.  Only bounded reference domains
are registered here; production Notes and Health authority are deliberately
not connected in REL-05E.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from remote_mutation import MAX_CANONICAL_PAYLOAD_BYTES, MAX_REQUEST_BYTES, MAX_SAFE_INTEGER

V2_PROTOCOL_VERSION = 2
V2_DOMAINS = ("reference_alpha", "reference_beta")
MAX_PULL_CHANGES = 500
SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I
)
MUTATION_ID_PATTERN = re.compile(
    r"^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I
)
IDEMPOTENCY_PATTERN = re.compile(r"^k322\.[a-f0-9]{64}$")
DIGEST_PATTERN = re.compile(r"^[a-f0-9]{64}$")
SECRET_KEY = re.compile(
    r"^(?:authorization|cookie|password|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token)$", re.I
)
BEARER_VALUE = re.compile(r"^bearer\s+", re.I)
JWT_VALUE = re.compile(r"^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")

V2Operation = Literal["upsert", "tombstone", "restore"]
V2Outcome = Literal["applied", "revision_conflict", "rejected"]
V2PullStatus = Literal["changes", "full_resync_required", "rejected"]


def _safe_integer(value: int, *, positive: bool = False) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or abs(value) > MAX_SAFE_INTEGER:
        raise ValueError("unsafe_integer")
    if positive and value < 1:
        raise ValueError("unsafe_integer")
    return value


def _valid_timestamp(value: str) -> str:
    if len(value) > 40:
        raise ValueError("timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=False, strict=True)


class ReferenceAlphaRecord(StrictModel):
    id: str = Field(max_length=128)
    label: str = Field(max_length=1_024)
    ordinal: int

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not UUID_PATTERN.fullmatch(value):
            raise ValueError("id")
        return value

    @field_validator("ordinal")
    @classmethod
    def validate_ordinal(cls, value: int) -> int:
        return _safe_integer(value)


class ReferenceBetaRecord(StrictModel):
    id: str = Field(max_length=128)
    metric: str = Field(max_length=128)
    value: int
    observed_at: str = Field(alias="observedAt", max_length=40)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not UUID_PATTERN.fullmatch(value):
            raise ValueError("id")
        return value

    @field_validator("metric")
    @classmethod
    def validate_metric(cls, value: str) -> str:
        if not SAFE_IDENTIFIER.fullmatch(value):
            raise ValueError("metric")
        return value

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: int) -> int:
        return _safe_integer(value)

    @field_validator("observed_at")
    @classmethod
    def validate_observed_at(cls, value: str) -> str:
        return _valid_timestamp(value)


class DomainHandler(Protocol):
    domain: str
    supports_restore: bool

    def validate_record(self, entity_id: str, record: Any) -> dict[str, Any]: ...


class ModelDomainHandler:
    def __init__(self, domain: str, model: type[StrictModel], *, supports_restore: bool) -> None:
        self.domain = domain
        self.model = model
        self.supports_restore = supports_restore

    def validate_record(self, entity_id: str, record: Any) -> dict[str, Any]:
        parsed = self.model.model_validate(record)
        value = parsed.model_dump(by_alias=True, exclude_none=False)
        if value.get("id") != entity_id:
            raise ValueError("entity_record_mismatch")
        return value


V2_DOMAIN_HANDLERS: dict[str, DomainHandler] = {
    "reference_alpha": ModelDomainHandler("reference_alpha", ReferenceAlphaRecord, supports_restore=True),
    "reference_beta": ModelDomainHandler("reference_beta", ReferenceBetaRecord, supports_restore=True),
}


def canonical_payload_bytes(value: Any) -> bytes:
    """Canonical v2 wire JSON shared with the REL-05D canonical payload contract.

    V2 narrows wire numbers to JavaScript-safe integers so Python and browser
    encoders cannot disagree about floating-point spellings.  Reference-domain
    records use ASCII schema keys; object keys sort lexicographically and arrays
    retain order.  Secret-bearing keys and token-shaped strings fail closed.
    """

    def inspect(item: Any, depth: int) -> None:
        if depth > 64:
            raise ValueError("payload_depth")
        if item is None or isinstance(item, bool):
            return
        if isinstance(item, str):
            if BEARER_VALUE.match(item) or JWT_VALUE.match(item):
                raise ValueError("persisted_secret_value")
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
                inspect(child, depth + 1)
            return
        if isinstance(item, dict) and all(isinstance(key, str) for key in item):
            for key in sorted(item):
                if SECRET_KEY.fullmatch(key):
                    raise ValueError("persisted_secret_key")
                inspect(item[key], depth + 1)
            return
        raise ValueError("unsupported_json_value")

    inspect(value, 0)
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(encoded) > MAX_CANONICAL_PAYLOAD_BYTES:
        raise ValueError("payload_size")
    return encoded


def payload_hash(value: Any) -> str:
    return hashlib.sha256(canonical_payload_bytes(value)).hexdigest()


class ApplyRemoteMutationV2Request(StrictModel):
    protocol_version: Literal[2] = Field(alias="protocolVersion")
    mutation_id: str = Field(alias="mutationId", max_length=64)
    idempotency_key: str = Field(alias="idempotencyKey", max_length=70)
    namespace_key: str = Field(alias="namespaceKey", max_length=64)
    generation_id: str = Field(alias="generationId", max_length=128)
    device_id: str = Field(alias="deviceId", max_length=128)
    domain: str = Field(max_length=128)
    entity_id: str = Field(alias="entityId", max_length=128)
    operation: V2Operation
    base_revision: int | None = Field(alias="baseRevision")
    local_revision: int = Field(alias="localRevision")
    payload: dict[str, Any]
    payload_hash: str = Field(alias="payloadHash", max_length=64)
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

    @field_validator("namespace_key", "payload_hash")
    @classmethod
    def validate_digest(cls, value: str) -> str:
        if not DIGEST_PATTERN.fullmatch(value):
            raise ValueError("digest")
        return value

    @field_validator("generation_id", "device_id", "domain")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        if not SAFE_IDENTIFIER.fullmatch(value):
            raise ValueError("identifier")
        return value

    @field_validator("entity_id")
    @classmethod
    def validate_entity_id(cls, value: str) -> str:
        if not UUID_PATTERN.fullmatch(value):
            raise ValueError("entity_id")
        return value

    @field_validator("base_revision")
    @classmethod
    def validate_base_revision(cls, value: int | None) -> int | None:
        return _safe_integer(value, positive=True) if value is not None else value

    @field_validator("local_revision")
    @classmethod
    def validate_local_revision(cls, value: int) -> int:
        return _safe_integer(value, positive=True)

    @field_validator("created_at")
    @classmethod
    def validate_created_at(cls, value: str) -> str:
        return _valid_timestamp(value)

    @model_validator(mode="after")
    def validate_payload_relationship(self) -> "ApplyRemoteMutationV2Request":
        canonical_payload_bytes(self.payload)
        kind = self.payload.get("kind")
        if self.operation in {"upsert", "restore"}:
            record = self.payload.get("record")
            if kind != "entity_snapshot" or not isinstance(record, dict) or record.get("id") != self.entity_id:
                raise ValueError("payload_relationship")
        else:
            if (kind != "tombstone" or self.payload.get("entityId") != self.entity_id
                    or self.payload.get("revision") != self.local_revision):
                raise ValueError("payload_relationship")
            deleted_at = self.payload.get("deletedAt")
            if not isinstance(deleted_at, str):
                raise ValueError("payload_relationship")
            _valid_timestamp(deleted_at)
        return self


class ApplyRemoteMutationV2Response(StrictModel):
    protocol_version: Literal[2] = Field(default=2, alias="protocolVersion")
    outcome: V2Outcome
    mutation_id: str = Field(alias="mutationId", max_length=64)
    idempotency_key: str = Field(alias="idempotencyKey", max_length=70)
    domain: str | None = Field(default=None, max_length=128)
    entity_id: str | None = Field(default=None, alias="entityId", max_length=128)
    operation: V2Operation | None = None
    payload_hash: str | None = Field(default=None, alias="payloadHash", max_length=64)
    remote_mutation_ref: str | None = Field(alias="remoteMutationRef", max_length=64)
    server_revision: int | None = Field(alias="serverRevision")
    change_sequence: int | None = Field(alias="changeSequence")
    server_committed_at: str | None = Field(alias="serverCommittedAt", max_length=40)
    error_code: str | None = Field(alias="errorCode", max_length=64)
    retryable: bool

    @model_validator(mode="after")
    def validate_response(self) -> "ApplyRemoteMutationV2Response":
        if self.mutation_id != "mut.invalid" and not MUTATION_ID_PATTERN.fullmatch(self.mutation_id):
            raise ValueError("mutation_id")
        if not IDEMPOTENCY_PATTERN.fullmatch(self.idempotency_key):
            raise ValueError("idempotency_key")
        if self.payload_hash is not None and not DIGEST_PATTERN.fullmatch(self.payload_hash):
            raise ValueError("payload_hash")
        if self.remote_mutation_ref is not None and not UUID_PATTERN.fullmatch(self.remote_mutation_ref):
            raise ValueError("remote_mutation_ref")
        if self.server_revision is not None:
            _safe_integer(self.server_revision, positive=True)
        if self.change_sequence is not None:
            _safe_integer(self.change_sequence, positive=True)
        if self.server_committed_at is not None:
            _valid_timestamp(self.server_committed_at)
        if self.error_code is not None and not re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", self.error_code):
            raise ValueError("error_code")
        complete_identity = all((self.domain, self.entity_id, self.operation, self.payload_hash))
        if self.outcome == "applied":
            if (not complete_identity or self.remote_mutation_ref is None or self.server_revision is None
                    or self.change_sequence is None or self.server_committed_at is None
                    or self.error_code is not None or self.retryable):
                raise ValueError("applied_response")
        elif (self.remote_mutation_ref is not None or self.server_revision is not None
                or self.change_sequence is not None or self.server_committed_at is not None or self.error_code is None):
            raise ValueError("rejected_response")
        return self


class PullChangesV2Request(StrictModel):
    protocol_version: Literal[2] = Field(alias="protocolVersion")
    namespace_key: str = Field(alias="namespaceKey", max_length=64)
    generation_id: str = Field(alias="generationId", max_length=128)
    domain: str = Field(max_length=128)
    cursor: int = 0
    server_epoch: str | None = Field(default=None, alias="serverEpoch", max_length=64)
    limit: int = 100

    @field_validator("namespace_key")
    @classmethod
    def validate_namespace(cls, value: str) -> str:
        if not DIGEST_PATTERN.fullmatch(value):
            raise ValueError("namespace")
        return value

    @field_validator("generation_id", "domain")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        if not SAFE_IDENTIFIER.fullmatch(value):
            raise ValueError("identifier")
        return value

    @field_validator("cursor")
    @classmethod
    def validate_cursor(cls, value: int) -> int:
        _safe_integer(value)
        if value < 0:
            raise ValueError("cursor")
        return value

    @field_validator("server_epoch")
    @classmethod
    def validate_epoch(cls, value: str | None) -> str | None:
        if value is not None and not UUID_PATTERN.fullmatch(value):
            raise ValueError("server_epoch")
        return value

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, value: int) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value < 1 or value > MAX_PULL_CHANGES:
            raise ValueError("limit")
        return value


class RemoteChangeV2(StrictModel):
    sequence: int
    domain: str
    entity_id: str = Field(alias="entityId")
    operation: V2Operation
    server_revision: int = Field(alias="serverRevision")
    record: dict[str, Any]
    is_deleted: bool = Field(alias="isDeleted")
    deleted_at: str | None = Field(alias="deletedAt")
    remote_mutation_ref: str = Field(alias="remoteMutationRef")
    server_committed_at: str = Field(alias="serverCommittedAt")

    @model_validator(mode="after")
    def validate_change(self) -> "RemoteChangeV2":
        _safe_integer(self.sequence, positive=True)
        _safe_integer(self.server_revision, positive=True)
        if not SAFE_IDENTIFIER.fullmatch(self.domain) or not UUID_PATTERN.fullmatch(self.entity_id):
            raise ValueError("change_identity")
        if not UUID_PATTERN.fullmatch(self.remote_mutation_ref):
            raise ValueError("remote_mutation_ref")
        _valid_timestamp(self.server_committed_at)
        if self.deleted_at is not None:
            _valid_timestamp(self.deleted_at)
        if self.is_deleted != (self.deleted_at is not None):
            raise ValueError("deletion_state")
        if (self.operation == "tombstone") != self.is_deleted:
            raise ValueError("operation_deletion_state")
        canonical_payload_bytes(self.record)
        return self


class PullChangesV2Response(StrictModel):
    protocol_version: Literal[2] = Field(default=2, alias="protocolVersion")
    status: V2PullStatus
    domain: str
    server_epoch: str = Field(alias="serverEpoch")
    retention_floor: int = Field(alias="retentionFloor")
    next_cursor: int = Field(alias="nextCursor")
    changes: list[RemoteChangeV2] = Field(max_length=MAX_PULL_CHANGES)
    error_code: str | None = Field(default=None, alias="errorCode")

    @model_validator(mode="after")
    def validate_pull(self) -> "PullChangesV2Response":
        if not SAFE_IDENTIFIER.fullmatch(self.domain) or not UUID_PATTERN.fullmatch(self.server_epoch):
            raise ValueError("pull_identity")
        _safe_integer(self.retention_floor)
        _safe_integer(self.next_cursor)
        if self.retention_floor < 0 or self.next_cursor < 0:
            raise ValueError("cursor")
        sequences = [change.sequence for change in self.changes]
        if sequences != sorted(sequences) or len(sequences) != len(set(sequences)):
            raise ValueError("change_order")
        if any(change.domain != self.domain for change in self.changes):
            raise ValueError("domain_mismatch")
        if self.status == "full_resync_required":
            if self.changes or self.error_code not in {"CURSOR_INVALID", "SERVER_EPOCH_MISMATCH"}:
                raise ValueError("full_resync")
        elif self.status == "rejected":
            if self.changes or self.error_code not in {"UNKNOWN_GENERATION", "STALE_GENERATION"}:
                raise ValueError("rejected_pull")
        elif self.error_code is not None:
            raise ValueError("changes_error")
        return self


def _identity_tuple(request: ApplyRemoteMutationV2Request) -> list[Any]:
    return [
        request.namespace_key, request.generation_id, request.domain, request.entity_id,
        request.local_revision, request.operation, request.payload_hash,
    ]


def derive_v2_idempotency_key(request: ApplyRemoteMutationV2Request) -> str:
    encoded = json.dumps(["absinthe-outbox-v2", *_identity_tuple(request)], ensure_ascii=False, separators=(",", ":"))
    return f"k322.{hashlib.sha256(encoded.encode('utf-8')).hexdigest()}"


def derive_v2_mutation_id(request: ApplyRemoteMutationV2Request) -> str:
    encoded = json.dumps(["absinthe-mutation-v2", *_identity_tuple(request)], ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    return f"mut.{digest[:8]}-{digest[8:12]}-5{digest[13:16]}-8{digest[17:20]}-{digest[20:32]}"


def derive_v2_request_digest(request: ApplyRemoteMutationV2Request, owner_id: str, project_scope: str) -> str:
    semantics = [
        "absinthe-remote-mutation-v2", request.protocol_version, owner_id, project_scope,
        request.namespace_key, request.generation_id, request.device_id, request.domain,
        request.entity_id, request.mutation_id, request.idempotency_key, request.operation,
        request.base_revision, request.local_revision, request.payload_hash, request.created_at,
    ]
    return hashlib.sha256(canonical_payload_bytes(semantics)).hexdigest()


class RemoteMutationV2Gateway(Protocol):
    def apply(self, parameters: dict[str, Any]) -> dict[str, Any]: ...
    def pull(self, parameters: dict[str, Any]) -> dict[str, Any]: ...


class SupabaseV2RpcGateway:
    def __init__(self, client: Any) -> None:
        self._client = client

    def apply(self, parameters: dict[str, Any]) -> dict[str, Any]:
        result = self._client.rpc("apply_remote_reference_mutation_v2", parameters).execute().data
        if not isinstance(result, dict):
            raise RuntimeError("invalid_rpc_response")
        return result

    def pull(self, parameters: dict[str, Any]) -> dict[str, Any]:
        result = self._client.rpc("pull_remote_reference_changes_v2", parameters).execute().data
        if not isinstance(result, dict):
            raise RuntimeError("invalid_rpc_response")
        return result


class RemoteMutationV2TransportError(RuntimeError):
    def __init__(self, response: ApplyRemoteMutationV2Response) -> None:
        super().__init__("remote_mutation_v2_transport")
        self.response = response


def rejected_v2_response(
    mutation_id: str,
    idempotency_key: str,
    error_code: str,
    *,
    request: ApplyRemoteMutationV2Request | None = None,
    retryable: bool = False,
    outcome: V2Outcome = "rejected",
) -> ApplyRemoteMutationV2Response:
    return ApplyRemoteMutationV2Response.model_validate({
        "protocolVersion": 2,
        "outcome": outcome,
        "mutationId": mutation_id,
        "idempotencyKey": idempotency_key,
        "domain": request.domain if request else None,
        "entityId": request.entity_id if request else None,
        "operation": request.operation if request else None,
        "payloadHash": request.payload_hash if request else None,
        "remoteMutationRef": None,
        "serverRevision": None,
        "changeSequence": None,
        "serverCommittedAt": None,
        "errorCode": error_code,
        "retryable": retryable,
    })


class RemoteMutationV2Service:
    def __init__(self, gateway: RemoteMutationV2Gateway, project_scope: str) -> None:
        if not SAFE_IDENTIFIER.fullmatch(project_scope):
            raise ValueError("invalid_project_scope")
        self._gateway = gateway
        self._project_scope = project_scope

    def parse_mutation(self, raw: Any) -> ApplyRemoteMutationV2Request:
        try:
            return ApplyRemoteMutationV2Request.model_validate(raw)
        except (ValidationError, ValueError) as error:
            raise ValueError("INVALID_MUTATION") from error

    def parse_pull(self, raw: Any) -> PullChangesV2Request:
        try:
            return PullChangesV2Request.model_validate(raw)
        except (ValidationError, ValueError) as error:
            raise ValueError("INVALID_PULL_REQUEST") from error

    def apply(self, request: ApplyRemoteMutationV2Request, owner_id: str) -> ApplyRemoteMutationV2Response:
        if not UUID_PATTERN.fullmatch(owner_id):
            return rejected_v2_response(request.mutation_id, request.idempotency_key, "UNAUTHORIZED_SCOPE", request=request)
        handler = V2_DOMAIN_HANDLERS.get(request.domain)
        if handler is None:
            return rejected_v2_response(request.mutation_id, request.idempotency_key, "UNKNOWN_DOMAIN", request=request)
        if request.operation == "restore" and not handler.supports_restore:
            return rejected_v2_response(request.mutation_id, request.idempotency_key, "INVALID_OPERATION", request=request)
        if request.operation in {"upsert", "restore"}:
            try:
                handler.validate_record(request.entity_id, request.payload.get("record"))
            except (ValidationError, ValueError):
                return rejected_v2_response(request.mutation_id, request.idempotency_key, "MALFORMED_PAYLOAD", request=request)
        if payload_hash(request.payload) != request.payload_hash:
            return rejected_v2_response(request.mutation_id, request.idempotency_key, "PAYLOAD_HASH_MISMATCH", request=request)
        if derive_v2_idempotency_key(request) != request.idempotency_key:
            return rejected_v2_response(request.mutation_id, request.idempotency_key, "IDEMPOTENCY_KEY_MISMATCH", request=request)
        if derive_v2_mutation_id(request) != request.mutation_id:
            return rejected_v2_response(request.mutation_id, request.idempotency_key, "MUTATION_ID_MISMATCH", request=request)
        parameters = {
            "p_authenticated_owner_id": owner_id,
            "p_project_scope": self._project_scope,
            "p_namespace_fingerprint": request.namespace_key,
            "p_generation_id": request.generation_id,
            "p_device_id": request.device_id,
            "p_domain": request.domain,
            "p_entity_id": request.entity_id,
            "p_mutation_id": request.mutation_id,
            "p_idempotency_key": request.idempotency_key,
            "p_operation": request.operation,
            "p_base_revision": request.base_revision,
            "p_local_revision": request.local_revision,
            "p_payload": request.payload,
            "p_payload_digest": request.payload_hash,
            "p_request_digest": derive_v2_request_digest(request, owner_id, self._project_scope),
            "p_created_at": request.created_at,
        }
        try:
            response = ApplyRemoteMutationV2Response.model_validate(self._gateway.apply(parameters))
        except Exception as error:
            failure = rejected_v2_response(
                request.mutation_id, request.idempotency_key, "TRANSIENT_SERVER_FAILURE",
                request=request, retryable=True,
            )
            raise RemoteMutationV2TransportError(failure) from error
        if any((
            response.mutation_id != request.mutation_id,
            response.idempotency_key != request.idempotency_key,
            response.domain != request.domain,
            response.entity_id != request.entity_id,
            response.operation != request.operation,
            response.payload_hash != request.payload_hash,
        )):
            failure = rejected_v2_response(
                request.mutation_id, request.idempotency_key, "INVALID_SERVER_RESPONSE",
                request=request, retryable=True,
            )
            raise RemoteMutationV2TransportError(failure)
        return response

    def pull(self, request: PullChangesV2Request, owner_id: str) -> PullChangesV2Response:
        if not UUID_PATTERN.fullmatch(owner_id):
            raise ValueError("UNAUTHORIZED_SCOPE")
        if request.domain not in V2_DOMAIN_HANDLERS:
            raise ValueError("UNKNOWN_DOMAIN")
        parameters = {
            "p_authenticated_owner_id": owner_id,
            "p_project_scope": self._project_scope,
            "p_namespace_fingerprint": request.namespace_key,
            "p_generation_id": request.generation_id,
            "p_domain": request.domain,
            "p_cursor": request.cursor,
            "p_server_epoch": request.server_epoch,
            "p_limit": request.limit,
        }
        response = PullChangesV2Response.model_validate(self._gateway.pull(parameters))
        if response.domain != request.domain:
            raise ValueError("INVALID_SERVER_RESPONSE")
        if response.status == "changes":
            if (response.next_cursor < request.cursor
                    or request.server_epoch is not None and response.server_epoch != request.server_epoch
                    or response.changes and (
                        response.changes[0].sequence <= request.cursor
                        or response.changes[-1].sequence != response.next_cursor
                    )
                    or not response.changes and response.next_cursor != request.cursor):
                raise ValueError("INVALID_SERVER_RESPONSE")
            handler = V2_DOMAIN_HANDLERS[request.domain]
            try:
                for change in response.changes:
                    handler.validate_record(change.entity_id, change.record)
            except (ValidationError, ValueError) as error:
                raise ValueError("INVALID_SERVER_RESPONSE") from error
        elif response.status == "full_resync_required":
            if response.next_cursor != response.retention_floor:
                raise ValueError("INVALID_SERVER_RESPONSE")
            if (response.error_code == "SERVER_EPOCH_MISMATCH"
                    and (request.server_epoch is None or response.server_epoch == request.server_epoch)):
                raise ValueError("INVALID_SERVER_RESPONSE")
            if response.error_code == "CURSOR_INVALID" and request.cursor >= response.retention_floor:
                raise ValueError("INVALID_SERVER_RESPONSE")
        elif response.next_cursor != request.cursor:
            raise ValueError("INVALID_SERVER_RESPONSE")
        return response
