"""Disconnected 01B candidate. Not imported by main and contains no DB transport.

Prerequisite flags describe missing future integration evidence; they are NOT
authentication or deployment attestations. Even a fully populated request is
denied. No environment variable or existing K-323 flag activates this module.
"""
from __future__ import annotations

from dataclasses import dataclass, fields
from hashlib import sha256
from typing import Literal
from uuid import UUID


Operation = Literal[
    "reserve", "publish", "retire", "legacy_post", "legacy_delete", "folder_detach",
    "reset", "restore", "k323", "account_termination",
]
OPERATIONS = frozenset(Operation.__args__)


@dataclass(frozen=True)
class Prerequisites:
    authenticated_owner_binding: bool = False
    deployed_schema: bool = False
    deployed_roles: bool = False
    existing_identity_registration: bool = False
    legacy_mutations: bool = False
    k323_enforcement: bool = False
    reset_restore: bool = False
    account_termination: bool = False


@dataclass(frozen=True)
class AccountContext:
    owner_id: str
    generation: int


@dataclass(frozen=True)
class Denial:
    code: str
    missing: tuple[str, ...] = ()

    @property
    def allowed(self) -> bool:
        return False


def supported_snapshot(payload: object) -> bool:
    """Deliberately narrow: reject extra metadata, never remove or normalize it."""
    return (
        type(payload) is dict
        and set(payload) == {"title", "body", "updated_at", "starred"}
        and type(payload["title"]) is str
        and type(payload["body"]) is str
        and type(payload["starred"]) is bool
        and type(payload["updated_at"]) is int
        and 0 <= payload["updated_at"] <= 9007199254740991
    )


def _valid_context(context: AccountContext | None) -> bool:
    if not isinstance(context, AccountContext):
        return False
    try:
        owner = UUID(context.owner_id)
    except (ValueError, TypeError, AttributeError):
        return False
    return (
        str(owner) == context.owner_id and owner.int != 0
        and type(context.generation) is int and context.generation > 0
    )


def assess_candidate(
    operation: Operation,
    captured: AccountContext | None,
    current: AccountContext | None,
    prerequisites: Prerequisites = Prerequisites(),
    *,
    note_id: str | None = None,
    operation_id: str | None = None,
    payload: object = None,
    provenance: str | None = None,
    persistence_complete: bool = False,
) -> Denial:
    """Future adapter preflight, never an authorization or an executable plan.

    A caller-supplied provenance string cannot establish historical freshness.
    It is checked only to identify missing evidence in this disabled candidate.
    Account generations model the A/B/A fence; production authority is unproven.
    """
    if operation not in OPERATIONS:
        return Denial("UNSUPPORTED_OPERATION")
    if not _valid_context(captured) or not _valid_context(current):
        return Denial("ACCOUNT_AUTHORITY_UNAVAILABLE")
    if captured != current:
        return Denial("STALE_ACCOUNT_AUTHORITY")
    if not isinstance(prerequisites, Prerequisites):
        return Denial("PREREQUISITES_UNAVAILABLE")
    missing = tuple(f.name for f in fields(prerequisites) if getattr(prerequisites, f.name) is not True)
    if missing:
        return Denial("PREREQUISITES_UNVERIFIED", missing)
    if operation == "reserve" and any(value is not None for value in (note_id, payload, provenance)):
        # The SQL issuer derives owner from its private authenticated principal
        # and generates an ID. Existing/local IDs are never admitted here.
        return Denial("CLIENT_RESERVATION_INPUT_FORBIDDEN")
    if operation in {"publish", "retire"}:
        if type(note_id) is not str or not note_id.strip() or type(operation_id) is not str or not operation_id.strip():
            return Denial("INVALID_OPERATION_IDENTITY")
    if operation == "publish":
        if provenance != "trusted_reservation":
            return Denial("IDENTITY_PROVENANCE_UNPROVEN")
        if persistence_complete is not True:
            return Denial("LOCAL_PERSISTENCE_INCOMPLETE")
        if not supported_snapshot(payload):
            return Denial("UNSUPPORTED_CONTENT")
    # No transport, token, SQL call, permit or legacy fallback is returned.
    return Denial("CANDIDATE_NOT_ACTIVATED")


@dataclass(frozen=True)
class IdentityObservation:
    """Internal ledger observation, NOT client provenance or an admission token.

    There is no live reader/issuer here. A future authenticated DB adapter must
    obtain and revalidate this evidence inside its mutation transaction.
    """
    note_id: str
    owner_id: str
    state: Literal["RESERVED", "LIVE", "RETIRED"]


@dataclass(frozen=True)
class PostAssessment:
    """Diagnostic classification only; never an executable write plan/permit."""
    classification: str
    denial: Denial

    @property
    def allowed(self) -> bool:
        return False


def assess_post_candidate(
    *,
    authenticated_owner: str,
    captured: AccountContext | None,
    current: AccountContext | None,
    note_id: str,
    operation_id: str | None,
    payload: object,
    owned_row: object,
    identity: IdentityObservation | None,
    prerequisites: Prerequisites = Prerequisites(),
    persistence_complete: bool = False,
) -> PostAssessment:
    """Disconnected backend POST seam: classify intent, then ALWAYS deny.

    authenticated_owner must come from existing verified backend authentication,
    never the request body. Context/ledger inputs are internal observations, not
    proof of authority just because Python callers can construct them. No env or
    client switch activates this function. main's existing POST is unchanged.

    A future adapter MUST atomically check account generation, ledger state and
    row ownership at the actual DB write. These separate observations cannot
    authorize writes, including an UPDATE. The merged SQL has create-only
    publication receipts, but no guarded UPDATE transaction; do not improvise one
    or route a failed UPDATE through publish/legacy INSERT.
    """
    def deny(kind: str, code: str) -> PostAssessment:
        return PostAssessment(kind, Denial(code))

    if not _valid_context(captured) or not _valid_context(current):
        return deny("account_unavailable", "ACCOUNT_AUTHORITY_UNAVAILABLE")
    if authenticated_owner != captured.owner_id or authenticated_owner != current.owner_id:
        return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
    if captured != current:
        return deny("stale_account", "STALE_ACCOUNT_AUTHORITY")
    if type(note_id) is not str or not note_id.strip() or type(operation_id) is not str or not operation_id.strip():
        return deny("invalid_request", "INVALID_OPERATION_IDENTITY")
    readiness = assess_candidate("legacy_post", captured, current, prerequisites)
    if readiness.code != "CANDIDATE_NOT_ACTIVATED":
        return PostAssessment("enforcement_unavailable", Denial("DATABASE_ENFORCEMENT_UNAVAILABLE", readiness.missing))
    # Reuse the exact existing four-field payload contract. No metadata stripping,
    # fallback schema retry or client owner/provenance fields are accepted here.
    if not supported_snapshot(payload):
        return deny("unsupported_content", "UNSUPPORTED_CONTENT")
    if owned_row is not None:
        if type(owned_row) is not dict or owned_row.get("id") != note_id:
            return deny("state_conflict", "NOTE_OBSERVATION_INVALID")
        if owned_row.get("user_id") != authenticated_owner:
            return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
    if identity is None:
        # Neither an absent row nor an existing unregistered legacy row proves
        # historical identity. Never turn this into a new reservation/INSERT.
        return deny("unknown_historical", "IDENTITY_PROVENANCE_UNPROVEN")
    if not isinstance(identity, IdentityObservation) or identity.note_id != note_id:
        return deny("enforcement_unavailable", "IDENTITY_OBSERVATION_INVALID")
    if identity.owner_id != authenticated_owner:
        return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
    if identity.state == "RETIRED":
        return deny("retired_identity", "IDENTITY_RETIRED")
    if identity.state == "LIVE":
        if owned_row is None:
            return deny("state_conflict", "LIVE_NOTE_MISSING")
        return PostAssessment("existing_update", readiness)
    if identity.state == "RESERVED":
        if owned_row is not None:
            return deny("state_conflict", "RESERVED_NOTE_ALREADY_EXISTS")
        return PostAssessment("initial_publication", assess_candidate(
            "publish", captured, current, prerequisites,
            note_id=note_id, operation_id=operation_id, payload=payload,
            provenance="trusted_reservation", persistence_complete=persistence_complete,
        ))
    return deny("enforcement_unavailable", "IDENTITY_OBSERVATION_INVALID")


@dataclass(frozen=True)
class DeleteAssessment:
    """Diagnostic only: no deletion/retirement success, transport or permit."""
    classification: str
    denial: Denial

    @property
    def allowed(self) -> bool:
        return False


def assess_delete_candidate(
    *,
    authenticated_owner: str,
    captured: AccountContext | None,
    current: AccountContext | None,
    note_id: str,
    operation_id: str | None,
    owned_row: object,
    identity: IdentityObservation | None,
    receipt: object = None,
    prerequisites: Prerequisites = Prerequisites(),
) -> DeleteAssessment:
    """Disconnected DELETE assessment; every outcome is denied.

    Owner/context, row, ledger and optional receipt are INTERNAL observations,
    not request-body authority. No reader/transport/activation is supplied here.
    Even matching observations are not atomic proof or successful replay.
    A future adapter must revalidate authenticated account generation, identity,
    row ownership and the exact operation receipt in ONE retirement transaction.
    Never delete then retire, fall back to legacy DELETE, or report success from
    remote absence / RETIRED / an ALREADY_RETIRED SQL status alone.
    """
    def deny(kind: str, code: str) -> DeleteAssessment:
        return DeleteAssessment(kind, Denial(code))

    if not _valid_context(captured) or not _valid_context(current):
        return deny("account_unavailable", "ACCOUNT_AUTHORITY_UNAVAILABLE")
    if authenticated_owner != captured.owner_id or authenticated_owner != current.owner_id:
        return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
    if captured != current:
        return deny("stale_account", "STALE_ACCOUNT_AUTHORITY")
    if type(note_id) is not str or not note_id.strip() or type(operation_id) is not str or not operation_id.strip():
        return deny("invalid_request", "INVALID_OPERATION_IDENTITY")
    readiness = assess_candidate("retire", captured, current, prerequisites,
                                 note_id=note_id, operation_id=operation_id)
    if readiness.code != "CANDIDATE_NOT_ACTIVATED":
        return DeleteAssessment("enforcement_unavailable", Denial("DATABASE_ENFORCEMENT_UNAVAILABLE", readiness.missing))
    if owned_row is not None:
        if type(owned_row) is not dict or owned_row.get("id") != note_id:
            return deny("state_conflict", "NOTE_OBSERVATION_INVALID")
        if owned_row.get("user_id") != authenticated_owner:
            return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
    if identity is None:
        return deny("unknown_historical", "IDENTITY_PROVENANCE_UNPROVEN")
    if not isinstance(identity, IdentityObservation) or identity.note_id != note_id:
        return deny("enforcement_unavailable", "IDENTITY_OBSERVATION_INVALID")
    if identity.owner_id != authenticated_owner:
        return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
    if receipt is not None:
        if type(receipt) is not dict:
            return deny("enforcement_unavailable", "RECEIPT_OBSERVATION_INVALID")
        if receipt.get("owner_id") != authenticated_owner:
            return deny("account_mismatch", "ACCOUNT_AUTHORITY_MISMATCH")
        # Match the existing SQL receipt fields without normalizing or mutating
        # the observation. This check is diagnostic, NOT DB replay admission.
        if (receipt.get("note_id") != note_id or receipt.get("operation_id") != operation_id
                or receipt.get("kind") != "retire" or receipt.get("payload") != {}
                or receipt.get("digest") != sha256(b"{}").hexdigest()):
            return deny("operation_conflict", "OPERATION_CONFLICT")
    if identity.state == "RETIRED":
        if owned_row is not None:
            return deny("state_conflict", "RETIRED_NOTE_PRESENT")
        if receipt is None:
            return deny("retired_identity", "RETIREMENT_RECEIPT_UNPROVEN")
        return DeleteAssessment("retired_identity", readiness)
    if identity.state == "LIVE":
        if owned_row is None:
            return deny("state_conflict", "LIVE_NOTE_MISSING")
        kind = "live_retirement"
    elif identity.state == "RESERVED":
        if owned_row is not None:
            return deny("state_conflict", "RESERVED_NOTE_ALREADY_EXISTS")
        kind = "reserved_retirement"
    else:
        return deny("enforcement_unavailable", "IDENTITY_OBSERVATION_INVALID")
    if receipt is not None:
        return deny("state_conflict", "RETIREMENT_RESULT_INDETERMINATE")
    return DeleteAssessment(kind, readiness)
