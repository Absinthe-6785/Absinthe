"""Executable characterization of the current Supabase client boundary.

These tests intentionally exercise the existing ``main.py`` ownership model.
They use synthetic configuration and fake clients so that importing the module
never contacts Supabase or a JWT/JWKS provider.
"""

from __future__ import annotations

import asyncio
import importlib
import inspect
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any, Iterator

import auth
from fastapi import HTTPException
from fastapi.security import HTTPBearer
import dotenv
import pytest
import supabase as supabase_package


TEST_URL = "https://synthetic-project.supabase.co"
TEST_ANON_KEY = "synthetic-anon-key"
TEST_SERVICE_ROLE_KEY = "synthetic-service-role-key"
TEST_JWT_SECRET = "synthetic-jwt-secret"


@contextmanager
def _fresh_main() -> Iterator[Any]:
    """Import ``main`` as a fresh module and restore the previous module."""

    previous = sys.modules.pop("main", None)
    try:
        module = importlib.import_module("main")
        yield module
    finally:
        sys.modules.pop("main", None)
        if previous is not None:
            sys.modules["main"] = previous


def _set_synthetic_environment(monkeypatch: pytest.MonkeyPatch, *, service_role: str | None) -> None:
    for name in (
        "SUPABASE_URL",
        "SUPABASE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_JWT_SECRET",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("SUPABASE_URL", TEST_URL)
    monkeypatch.setenv("SUPABASE_KEY", TEST_ANON_KEY)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    if service_role is not None:
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", service_role)


class _RecordingQuery:
    def __init__(self, client: "_RecordingClient", table: str) -> None:
        self.client = client
        self.table_name = table
        self.filters: list[tuple[str, object]] = []
        self.ordering: list[tuple[str, bool]] = []
        self.insert_payload: dict[str, object] | None = None
        self.operation: str | None = None

    def select(self, _columns: str) -> "_RecordingQuery":
        self.operation = "select"
        return self

    def eq(self, column: str, value: object) -> "_RecordingQuery":
        self.filters.append((column, value))
        return self

    def is_(self, column: str, value: object) -> "_RecordingQuery":
        self.filters.append(("is", column, value))
        return self

    def order(self, column: str, *, desc: bool = False) -> "_RecordingQuery":
        self.ordering.append((column, desc))
        return self

    def insert(self, payload: dict[str, object]) -> "_RecordingQuery":
        self.operation = "insert"
        self.insert_payload = payload
        return self

    def execute(self) -> SimpleNamespace:
        self.client.executed.append(self)
        if self.operation == "insert":
            return SimpleNamespace(data=[{"id": "recipe-1", **(self.insert_payload or {})}])
        return SimpleNamespace(data=[{"id": "recipe-1", "user_id": "row-user"}])


class _RecordingClient:
    """Minimal table surface; accessing ``auth`` would expose a mutation bug."""

    def __init__(self) -> None:
        self.queries: list[_RecordingQuery] = []
        self.executed: list[_RecordingQuery] = []

    @property
    def auth(self) -> Any:
        raise AssertionError("ordinary CRUD must not install request auth on main.supabase")

    def table(self, table: str) -> _RecordingQuery:
        query = _RecordingQuery(self, table)
        self.queries.append(query)
        return query


def _patch_import_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    create_client: Any,
    *,
    events: list[tuple[Any, ...]] | None = None,
) -> None:
    import_events = events if events is not None else []

    def fake_load_dotenv(*_args: Any, **_kwargs: Any) -> bool:
        import_events.append(("load_dotenv",))
        return False

    monkeypatch.setattr(dotenv, "load_dotenv", fake_load_dotenv)
    monkeypatch.setattr(supabase_package, "create_client", create_client)


def test_normal_client_import_contract_and_dotenv_order(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    events: list[tuple[Any, ...]] = []
    clients: list[_RecordingClient] = []
    original_getenv = os.getenv

    def traced_getenv(key: str, *args: Any) -> str | None:
        if key in {"SUPABASE_URL", "SUPABASE_KEY"}:
            events.append(("getenv", key))
        return original_getenv(key, *args)

    def fake_create_client(url: str, key: str) -> _RecordingClient:
        clients.append(_RecordingClient())
        events.append(("create_client", url, key))
        return clients[-1]

    _patch_import_dependencies(monkeypatch, fake_create_client, events=events)
    monkeypatch.setattr(os, "getenv", traced_getenv)

    with _fresh_main() as module:
        assert module.supabase is clients[0]
        assert len(clients) == 1
        assert events == [
            ("load_dotenv",),
            ("getenv", "SUPABASE_URL"),
            ("getenv", "SUPABASE_KEY"),
            ("create_client", TEST_URL, TEST_ANON_KEY),
        ]


@pytest.mark.parametrize("missing", ["SUPABASE_URL", "SUPABASE_KEY"])
def test_missing_normal_client_configuration_fails_during_fresh_import(
    monkeypatch: pytest.MonkeyPatch,
    missing: str,
) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    monkeypatch.delenv(missing, raising=False)
    create_calls: list[tuple[str, str]] = []

    def fake_create_client(url: str, key: str) -> object:
        create_calls.append((url, key))
        return object()

    _patch_import_dependencies(monkeypatch, fake_create_client)
    with pytest.raises(ValueError) as error:
        with _fresh_main():
            pass

    message = str(error.value)
    assert "보안 오류" in message
    assert "SUPABASE_KEY" in message
    assert "ES256" in message
    assert create_calls == []


def test_normal_client_is_process_local_singleton_and_crud_has_no_request_auth_mutation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    create_calls: list[tuple[str, str]] = []
    client = _RecordingClient()

    def fake_create_client(url: str, key: str) -> _RecordingClient:
        create_calls.append((url, key))
        return client

    _patch_import_dependencies(monkeypatch, fake_create_client)
    with _fresh_main() as module:
        first = asyncio.run(module.get_recipes("user-a"))
        second = asyncio.run(module.get_recipes("user-b"))
        inserted = asyncio.run(module.create_recipe(module.RecipeCreate(title="Synthetic"), "user-a"))

        assert module.supabase is client
        assert first and second and inserted
        assert create_calls == [(TEST_URL, TEST_ANON_KEY)]
        assert [query.filters for query in client.executed[:2]] == [
            [("user_id", "user-a"), ("is", "deleted_at", "null")],
            [("user_id", "user-b"), ("is", "deleted_at", "null")],
        ]
        assert client.executed[2].insert_payload == {
            "user_id": "user-a",
            "title": "Synthetic",
            "category": "Other",
            "ingredients": "",
            "steps": "",
            "memo": "",
            "starred": False,
        }


def test_main_supabase_compatibility_surface_resolves_symbol_at_call_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    original = _RecordingClient()
    replacement = _RecordingClient()
    monkeypatch.setattr(supabase_package, "create_client", lambda _url, _key: original)

    with _fresh_main() as module:
        module.supabase = replacement
        result = asyncio.run(module.get_recipes("replacement-user"))

        assert result
        assert replacement.executed[0].filters == [
            ("user_id", "replacement-user"),
            ("is", "deleted_at", "null"),
        ]
        assert original.executed == []
        assert module.__dict__["supabase"] is replacement


def test_get_current_user_and_jwt_verifier_compatibility_surfaces(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    monkeypatch.setattr(supabase_package, "create_client", lambda _url, _key: _RecordingClient())

    with _fresh_main() as module:
        parameter = inspect.signature(module.get_current_user).parameters["credentials"]
        assert isinstance(module.security, HTTPBearer)
        assert parameter.default.dependency is module.security
        assert module.SupabaseJWTVerifier is auth.SupabaseJWTVerifier
        assert isinstance(module.jwt_verifier, auth.SupabaseJWTVerifier)

        class FakeVerifier:
            def __init__(self) -> None:
                self.tokens: list[str] = []

            def verify_token(self, token: str) -> str:
                self.tokens.append(token)
                return "verifier-subject"

        verifier = FakeVerifier()
        monkeypatch.setattr(module, "jwt_verifier", verifier)
        credentials = SimpleNamespace(credentials="synthetic-token")
        assert module.get_current_user(credentials) == "verifier-subject"
        assert verifier.tokens == ["synthetic-token"]


def test_verify_owner_preserves_match_and_mismatch_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    monkeypatch.setattr(supabase_package, "create_client", lambda _url, _key: _RecordingClient())

    with _fresh_main() as module:
        assert module.verify_owner("owner-a", "owner-a") is None
        with pytest.raises(HTTPException) as error:
            module.verify_owner("owner-a", "owner-b")
        assert error.value.status_code == 403
        assert error.value.detail == "Forbidden"


def test_service_role_is_not_eager_or_required_for_normal_import(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    calls: list[tuple[str, str]] = []

    def fake_create_client(url: str, key: str) -> object:
        calls.append((url, key))
        return object()

    _patch_import_dependencies(monkeypatch, fake_create_client)
    with _fresh_main() as module:
        assert calls == [(TEST_URL, TEST_ANON_KEY)]
        assert module.K323_SUPABASE_CLIENT is None
        with pytest.raises(RuntimeError, match="k323_service_role_unavailable"):
            module.get_k323_supabase_client()
        assert calls == [(TEST_URL, TEST_ANON_KEY)]


def test_service_role_creation_is_lazy_cached_and_separate_from_normal_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_synthetic_environment(monkeypatch, service_role=TEST_SERVICE_ROLE_KEY)
    calls: list[tuple[str, str]] = []
    clients = [_RecordingClient(), _RecordingClient()]

    def fake_create_client(url: str, key: str) -> _RecordingClient:
        calls.append((url, key))
        return clients[len(calls) - 1]

    _patch_import_dependencies(monkeypatch, fake_create_client)
    with _fresh_main() as module:
        assert calls == [(TEST_URL, TEST_ANON_KEY)]
        assert module.K323_SUPABASE_CLIENT is None

        service_client = module.get_k323_supabase_client()
        assert calls == [(TEST_URL, TEST_ANON_KEY), (TEST_URL, TEST_SERVICE_ROLE_KEY)]
        assert service_client is clients[1]
        assert service_client is not module.supabase
        assert module.get_k323_supabase_client() is service_client
        assert calls == [(TEST_URL, TEST_ANON_KEY), (TEST_URL, TEST_SERVICE_ROLE_KEY)]


def test_fresh_import_restores_module_state_and_does_not_leak(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_synthetic_environment(monkeypatch, service_role=None)
    previous = sys.modules.get("main")
    monkeypatch.setattr(supabase_package, "create_client", lambda _url, _key: _RecordingClient())

    with _fresh_main() as module:
        assert sys.modules["main"] is module

    assert sys.modules.get("main") is previous
