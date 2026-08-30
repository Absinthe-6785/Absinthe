from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace
from typing import Any

from fastapi.testclient import TestClient
import pytest

import main


ROUTINE_ID = "routine-a"
FOREIGN_ROUTINE_ID = "routine-b"
LOG_DATE = "2026-08-30"
CURRENT_USER = "user-a"
FOREIGN_USER = "user-b"


class FakeQuery:
    def __init__(self, database: "FakeSupabase", table: str) -> None:
        self.database = database
        self.table = table
        self.operation: str | None = None
        self.filters: list[tuple[str, object]] = []
        self.comparisons: list[tuple[str, str, object]] = []
        self.payload: dict[str, object] | None = None
        self.single = False

    def select(self, _columns: str) -> "FakeQuery":
        self.operation = "select"
        return self

    def maybe_single(self) -> "FakeQuery":
        self.single = True
        return self

    def eq(self, column: str, value: object) -> "FakeQuery":
        self.filters.append((column, value))
        return self

    def gte(self, column: str, value: object) -> "FakeQuery":
        self.comparisons.append(("gte", column, value))
        return self

    def lte(self, column: str, value: object) -> "FakeQuery":
        self.comparisons.append(("lte", column, value))
        return self

    def update(self, payload: dict[str, object]) -> "FakeQuery":
        self.operation = "update"
        self.payload = payload
        return self

    def insert(self, payload: dict[str, object]) -> "FakeQuery":
        self.operation = "insert"
        self.payload = payload
        return self

    def execute(self) -> SimpleNamespace:
        rows = self.database.tables.setdefault(self.table, [])

        def matches(row: dict[str, Any]) -> bool:
            if not all(row.get(column) == value for column, value in self.filters):
                return False
            for operator, column, value in self.comparisons:
                actual = row.get(column)
                if actual is None:
                    return False
                if operator == "gte" and actual < value:
                    return False
                if operator == "lte" and actual > value:
                    return False
            return True

        matching = [row for row in rows if matches(row)]
        call: dict[str, Any] = {
            "table": self.table,
            "operation": self.operation,
            "filters": list(self.filters),
            "payload": deepcopy(self.payload),
        }
        if self.comparisons:
            call["comparisons"] = list(self.comparisons)
        self.database.calls.append(call)

        if self.operation == "select":
            if self.single:
                return SimpleNamespace(data=deepcopy(matching[0]) if len(matching) == 1 else None)
            return SimpleNamespace(data=deepcopy(matching))

        if self.operation == "update":
            for row in matching:
                row.update(self.payload or {})
            return SimpleNamespace(data=deepcopy(matching))

        if self.operation == "insert":
            row = {"id": f"log-{len(rows) + 1}", **(self.payload or {})}
            rows.append(row)
            return SimpleNamespace(data=[deepcopy(row)])

        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self.tables = deepcopy(tables or {})
        self.calls: list[dict[str, Any]] = []

    def table(self, table: str) -> FakeQuery:
        return FakeQuery(self, table)


@pytest.fixture
def routine_log_client(monkeypatch: pytest.MonkeyPatch):
    database = FakeSupabase()
    monkeypatch.setattr(main, "supabase", database)
    main.app.dependency_overrides[main.get_current_user] = lambda: CURRENT_USER
    try:
        yield TestClient(main.app), database
    finally:
        main.app.dependency_overrides.clear()


def _writes(database: FakeSupabase) -> list[dict[str, Any]]:
    return [call for call in database.calls if call["operation"] in {"insert", "update"}]


def test_same_user_insert_uses_server_owner_and_ignores_client_user_id(routine_log_client):
    client, database = routine_log_client
    database.tables["routines"] = [{"id": ROUTINE_ID, "user_id": CURRENT_USER}]

    response = client.post(
        "/api/routine_logs",
        json={
            "routine_id": ROUTINE_ID,
            "date": LOG_DATE,
            "done": True,
            "user_id": FOREIGN_USER,
        },
    )

    assert response.status_code == 200
    assert database.tables["routine_logs"] == [{
        "id": "log-1",
        "user_id": CURRENT_USER,
        "routine_id": ROUTINE_ID,
        "date": LOG_DATE,
        "done": True,
    }]
    assert _writes(database) == [{
        "table": "routine_logs",
        "operation": "insert",
        "filters": [],
        "payload": {
            "user_id": CURRENT_USER,
            "routine_id": ROUTINE_ID,
            "date": LOG_DATE,
            "done": True,
        },
    }]


def test_same_user_existing_log_updates_only_its_own_row(routine_log_client):
    client, database = routine_log_client
    database.tables["routines"] = [{"id": ROUTINE_ID, "user_id": CURRENT_USER}]
    database.tables["routine_logs"] = [{
        "id": "log-a",
        "user_id": CURRENT_USER,
        "routine_id": ROUTINE_ID,
        "date": LOG_DATE,
        "done": False,
    }]

    response = client.post(
        "/api/routine_logs",
        json={"routine_id": ROUTINE_ID, "date": LOG_DATE, "done": True},
    )

    assert response.status_code == 200
    assert database.tables["routine_logs"][0]["done"] is True
    assert _writes(database) == [{
        "table": "routine_logs",
        "operation": "update",
        "filters": [("id", "log-a"), ("user_id", CURRENT_USER)],
        "payload": {"done": True},
    }]
    lookup = next(call for call in database.calls if call["table"] == "routine_logs" and call["operation"] == "select")
    assert set(lookup["filters"]) == {
        ("user_id", CURRENT_USER),
        ("routine_id", ROUTINE_ID),
        ("date", LOG_DATE),
    }


def test_repeated_same_user_update_does_not_insert_duplicate(routine_log_client):
    client, database = routine_log_client
    database.tables["routines"] = [{"id": ROUTINE_ID, "user_id": CURRENT_USER}]
    database.tables["routine_logs"] = [{
        "id": "log-a",
        "user_id": CURRENT_USER,
        "routine_id": ROUTINE_ID,
        "date": LOG_DATE,
        "done": False,
    }]

    first = client.post(
        "/api/routine_logs",
        json={"routine_id": ROUTINE_ID, "date": LOG_DATE, "done": True},
    )
    second = client.post(
        "/api/routine_logs",
        json={"routine_id": ROUTINE_ID, "date": LOG_DATE, "done": False},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(database.tables["routine_logs"]) == 1
    assert database.tables["routine_logs"][0]["done"] is False
    assert [call["operation"] for call in _writes(database)] == ["update", "update"]


def test_foreign_log_collision_is_not_selected_or_updated(routine_log_client):
    client, database = routine_log_client
    database.tables["routines"] = [{"id": ROUTINE_ID, "user_id": CURRENT_USER}]
    database.tables["routine_logs"] = [{
        "id": "log-b",
        "user_id": FOREIGN_USER,
        "routine_id": ROUTINE_ID,
        "date": LOG_DATE,
        "done": False,
    }]

    response = client.post(
        "/api/routine_logs",
        json={"routine_id": ROUTINE_ID, "date": LOG_DATE, "done": True},
    )

    assert response.status_code == 200
    assert database.tables["routine_logs"][0]["done"] is False
    assert database.tables["routine_logs"][1]["user_id"] == CURRENT_USER
    assert database.tables["routine_logs"][1]["done"] is True
    assert [call["operation"] for call in _writes(database)] == ["insert"]
    lookup = next(call for call in database.calls if call["table"] == "routine_logs" and call["operation"] == "select")
    assert set(lookup["filters"]) == {
        ("user_id", CURRENT_USER),
        ("routine_id", ROUTINE_ID),
        ("date", LOG_DATE),
    }


def test_same_date_different_user_toggle_cannot_affect_foreign_row(routine_log_client):
    client, database = routine_log_client
    database.tables["routines"] = [
        {"id": ROUTINE_ID, "user_id": CURRENT_USER},
        {"id": FOREIGN_ROUTINE_ID, "user_id": FOREIGN_USER},
    ]
    database.tables["routine_logs"] = [{
        "id": "log-b",
        "user_id": FOREIGN_USER,
        "routine_id": FOREIGN_ROUTINE_ID,
        "date": LOG_DATE,
        "done": False,
    }]

    response = client.post(
        "/api/routine_logs",
        json={"routine_id": ROUTINE_ID, "date": LOG_DATE, "done": True},
    )

    assert response.status_code == 200
    assert database.tables["routine_logs"] == [
        {
            "id": "log-b",
            "user_id": FOREIGN_USER,
            "routine_id": FOREIGN_ROUTINE_ID,
            "date": LOG_DATE,
            "done": False,
        },
        {
            "id": "log-2",
            "user_id": CURRENT_USER,
            "routine_id": ROUTINE_ID,
            "date": LOG_DATE,
            "done": True,
        },
    ]


def test_foreign_routine_fails_closed_before_any_routine_log_write(routine_log_client):
    client, database = routine_log_client
    database.tables["routines"] = [{"id": FOREIGN_ROUTINE_ID, "user_id": FOREIGN_USER}]
    database.tables["routine_logs"] = [{
        "id": "log-b",
        "user_id": FOREIGN_USER,
        "routine_id": FOREIGN_ROUTINE_ID,
        "date": LOG_DATE,
        "done": False,
    }]

    response = client.post(
        "/api/routine_logs",
        json={"routine_id": FOREIGN_ROUTINE_ID, "date": LOG_DATE, "done": True},
    )

    assert response.status_code == 403
    assert database.tables["routine_logs"][0]["done"] is False
    assert not [call for call in database.calls if call["table"] == "routine_logs"]


def test_missing_routine_returns_not_found_before_any_routine_log_write(routine_log_client):
    client, database = routine_log_client
    database.tables["routine_logs"] = [{
        "id": "log-b",
        "user_id": FOREIGN_USER,
        "routine_id": ROUTINE_ID,
        "date": LOG_DATE,
        "done": False,
    }]

    response = client.post(
        "/api/routine_logs",
        json={"routine_id": ROUTINE_ID, "date": LOG_DATE, "done": True},
    )

    assert response.status_code == 404
    assert database.tables["routine_logs"][0]["done"] is False
    assert not [call for call in database.calls if call["table"] == "routine_logs"]


def test_user_scoped_routine_reads_remain_unchanged(routine_log_client):
    client, database = routine_log_client
    database.tables = {
        "routines": [
            {"id": ROUTINE_ID, "user_id": CURRENT_USER, "text": "A", "is_active": True},
            {"id": FOREIGN_ROUTINE_ID, "user_id": FOREIGN_USER, "text": "B", "is_active": True},
        ],
        "routine_logs": [
            {"id": "log-a", "user_id": CURRENT_USER, "routine_id": ROUTINE_ID, "date": LOG_DATE, "done": True},
            {"id": "log-b", "user_id": FOREIGN_USER, "routine_id": FOREIGN_ROUTINE_ID, "date": LOG_DATE, "done": True},
        ],
        "routine_exceptions": [],
    }

    daily = client.get("/api/routines_with_logs", params={"date": LOG_DATE})
    period = client.get(
        "/api/routines/range",
        params={"start_date": LOG_DATE, "end_date": LOG_DATE},
    )

    assert daily.status_code == 200
    assert daily.json() == [{
        "id": ROUTINE_ID,
        "text": "A",
        "done": True,
        "is_active": True,
        "is_exception_day": False,
    }]
    assert period.status_code == 200
    assert period.json() == [{
        "date": LOG_DATE,
        "text": "A",
        "done": True,
        "is_active": True,
    }]

    routine_reads = [call for call in database.calls if call["table"] == "routines" and call["operation"] == "select"]
    log_reads = [call for call in database.calls if call["table"] == "routine_logs" and call["operation"] == "select"]
    assert routine_reads and all(("user_id", CURRENT_USER) in call["filters"] for call in routine_reads)
    assert log_reads and all(("user_id", CURRENT_USER) in call["filters"] for call in log_reads)
