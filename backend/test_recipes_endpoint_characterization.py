"""Characterization tests for the registered Recipes HTTP endpoints.

These tests exercise the actual FastAPI routes while replacing only the
Recipes table adapter.  They deliberately keep the fake narrow so that the
existing auth, dependency, and application composition contracts remain
observable.
"""

from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from jwt.exceptions import InvalidTokenError

import main


USER_ID = "recipes-user"
OTHER_USER_ID = "other-user"
_UNSET = object()


def recipe_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Recipe title",
        "category": "Dinner",
        "ingredients": "rice",
        "steps": "Cook it",
        "memo": "Serve warm",
        "starred": True,
    }
    body.update(overrides)
    return body


class FakeRecipeQuery:
    def __init__(self, client: "FakeSupabase", operation: str) -> None:
        self.client = client
        self.operation = operation
        self.columns = "*"
        self.filters: list[tuple[str, Any]] = []
        self.order_calls: list[tuple[str, bool]] = []
        self.single = False
        self.payload: dict[str, Any] | None = None

    def select(self, columns: str) -> "FakeRecipeQuery":
        self.operation = "select"
        self.columns = columns
        return self

    def eq(self, column: str, value: Any) -> "FakeRecipeQuery":
        self.filters.append((column, value))
        return self

    def order(self, column: str, *, desc: bool = False) -> "FakeRecipeQuery":
        self.order_calls.append((column, desc))
        return self

    def maybe_single(self) -> "FakeRecipeQuery":
        self.single = True
        return self

    def insert(self, payload: dict[str, Any]) -> "FakeRecipeQuery":
        self.operation = "insert"
        self.payload = deepcopy(payload)
        return self

    def update(self, payload: dict[str, Any]) -> "FakeRecipeQuery":
        self.operation = "update"
        self.payload = deepcopy(payload)
        return self

    def delete(self) -> "FakeRecipeQuery":
        self.operation = "delete"
        return self

    def execute(self) -> SimpleNamespace:
        self.client.executed.append(self)
        matches = [
            row
            for row in self.client.rows
            if all(row.get(column) == value for column, value in self.filters)
        ]

        if self.operation == "select":
            if self.single:
                row = matches[0] if matches else None
                if row is not None and self.columns == "user_id":
                    row = {"user_id": row.get("user_id")}
                return SimpleNamespace(data=deepcopy(row))
            if self.columns == "user_id":
                data = [{"user_id": row.get("user_id")} for row in matches]
            else:
                data = matches
            return SimpleNamespace(data=deepcopy(data))

        if self.operation == "insert":
            assert self.payload is not None
            self.client.write_queries.append(self)
            self.client.inserted_payloads.append(deepcopy(self.payload))
            if self.client.insert_data is not _UNSET:
                return SimpleNamespace(data=deepcopy(self.client.insert_data))
            inserted = deepcopy(self.payload)
            inserted.setdefault("id", f"recipe-{len(self.client.rows) + 1}")
            self.client.rows.append(inserted)
            return SimpleNamespace(data=[deepcopy(inserted)])

        if self.operation == "update":
            assert self.payload is not None
            self.client.write_queries.append(self)
            self.client.updated_payloads.append(deepcopy(self.payload))
            for row in self.client.rows:
                if all(row.get(column) == value for column, value in self.filters):
                    row.update(self.payload)
            if self.client.update_data is not _UNSET:
                return SimpleNamespace(data=deepcopy(self.client.update_data))
            return SimpleNamespace(
                data=deepcopy(
                    [
                        row
                        for row in self.client.rows
                        if all(row.get(column) == value for column, value in self.filters)
                    ]
                )
            )

        if self.operation == "delete":
            self.client.write_queries.append(self)
            deleted = [
                row
                for row in self.client.rows
                if all(row.get(column) == value for column, value in self.filters)
            ]
            self.client.rows[:] = [
                row
                for row in self.client.rows
                if not all(row.get(column) == value for column, value in self.filters)
            ]
            if self.client.delete_data is not _UNSET:
                return SimpleNamespace(data=deepcopy(self.client.delete_data))
            return SimpleNamespace(data=deepcopy(deleted))

        raise AssertionError(f"Unexpected Recipes operation: {self.operation}")


class FakeSupabase:
    def __init__(
        self,
        rows: list[dict[str, Any]] | None = None,
        *,
        insert_data: Any = _UNSET,
        update_data: Any = _UNSET,
        delete_data: Any = _UNSET,
    ) -> None:
        self.rows = deepcopy(rows or [])
        self.insert_data = insert_data
        self.update_data = update_data
        self.delete_data = delete_data
        self.executed: list[FakeRecipeQuery] = []
        self.write_queries: list[FakeRecipeQuery] = []
        self.inserted_payloads: list[dict[str, Any]] = []
        self.updated_payloads: list[dict[str, Any]] = []

    def table(self, name: str) -> FakeRecipeQuery:
        assert name == "recipes"
        return FakeRecipeQuery(self, "select")


@pytest.fixture
def recipes_client(monkeypatch: pytest.MonkeyPatch):
    fake = FakeSupabase()
    monkeypatch.setattr(main, "supabase", fake)
    previous_overrides = dict(main.app.dependency_overrides)
    main.app.dependency_overrides[main.get_current_user] = lambda: USER_ID
    try:
        with TestClient(main.app) as client:
            yield client, fake
    finally:
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(previous_overrides)


def test_get_success_is_user_scoped_ordered_and_raw(recipes_client):
    client, fake = recipes_client
    owned_new = {
        "id": "recipe-new",
        "user_id": USER_ID,
        "title": "New",
        "created_at": "2026-08-02T00:00:00Z",
        "server_only": {"kept": True},
    }
    owned_old = {
        "id": "recipe-old",
        "user_id": USER_ID,
        "title": "Old",
        "created_at": "2026-08-01T00:00:00Z",
    }
    fake.rows[:] = [owned_new, owned_old, {"id": "other", "user_id": OTHER_USER_ID}]

    response = client.get("/api/recipes")

    assert response.status_code == 200
    assert response.json() == [owned_new, owned_old]
    assert len(fake.executed) == 1
    query = fake.executed[0]
    assert query.operation == "select"
    assert query.columns == "*"
    assert query.filters == [("user_id", USER_ID)]
    assert query.order_calls == [("created_at", True)]


def test_get_empty_result_returns_empty_list(recipes_client):
    client, _ = recipes_client

    response = client.get("/api/recipes")

    assert response.status_code == 200
    assert response.json() == []


def test_post_injects_token_owner_and_forwards_recipe_fields(recipes_client):
    client, fake = recipes_client
    raw_inserted = {
        "id": "recipe-created",
        "user_id": USER_ID,
        **recipe_body(),
        "created_at": "2026-08-02T00:00:00Z",
        "server_only": "raw",
    }
    fake.insert_data = [raw_inserted]

    response = client.post(
        "/api/recipes",
        json=recipe_body(user_id="attacker-supplied-owner"),
    )

    assert response.status_code == 200
    assert response.json() == raw_inserted
    assert fake.inserted_payloads == [
        {
            "user_id": USER_ID,
            "title": "Recipe title",
            "category": "Dinner",
            "ingredients": "rice",
            "steps": "Cook it",
            "memo": "Serve warm",
            "starred": True,
        }
    ]


def test_post_empty_supabase_data_returns_empty_object(recipes_client):
    client, fake = recipes_client
    fake.insert_data = []

    response = client.post("/api/recipes", json={"title": "Defaults"})

    assert response.status_code == 200
    assert response.json() == {}
    assert fake.inserted_payloads == [
        {
            "user_id": USER_ID,
            "title": "Defaults",
            "category": "Other",
            "ingredients": "",
            "steps": "",
            "memo": "",
            "starred": False,
        }
    ]


def test_recipe_create_schema_and_invalid_body_contract(recipes_client):
    client, _ = recipes_client

    fields = main.RecipeCreate.model_fields
    assert set(fields) == {
        "title",
        "category",
        "ingredients",
        "steps",
        "memo",
        "starred",
    }
    assert fields["title"].is_required()
    assert fields["category"].default == "Other"
    assert fields["ingredients"].default == ""
    assert fields["steps"].default == ""
    assert fields["memo"].default == ""
    assert fields["starred"].default is False

    response = client.post("/api/recipes", json={"category": "Dinner"})

    assert response.status_code == 422


def test_put_success_uses_full_payload_and_returns_first_updated_row(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-update"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Before"}]
    raw_updated = {
        "id": recipe_id,
        "user_id": USER_ID,
        **recipe_body(title="After"),
        "created_at": "2026-08-02T00:00:00Z",
        "server_only": {"kept": True},
    }
    fake.update_data = [raw_updated, {"id": "ignored"}]

    response = client.put(
        f"/api/recipes/{recipe_id}",
        json=recipe_body(title="After"),
    )

    assert response.status_code == 200
    assert response.json() == raw_updated
    assert len(fake.executed) == 2
    lookup, update = fake.executed
    assert lookup.operation == "select"
    assert lookup.columns == "user_id"
    assert lookup.filters == [("id", recipe_id)]
    assert lookup.single is True
    assert update.operation == "update"
    assert update.filters == [("id", recipe_id)]
    assert fake.updated_payloads == [
        {
            "title": "After",
            "category": "Dinner",
            "ingredients": "rice",
            "steps": "Cook it",
            "memo": "Serve warm",
            "starred": True,
        }
    ]


def test_put_missing_row_returns_404_without_write(recipes_client):
    client, fake = recipes_client

    response = client.put("/api/recipes/missing", json=recipe_body())

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.write_queries == []


def test_put_owner_mismatch_returns_403_without_write(recipes_client):
    client, fake = recipes_client
    fake.rows[:] = [{"id": "recipe-other", "user_id": OTHER_USER_ID}]

    response = client.put("/api/recipes/recipe-other", json=recipe_body())

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert fake.write_queries == []


def test_delete_success_checks_owner_targets_id_and_returns_raw_data(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-delete"
    row = {"id": recipe_id, "user_id": USER_ID, "title": "Delete me"}
    fake.rows[:] = [row]
    raw_deleted = [row | {"server_only": "raw"}]
    fake.delete_data = raw_deleted

    response = client.delete(f"/api/recipes/{recipe_id}")

    assert response.status_code == 200
    assert response.json() == raw_deleted
    assert len(fake.executed) == 2
    lookup, delete = fake.executed
    assert lookup.operation == "select"
    assert lookup.columns == "user_id"
    assert lookup.filters == [("id", recipe_id)]
    assert lookup.single is True
    assert delete.operation == "delete"
    assert delete.filters == [("id", recipe_id)]


def test_delete_missing_row_returns_404_without_delete(recipes_client):
    client, fake = recipes_client

    response = client.delete("/api/recipes/missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.write_queries == []


def test_delete_owner_mismatch_returns_403_without_delete(recipes_client):
    client, fake = recipes_client
    fake.rows[:] = [{"id": "recipe-other", "user_id": OTHER_USER_ID}]

    response = client.delete("/api/recipes/recipe-other")

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert fake.write_queries == []


def test_invalid_bearer_authentication_returns_401(recipes_client, monkeypatch):
    client, _ = recipes_client
    previous_override = main.app.dependency_overrides.pop(main.get_current_user)

    class InvalidVerifier:
        def verify_token(self, token: str) -> str:
            assert token == "not-a-token"
            raise InvalidTokenError("invalid")

    monkeypatch.setattr(main, "jwt_verifier", InvalidVerifier())
    try:
        response = client.get(
            "/api/recipes",
            headers={"Authorization": "Bearer not-a-token"},
        )
    finally:
        main.app.dependency_overrides[main.get_current_user] = previous_override

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token"}


def test_missing_authentication_returns_401(recipes_client):
    client, _ = recipes_client
    previous_override = main.app.dependency_overrides.pop(main.get_current_user)
    try:
        response = client.get("/api/recipes")
    finally:
        main.app.dependency_overrides[main.get_current_user] = previous_override

    assert response.status_code == 401
