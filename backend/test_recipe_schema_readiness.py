from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
from schema_readiness import SchemaReadinessError, verify_recipe_deleted_at_schema


class _ProbeQuery:
    def __init__(self, response: SimpleNamespace | None = None, error: Exception | None = None):
        self.response = response
        self.error = error
        self.columns: str | None = None
        self.limit_count: int | None = None

    def select(self, columns: str) -> "_ProbeQuery":
        self.columns = columns
        return self

    def limit(self, count: int) -> "_ProbeQuery":
        self.limit_count = count
        return self

    def execute(self) -> SimpleNamespace:
        if self.error is not None:
            raise self.error
        assert self.columns == "deleted_at"
        assert self.limit_count == 1
        assert self.response is not None
        return self.response


class _ProbeClient:
    def __init__(self, *, rows: object = None, error: Exception | None = None):
        self.query = _ProbeQuery(SimpleNamespace(data=rows), error)

    def table(self, table: str) -> _ProbeQuery:
        assert table == "recipes"
        return self.query


def test_missing_recipe_deleted_at_fails_closed() -> None:
    with pytest.raises(SchemaReadinessError):
        verify_recipe_deleted_at_schema(_ProbeClient(error=RuntimeError("column does not exist")))


def test_ready_recipe_deleted_at_allows_schema_readiness() -> None:
    verify_recipe_deleted_at_schema(_ProbeClient(rows=[{"deleted_at": None}]))


def test_non_timestamp_recipe_deleted_at_fails_closed() -> None:
    with pytest.raises(SchemaReadinessError):
        verify_recipe_deleted_at_schema(_ProbeClient(rows=[{"deleted_at": 123}]))


def test_missing_schema_blocks_real_backend_lifespan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "supabase", _ProbeClient(error=RuntimeError("column does not exist")))

    with pytest.raises(SchemaReadinessError):
        with TestClient(main.app) as client:
            client.get("/")


def test_ready_schema_permits_real_backend_lifespan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "supabase", _ProbeClient(rows=[{"deleted_at": None}]))

    with TestClient(main.app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
