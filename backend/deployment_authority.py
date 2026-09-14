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
