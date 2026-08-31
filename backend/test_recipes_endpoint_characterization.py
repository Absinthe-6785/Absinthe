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
        self.limit_count: int | None = None
        self.payload: dict[str, Any] | None = None

    def select(self, columns: str) -> "FakeRecipeQuery":
        self.operation = "select"
        self.columns = columns
        return self

    def eq(self, column: str, value: Any) -> "FakeRecipeQuery":
        self.filters.append((column, value))
        return self

    def is_(self, column: str, value: Any) -> "FakeRecipeQuery":
        self.filters.append(("is", column, value))
        return self

    @property
    def not_(self) -> "FakeRecipeNegatedFilters":
        return FakeRecipeNegatedFilters(self)

    def order(self, column: str, *, desc: bool = False) -> "FakeRecipeQuery":
        self.order_calls.append((column, desc))
        return self

    def limit(self, count: int) -> "FakeRecipeQuery":
        self.limit_count = count
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
        def _matches(row: dict[str, Any]) -> bool:
            for item in self.filters:
                if len(item) == 2:
                    column, value = item
                    if row.get(column) != value:
                        return False
                    continue
                kind, column, value = item
                if kind == "is" and value == "null" and row.get(column) is not None:
                    return False
                if kind == "not_is" and value == "null" and row.get(column) is None:
                    return False
            return True

        matches = [
            row
            for row in self.client.rows
            if _matches(row)
        ]

        # The app lifespan performs a read-only schema probe. Keep that setup
        # query out of endpoint-contract assertions while still exercising the
        # same adapter path.
        is_schema_probe = self.operation == "select" and self.columns == "deleted_at" and self.limit_count == 1
        if not is_schema_probe:
            self.client.executed.append(self)

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
            if self.limit_count is not None:
                data = data[: self.limit_count]
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
            if self.client.before_write is not None:
                self.client.before_write(self)
                self.client.before_write = None
            matched_rows = [row for row in self.client.rows if _matches(row)]
            for row in matched_rows:
                row.update(self.payload)
            if self.client.update_data is not _UNSET:
                return SimpleNamespace(data=deepcopy(self.client.update_data))
            return SimpleNamespace(data=deepcopy(matched_rows))

        if self.operation == "delete":
            self.client.write_queries.append(self)
            if self.client.before_write is not None:
                self.client.before_write(self)
                self.client.before_write = None
            deleted = [
                row
                for row in self.client.rows
                if _matches(row)
            ]
            self.client.rows[:] = [
                row
                for row in self.client.rows
                if not _matches(row)
            ]
            if self.client.delete_data is not _UNSET:
                return SimpleNamespace(data=deepcopy(self.client.delete_data))
            return SimpleNamespace(data=deepcopy(deleted))

        raise AssertionError(f"Unexpected Recipes operation: {self.operation}")


class FakeRecipeNegatedFilters:
    def __init__(self, query: FakeRecipeQuery) -> None:
        self.query = query

    def is_(self, column: str, value: Any) -> FakeRecipeQuery:
        self.query.filters.append(("not_is", column, value))
        return self.query


class FakeSupabase:
    def __init__(
        self,
        rows: list[dict[str, Any]] | None = None,
        *,
        insert_data: Any = _UNSET,
        update_data: Any = _UNSET,
        delete_data: Any = _UNSET,
        before_write: Any = None,
    ) -> None:
        self.rows = deepcopy(rows or [])
        self.insert_data = insert_data
        self.update_data = update_data
        self.delete_data = delete_data
        self.before_write = before_write
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
    owned_deleted = {
        "id": "recipe-deleted",
        "user_id": USER_ID,
        "title": "Deleted",
        "deleted_at": "2026-08-03T00:00:00Z",
    }
    fake.rows[:] = [owned_new, owned_old, owned_deleted, {"id": "other", "user_id": OTHER_USER_ID}]

    response = client.get("/api/recipes")

    assert response.status_code == 200
    assert response.json() == [owned_new, owned_old]
    assert len(fake.executed) == 1
    query = fake.executed[0]
    assert query.operation == "select"
    assert query.columns == "*"
    assert query.filters == [("user_id", USER_ID), ("is", "deleted_at", "null")]
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
    assert lookup.columns == "user_id, deleted_at"
    assert lookup.filters == [("id", recipe_id)]
    assert lookup.single is True
    assert update.operation == "update"
    assert update.filters == [("id", recipe_id), ("user_id", USER_ID), ("is", "deleted_at", "null")]
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


def test_put_deleted_recipe_fails_closed_without_reactivating_it(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-deleted-update"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Deleted", "deleted_at": "2026-08-01T00:00:00Z"}]

    response = client.put(f"/api/recipes/{recipe_id}", json=recipe_body(title="Must stay deleted"))

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.write_queries == []
    assert fake.rows[0]["title"] == "Deleted"
    assert fake.rows[0]["deleted_at"] == "2026-08-01T00:00:00Z"


def test_put_ownership_race_fails_closed_without_foreign_update(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-race-update"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Before"}]

    def change_owner_before_final_update(_query):
        fake.rows[0]["user_id"] = OTHER_USER_ID

    fake.before_write = change_owner_before_final_update

    response = client.put(
        f"/api/recipes/{recipe_id}",
        json=recipe_body(title="Should not apply"),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.rows == [
        {"id": recipe_id, "user_id": OTHER_USER_ID, "title": "Before"}
    ]


def test_put_zero_row_after_owner_preread_fails_closed(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-zero-update"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Before"}]

    def remove_before_final_update(_query):
        fake.rows.clear()

    fake.before_write = remove_before_final_update

    response = client.put(f"/api/recipes/{recipe_id}", json=recipe_body())

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.rows == []


def test_delete_success_soft_deletes_owned_row_and_confirms_state(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-delete"
    row = {"id": recipe_id, "user_id": USER_ID, "title": "Delete me"}
    fake.rows[:] = [row]
    fake.update_data = [row | {"server_only": "raw", "deleted_at": "2026-08-31T00:00:00+00:00"}]

    response = client.delete(f"/api/recipes/{recipe_id}")

    assert response.status_code == 200
    assert response.json() == {
        "deleted": True,
        "recipe_id": recipe_id,
        "account_id": USER_ID,
        "deleted_at": "2026-08-31T00:00:00+00:00",
    }
    assert len(fake.executed) == 2
    lookup, delete = fake.executed
    assert lookup.operation == "select"
    assert lookup.columns == "user_id, deleted_at"
    assert lookup.filters == [("id", recipe_id)]
    assert lookup.single is True
    assert delete.operation == "update"
    assert delete.filters == [("id", recipe_id), ("user_id", USER_ID), ("is", "deleted_at", "null")]
    assert fake.updated_payloads[0]["deleted_at"]
    assert fake.rows[0]["id"] == recipe_id
    assert fake.rows[0]["title"] == "Delete me"
    assert fake.rows[0]["deleted_at"]


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


def test_delete_ownership_race_fails_closed_without_foreign_update(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-race-delete"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Keep me"}]

    def change_owner_before_final_delete(_query):
        fake.rows[0]["user_id"] = OTHER_USER_ID

    fake.before_write = change_owner_before_final_delete

    response = client.delete(f"/api/recipes/{recipe_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.rows == [
        {"id": recipe_id, "user_id": OTHER_USER_ID, "title": "Keep me"}
    ]


def test_delete_zero_row_after_owner_preread_fails_closed(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-zero-delete"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Already gone"}]

    def remove_before_final_delete(_query):
        fake.rows.clear()

    fake.before_write = remove_before_final_delete

    response = client.delete(f"/api/recipes/{recipe_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.rows == []


def test_get_trash_is_current_user_scoped_and_excludes_active_rows(recipes_client):
    client, fake = recipes_client
    deleted = {
        "id": "recipe-deleted",
        "user_id": USER_ID,
        "title": "Deleted",
        "deleted_at": "2026-08-03T00:00:00Z",
    }
    active = {"id": "recipe-active", "user_id": USER_ID, "title": "Active", "deleted_at": None}
    foreign = {"id": "recipe-foreign", "user_id": OTHER_USER_ID, "deleted_at": "2026-08-04T00:00:00Z"}
    fake.rows[:] = [deleted, active, foreign]

    response = client.get("/api/recipes/trash")

    assert response.status_code == 200
    assert response.json() == [deleted]
    query = fake.executed[0]
    assert query.filters == [("user_id", USER_ID), ("not_is", "deleted_at", "null")]
    assert query.order_calls == [("deleted_at", True)]


def test_active_backup_recipe_fetch_excludes_soft_deleted_rows(recipes_client):
    _, fake = recipes_client
    active = {"id": "recipe-active", "user_id": USER_ID, "deleted_at": None}
    deleted = {"id": "recipe-deleted", "user_id": USER_ID, "deleted_at": "2026-08-03T00:00:00Z"}
    fake.rows[:] = [active, deleted]

    result = main._fetch_user_table(USER_ID, "recipes", "created_at")

    assert result == [active]
    query = fake.executed[0]
    assert query.filters == [("user_id", USER_ID), ("is", "deleted_at", "null")]
    assert query.order_calls == [("created_at", False)]


def test_delete_already_deleted_row_is_not_physical_or_successful_again(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-already-deleted"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "deleted_at": "2026-08-01T00:00:00Z"}]

    response = client.delete(f"/api/recipes/{recipe_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.write_queries == []
    assert fake.rows[0]["deleted_at"] == "2026-08-01T00:00:00Z"


def test_restore_deleted_recipe_clears_tombstone_for_owned_row(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-restore"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "title": "Restore", "deleted_at": "2026-08-01T00:00:00Z"}]

    response = client.post(f"/api/recipes/{recipe_id}/restore")

    assert response.status_code == 200
    assert response.json()["id"] == recipe_id
    assert response.json()["deleted_at"] is None
    assert len(fake.executed) == 2
    lookup, restore = fake.executed
    assert lookup.columns == "user_id, deleted_at"
    assert restore.operation == "update"
    assert restore.filters == [("id", recipe_id), ("user_id", USER_ID), ("not_is", "deleted_at", "null")]
    assert fake.updated_payloads == [{"deleted_at": None}]
    assert fake.rows[0]["deleted_at"] is None


def test_restore_active_recipe_is_not_a_successful_noop(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-active"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "deleted_at": None}]

    response = client.post(f"/api/recipes/{recipe_id}/restore")

    assert response.status_code == 409
    assert response.json() == {"detail": "Recipe is not deleted"}
    assert fake.write_queries == []


def test_restore_foreign_recipe_is_forbidden_without_write(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-foreign"
    fake.rows[:] = [{"id": recipe_id, "user_id": OTHER_USER_ID, "deleted_at": "2026-08-01T00:00:00Z"}]

    response = client.post(f"/api/recipes/{recipe_id}/restore")

    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}
    assert fake.write_queries == []


def test_restore_ownership_race_fails_closed_without_foreign_update(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-restore-race"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "deleted_at": "2026-08-01T00:00:00Z"}]

    def change_owner_before_restore(_query):
        fake.rows[0]["user_id"] = OTHER_USER_ID

    fake.before_write = change_owner_before_restore
    response = client.post(f"/api/recipes/{recipe_id}/restore")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.rows[0]["deleted_at"] == "2026-08-01T00:00:00Z"


def test_restore_zero_row_after_preread_fails_closed(recipes_client):
    client, fake = recipes_client
    recipe_id = "recipe-zero-restore"
    fake.rows[:] = [{"id": recipe_id, "user_id": USER_ID, "deleted_at": "2026-08-01T00:00:00Z"}]

    def remove_before_restore(_query):
        fake.rows.clear()

    fake.before_write = remove_before_restore
    response = client.post(f"/api/recipes/{recipe_id}/restore")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
    assert fake.rows == []


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
