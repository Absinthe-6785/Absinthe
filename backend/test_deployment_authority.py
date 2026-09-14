from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from deployment_authority import (
    LOCAL_DEVELOPMENT_ORIGINS,
    CorsConfigurationError,
    add_cors_middleware,
    deployment_health_payload,
    resolve_cors_origins,
)
import main


PRODUCTION_ORIGIN = "https://absinthe-beryl.vercel.app"
UNTRUSTED_ORIGIN = "https://example.invalid"


def _client(origins: tuple[str, ...]) -> TestClient:
    app = FastAPI()
    add_cors_middleware(app, origins)

    @app.get("/protected")
    async def protected() -> dict[str, bool]:
        return {"ok": True}

    return TestClient(app)


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/protected",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )


def test_production_origin_allows_credentialed_preflight() -> None:
    client = _client(resolve_cors_origins(PRODUCTION_ORIGIN, is_render=True))

    response = _preflight(client, PRODUCTION_ORIGIN)
    actual = client.get("/protected", headers={"Origin": PRODUCTION_ORIGIN})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PRODUCTION_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "GET" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    assert actual.status_code == 200
    assert actual.headers["access-control-allow-origin"] == PRODUCTION_ORIGIN
    assert actual.headers["access-control-allow-credentials"] == "true"


def test_local_development_fallback_allows_both_expected_origins() -> None:
    origins = resolve_cors_origins(None, is_render=False)

    assert origins == LOCAL_DEVELOPMENT_ORIGINS
    for origin in origins:
        response = _preflight(_client(origins), origin)
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_untrusted_origin_receives_no_browser_authorizing_origin_header() -> None:
    client = _client(resolve_cors_origins(PRODUCTION_ORIGIN, is_render=True))

    preflight = _preflight(client, UNTRUSTED_ORIGIN)
    actual = client.get("/protected", headers={"Origin": UNTRUSTED_ORIGIN})

    assert preflight.status_code == 400
    assert "access-control-allow-origin" not in preflight.headers
    assert actual.status_code == 200
    assert "access-control-allow-origin" not in actual.headers


@pytest.mark.parametrize(
    "value",
    [
        "*",
        "https://*.vercel.app",
        "https://example.com/",
        "https://example.com/path",
        "https://user@example.com",
        "javascript://example.com",
        "https://example.com,",
        "",
    ],
)
def test_unsafe_or_malformed_origin_configuration_fails_closed(value: str) -> None:
    with pytest.raises(CorsConfigurationError):
        resolve_cors_origins(value, is_render=True)


def test_render_requires_explicit_origin_configuration() -> None:
    with pytest.raises(CorsConfigurationError, match="required on Render"):
        resolve_cors_origins(None, is_render=True)


def test_origin_configuration_deduplicates_without_broadening() -> None:
    assert resolve_cors_origins(
        f"{PRODUCTION_ORIGIN}, {PRODUCTION_ORIGIN}",
        is_render=True,
    ) == (PRODUCTION_ORIGIN,)


def test_health_exposes_only_a_validated_exact_commit() -> None:
    commit = "A" * 40

    assert deployment_health_payload(commit) == {
        "status": "ok",
        "gitCommit": "a" * 40,
    }
    assert deployment_health_payload(None) == {"status": "ok", "gitCommit": None}
    assert deployment_health_payload("not-a-commit") == {"status": "ok", "gitCommit": None}


def test_runtime_health_route_reads_render_commit_without_exposing_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    commit = "b" * 40
    monkeypatch.setenv("RENDER_GIT_COMMIT", commit)

    response = TestClient(main.app).get("/health")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"status": "ok", "gitCommit": commit}
