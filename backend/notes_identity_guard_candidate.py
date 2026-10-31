"""Disconnected 01B candidate. Not imported by main and contains no DB transport.

Prerequisite flags describe missing future integration evidence; they are NOT
authentication or deployment attestations. Even a fully populated request is
denied. No environment variable or existing K-323 flag activates this module.
"""
from __future__ import annotations

from dataclasses import dataclass, fields
from typing import Literal
from uuid import UUID


Operation = Literal[
    "publish", "retire", "legacy_post", "legacy_delete", "folder_detach",
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
