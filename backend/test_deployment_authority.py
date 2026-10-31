from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from deployment_authority import (
    LOCAL_DEVELOPMENT_ORIGINS,
    CorsConfigurationError,
    add_cors_middleware,
    deployment_health_payload,
    notes_cutover_release_blockers,
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
    assert deployment_health_payload("a" * 7) == {"status": "ok", "gitCommit": None}
    assert deployment_health_payload("a" * 39) == {"status": "ok", "gitCommit": None}
    assert deployment_health_payload("a" * 41) == {"status": "ok", "gitCommit": None}


def test_runtime_health_route_reads_render_commit_without_exposing_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    commit = "b" * 40
    monkeypatch.setenv("RENDER_GIT_COMMIT", commit)

    response = TestClient(main.app).get("/health")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"status": "ok", "gitCommit": commit}


def cutover_evidence() -> dict:
    # Synthetic independently verified facts, NOT evidence about live Render/DB.
    return dict(
        approved_commit="a" * 40, running_commit="a" * 40, evidence_commit="a" * 40,
        running_deployment="dep-synthetic", evidence_deployment="dep-synthetic",
        recovery_mode_active=True, legacy_instances_excluded=True,
        legacy_credentials_fenced=True, direct_mutation_paths_denied=True,
        required_ci_reviews_complete=True, owner_activation_approved=True,
    )


def test_complete_release_snapshot_is_not_a_runtime_activator(monkeypatch):
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", True)
    evidence = cutover_evidence()
    before = dict(evidence)
    assert notes_cutover_release_blockers(**evidence) == ()
    assert evidence == before
    assert main.RECOVERY_MODE_ACTIVE is True


@pytest.mark.parametrize("field,code", [
    ("recovery_mode_active", "RECOVERY_PROTECTION_UNPROVEN"),
    ("legacy_instances_excluded", "LEGACY_INSTANCE_EXCLUSION_UNPROVEN"),
    ("legacy_credentials_fenced", "LEGACY_CREDENTIAL_FENCE_UNPROVEN"),
    ("direct_mutation_paths_denied", "DIRECT_MUTATION_FENCE_UNPROVEN"),
    ("required_ci_reviews_complete", "REQUIRED_CI_REVIEWS_UNPROVEN"),
    ("owner_activation_approved", "OWNER_ACTIVATION_APPROVAL_UNPROVEN"),
])
@pytest.mark.parametrize("unproven", [None, False, "true", 1])
def test_each_missing_or_non_boolean_release_fact_blocks(field, code, unproven):
    evidence = cutover_evidence() | {field: unproven}
    assert notes_cutover_release_blockers(**evidence) == (code,)


@pytest.mark.parametrize("changes,code", [
    ({"approved_commit": None}, "EXACT_APPROVED_REVISION_UNPROVEN"),
    ({"running_commit": "a" * 7}, "EXACT_APPROVED_REVISION_UNPROVEN"),
    ({"evidence_commit": None}, "EXACT_APPROVED_REVISION_UNPROVEN"),
    ({"running_commit": "b" * 40}, "EXACT_APPROVED_REVISION_UNPROVEN"),
    ({"evidence_commit": "b" * 40}, "EXACT_APPROVED_REVISION_UNPROVEN"),
    ({"running_deployment": None}, "CURRENT_DEPLOYMENT_EVIDENCE_UNPROVEN"),
    ({"running_deployment": ""}, "CURRENT_DEPLOYMENT_EVIDENCE_UNPROVEN"),
    ({"evidence_deployment": None}, "CURRENT_DEPLOYMENT_EVIDENCE_UNPROVEN"),
    ({"running_deployment": "dep-rollback"}, "CURRENT_DEPLOYMENT_EVIDENCE_UNPROVEN"),
])
def test_missing_stale_mixed_or_rollback_evidence_never_inherits_flag_authority(changes, code):
    assert code in notes_cutover_release_blockers(**(cutover_evidence() | changes))


def test_recovery_flag_or_health_revision_alone_does_not_establish_external_fences():
    blockers = notes_cutover_release_blockers(
        approved_commit="a" * 40, running_commit="a" * 40, recovery_mode_active=True,
    )
    assert "LEGACY_INSTANCE_EXCLUSION_UNPROVEN" in blockers
    assert "LEGACY_CREDENTIAL_FENCE_UNPROVEN" in blockers
    assert "DIRECT_MUTATION_FENCE_UNPROVEN" in blockers
    assert "CURRENT_DEPLOYMENT_EVIDENCE_UNPROVEN" in blockers
    assert "EXACT_APPROVED_REVISION_UNPROVEN" in blockers


def test_simulated_old_server_and_credential_bypass_block_release_checklist():
    evidence = cutover_evidence() | dict(
        running_commit="3cc79e08a3a042a4ed5cdc79ce2e62b6be2c24be",
        legacy_instances_excluded=False, legacy_credentials_fenced=False,
        direct_mutation_paths_denied=None,
    )
    assert set(notes_cutover_release_blockers(**evidence)) == {
        "EXACT_APPROVED_REVISION_UNPROVEN", "LEGACY_INSTANCE_EXCLUSION_UNPROVEN",
        "LEGACY_CREDENTIAL_FENCE_UNPROVEN", "DIRECT_MUTATION_FENCE_UNPROVEN",
    }
