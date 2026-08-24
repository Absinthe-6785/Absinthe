from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

import main


class FakeTable:
    def __init__(self, database: "FakeSupabase", table: str):
        self.database = database
        self.table = table
        self.operation: str | None = None
        self.filters: list[tuple[str, object]] = []
        self.inserted: dict | None = None

    def select(self, _columns: str):
        self.operation = "select"
        return self

    def eq(self, column: str, value: object):
        self.filters.append((column, value))
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def insert(self, row: dict):
        self.operation = "insert"
        self.inserted = row
        return self

    def execute(self):
        if self.operation == "select":
            rows = [
                row for row in self.database.rows
                if all(row.get(column) == value for column, value in self.filters)
            ]
            return SimpleNamespace(data=[{"id": row["id"]} for row in rows])
        if self.operation == "delete":
            self.database.operations.append(("delete", self.filters))
            self.database.rows = [
                row for row in self.database.rows
                if not all(row.get(column) == value for column, value in self.filters)
            ]
            return SimpleNamespace(data=[])
        if self.operation == "insert":
            assert self.inserted is not None
            inserted = deepcopy(self.inserted)
            inserted.setdefault("id", f"generated-{len(self.database.rows) + 1}")
            self.database.operations.append(("insert", deepcopy(self.inserted)))
            self.database.rows.append(inserted)
            return SimpleNamespace(data=[self.inserted])
        raise AssertionError(f"unexpected operation: {self.operation}")


class FakeSupabase:
    def __init__(self, rows: list[dict] | None = None):
        self.rows = deepcopy(rows or [])
        self.operations: list[tuple[str, object]] = []

    def table(self, table: str) -> FakeTable:
        assert table == "workout_logs"
        return FakeTable(self, table)


def strength_set(**overrides: object) -> dict:
    return {
        "type": "strength",
        "set": 1,
        "kg": 102.37,
        "reps": 8,
        "done": True,
        **overrides,
    }


def workout_payload(sets: list[dict]) -> dict:
    return {
        "date": "2026-08-24",
        "block_id": "block-1",
        "sets": sets,
        "sort_order": 0,
    }


@pytest.fixture
def workout_client(monkeypatch: pytest.MonkeyPatch):
    supabase = FakeSupabase()
    monkeypatch.setattr(main, "supabase", supabase)
    main.app.dependency_overrides[main.get_current_user] = lambda: "test-user"
    try:
        yield TestClient(main.app), supabase
    finally:
        main.app.dependency_overrides.clear()


def test_remote_save_accepts_source_aware_and_legacy_sets(workout_client):
    client, supabase = workout_client
    source_aware = strength_set(weight_source_value=225.68, weight_source_unit="lbs")

    source_response = client.post("/api/workouts", json=workout_payload([source_aware]))
    legacy_response = client.post("/api/workouts", json=workout_payload([strength_set()]))

    assert source_response.status_code == 200
    assert legacy_response.status_code == 200
    inserted = [payload for kind, payload in supabase.operations if kind == "insert"]
    assert inserted[0]["sets"][0]["weight_source_value"] == 225.68
    assert inserted[0]["sets"][0]["weight_source_unit"] == "lbs"
    assert "weight_source_value" not in inserted[1]["sets"][0]
    assert "weight_source_unit" not in inserted[1]["sets"][0]


@pytest.mark.parametrize(
    "invalid_set",
    [
        strength_set(weight_source_value=225.68),
        strength_set(weight_source_unit="lbs"),
        strength_set(weight_source_value=225.68, weight_source_unit="ounces"),
        strength_set(weight_source_value=-1, weight_source_unit="kg"),
    ],
)
def test_remote_save_rejects_malformed_source_pairs_before_writes(workout_client, invalid_set):
    client, supabase = workout_client

    response = client.post("/api/workouts", json=workout_payload([invalid_set]))

    assert response.status_code == 422
    assert supabase.operations == []


def test_invalid_remote_update_preserves_existing_row(workout_client):
    client, supabase = workout_client
    existing = {
        "id": "existing-workout",
        "user_id": "test-user",
        **workout_payload([strength_set(weight_source_value=225.68, weight_source_unit="lbs")]),
    }
    supabase.rows = [deepcopy(existing)]

    response = client.post(
        "/api/workouts",
        json=workout_payload([strength_set(weight_source_value=225.68)]),
    )

    assert response.status_code == 422
    assert supabase.rows == [existing]
    assert supabase.operations == []
