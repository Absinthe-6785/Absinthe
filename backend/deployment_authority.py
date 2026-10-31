"""Production deployment and CORS authority for the backend runtime."""

from __future__ import annotations

import re
from collections.abc import Sequence
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


LOCAL_DEVELOPMENT_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

_EXACT_GIT_COMMIT = re.compile(r"[0-9a-fA-F]{40}")


class CorsConfigurationError(ValueError):
    """Raised when trusted browser origins are missing or unsafe."""


def resolve_cors_origins(raw_origins: str | None, *, is_render: bool) -> tuple[str, ...]:
    """Return explicit trusted origins, rejecting wildcard or malformed values.

    Local development keeps a narrow fallback. Render must always receive an
    explicit CORS_ORIGINS value so a missing production setting cannot silently
    produce a browser-inaccessible or overly broad deployment.
    """

    if raw_origins is None:
        if is_render:
            raise CorsConfigurationError("CORS_ORIGINS is required on Render")
        return LOCAL_DEVELOPMENT_ORIGINS

    candidates = [value.strip() for value in raw_origins.split(",")]
    if not candidates or any(not value for value in candidates):
        raise CorsConfigurationError("CORS_ORIGINS must contain only non-empty origins")

    origins: list[str] = []
    for origin in candidates:
        if "*" in origin or any(character.isspace() for character in origin):
            raise CorsConfigurationError(f"unsafe CORS origin: {origin!r}")
        try:
            parsed = urlsplit(origin)
            _ = parsed.port
        except ValueError as error:
            raise CorsConfigurationError(f"malformed CORS origin: {origin!r}") from error
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
            or origin != f"{parsed.scheme}://{parsed.netloc}"
        ):
            raise CorsConfigurationError(f"malformed CORS origin: {origin!r}")
        if origin not in origins:
            origins.append(origin)

    return tuple(origins)


def add_cors_middleware(app: FastAPI, origins: Sequence[str]) -> None:
    """Install the credentialed browser policy shared by runtime and tests."""

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def deployment_health_payload(render_git_commit: str | None) -> dict[str, str | None]:
    """Expose only health and an exact validated Render source revision."""

    candidate = (render_git_commit or "").strip()
    commit = candidate.lower() if _EXACT_GIT_COMMIT.fullmatch(candidate) else None
    return {"status": "ok", "gitCommit": commit}


def notes_cutover_release_blockers(
    *,
    approved_commit: str | None = None,
    running_commit: str | None = None,
    evidence_commit: str | None = None,
    running_deployment: str | None = None,
    evidence_deployment: str | None = None,
    recovery_mode_active: bool | None = None,
    legacy_instances_excluded: bool | None = None,
    legacy_credentials_fenced: bool | None = None,
    direct_mutation_paths_denied: bool | None = None,
    required_ci_reviews_complete: bool | None = None,
    owner_activation_approved: bool | None = None,
) -> tuple[str, ...]:
    """Check a release evidence snapshot; NEVER authorize or activate cutover.

    Recovery Mode already denies reset/restore before table access on NEW
    servers. It cannot fence an old binary, credential, PostgREST or privileged
    RPC. One configured instance, auto-deploy off, or an app flag is not proof.
    Operators must independently verify all external facts at release time and
    bind them to the exact approved revision AND observed deployment. A new
    deployment/rollback invalidates that snapshot and requires fresh inspection.

    An empty tuple means only that the supplied checklist is internally
    complete, not that its assertions are true/current. This pure helper does
    not discover Render/DB authority, consume client input, change recovery
    configuration, grant writes, or replace required CI/review/owner approval.
    Production activation and a durable rollback fence remain separate gates.
    """
    blockers: list[str] = []
    commits = (approved_commit, running_commit, evidence_commit)
    if (not all(type(value) is str and _EXACT_GIT_COMMIT.fullmatch(value) for value in commits)
            or len({value.lower() for value in commits if type(value) is str}) != 1):
        blockers.append("EXACT_APPROVED_REVISION_UNPROVEN")
    if (type(running_deployment) is not str or not running_deployment.strip()
            or running_deployment != running_deployment.strip()
            or type(evidence_deployment) is not str
            or evidence_deployment != running_deployment):
        blockers.append("CURRENT_DEPLOYMENT_EVIDENCE_UNPROVEN")
    for code, fact in (
        ("RECOVERY_PROTECTION_UNPROVEN", recovery_mode_active),
        ("LEGACY_INSTANCE_EXCLUSION_UNPROVEN", legacy_instances_excluded),
        ("LEGACY_CREDENTIAL_FENCE_UNPROVEN", legacy_credentials_fenced),
        ("DIRECT_MUTATION_FENCE_UNPROVEN", direct_mutation_paths_denied),
        ("REQUIRED_CI_REVIEWS_UNPROVEN", required_ci_reviews_complete),
        ("OWNER_ACTIVATION_APPROVAL_UNPROVEN", owner_activation_approved),
    ):
        if fact is not True:
            blockers.append(code)
    return tuple(blockers)
