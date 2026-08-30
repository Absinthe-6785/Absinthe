from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace
from typing import Any

from fastapi.testclient import TestClient
import pytest

import main


CURRENT_USER = "user-a"
FOREIGN_USER = "user-b"
START_DATE = "2026-08-01"
END_DATE = "2026-08-03"


class FakeQuery:
    """Small read-only Supabase double that honors select projections and filters."""

    def __init__(self, database: "FakeSupabase", table: str) -> None:
        self.database = database
        self.table = table
        self.operation: str | None = None
        self.selected_columns: list[str] | None = None
        self.filters: list[tuple[str, object]] = []
        self.comparisons: list[tuple[str, str, object]] = []

    def select(self, columns: str) -> "FakeQuery":
        self.operation = "select"
        parsed = [column.strip() for column in columns.split(",") if column.strip()]
        self.selected_columns = None if parsed == ["*"] else parsed
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
        self.database.calls.append(
            {
                "table": self.table,
                "operation": self.operation,
                "selected_columns": deepcopy(self.selected_columns),
                "filters": list(self.filters),
                "comparisons": list(self.comparisons),
            }
        )

        if self.operation != "select":
            return SimpleNamespace(data=[])

        if self.selected_columns is None:
            projected = deepcopy(matching)
        else:
            projected = [
                {column: deepcopy(row.get(column)) for column in self.selected_columns}
                for row in matching
            ]
        return SimpleNamespace(data=projected)


class FakeSupabase:
    def __init__(self, tables: dict[str, list[dict[str, Any]]] | None = None) -> None:
        self.tables = deepcopy(tables or {})
        self.calls: list[dict[str, Any]] = []

    def table(self, table: str) -> FakeQuery:
        return FakeQuery(self, table)


@pytest.fixture
def routines_range_client(monkeypatch: pytest.MonkeyPatch):
    database = FakeSupabase()
    monkeypatch.setattr(main, "supabase", database)
    main.app.dependency_overrides[main.get_current_user] = lambda: CURRENT_USER
    try:
        yield TestClient(main.app), database
    finally:
        main.app.dependency_overrides.clear()


def _range(client: TestClient, start_date: str = START_DATE, end_date: str = END_DATE):
    return client.get(
        "/api/routines/range",
        params={"start_date": start_date, "end_date": end_date},
    )


def _select_calls(database: FakeSupabase, table: str) -> list[dict[str, Any]]:
    return [
        call
        for call in database.calls
        if call["table"] == table and call["operation"] == "select"
    ]


def _writes(database: FakeSupabase) -> list[dict[str, Any]]:
    return [call for call in database.calls if call["operation"] in {"insert", "update", "delete"}]


def test_soft_deleted_routine_selects_deleted_at_and_excludes_post_delete_logs(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [{
            "id": "routine-deleted",
            "user_id": CURRENT_USER,
            "text": "Retired routine",
            "is_active": False,
            "deleted_at": "2026-08-02",
        }],
        "routine_logs": [
            {"id": "log-before", "user_id": CURRENT_USER, "routine_id": "routine-deleted", "date": "2026-08-01", "done": True},
            {"id": "log-delete-day", "user_id": CURRENT_USER, "routine_id": "routine-deleted", "date": "2026-08-02", "done": False},
            {"id": "log-after", "user_id": CURRENT_USER, "routine_id": "routine-deleted", "date": "2026-08-03", "done": True},
        ],
        "routine_exceptions": [],
    }

    response = _range(client)

    assert response.status_code == 200
    assert response.json() == [{
        "date": "2026-08-01",
        "text": "Retired routine",
        "done": True,
        "is_active": False,
    }]
    routine_read = _select_calls(database, "routines")
    assert len(routine_read) == 1
    assert routine_read[0]["selected_columns"] == ["id", "text", "is_active", "deleted_at"]
    assert not _writes(database)


def test_active_routine_range_behavior_is_preserved(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [{
            "id": "routine-active",
            "user_id": CURRENT_USER,
            "text": "Active routine",
            "is_active": True,
            "deleted_at": None,
        }],
        "routine_logs": [
            {"id": "log-before", "user_id": CURRENT_USER, "routine_id": "routine-active", "date": "2026-07-31", "done": True},
            {"id": "log-start", "user_id": CURRENT_USER, "routine_id": "routine-active", "date": "2026-08-01", "done": False},
            {"id": "log-end", "user_id": CURRENT_USER, "routine_id": "routine-active", "date": "2026-08-03", "done": True},
            {"id": "log-after", "user_id": CURRENT_USER, "routine_id": "routine-active", "date": "2026-08-04", "done": False},
        ],
        "routine_exceptions": [],
    }

    response = _range(client)

    assert response.status_code == 200
    assert [row["date"] for row in response.json()] == ["2026-08-01", "2026-08-03"]
    assert all(row["is_active"] is True for row in response.json())
    assert not _writes(database)


def test_inactive_routine_without_deleted_at_remains_distinct(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [{
            "id": "routine-inactive",
            "user_id": CURRENT_USER,
            "text": "Inactive without deletion timestamp",
            "is_active": False,
            "deleted_at": None,
        }],
        "routine_logs": [{
            "id": "log-inactive",
            "user_id": CURRENT_USER,
            "routine_id": "routine-inactive",
            "date": "2026-08-02",
            "done": True,
        }],
        "routine_exceptions": [],
    }

    response = _range(client, "2026-08-02", "2026-08-02")

    assert response.status_code == 200
    assert response.json() == [{
        "date": "2026-08-02",
        "text": "Inactive without deletion timestamp",
        "done": True,
        "is_active": False,
    }]
    assert not _writes(database)


def test_historical_logs_are_preserved_without_mutation(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [{
            "id": "routine-history",
            "user_id": CURRENT_USER,
            "text": "Historical routine",
            "is_active": False,
            "deleted_at": "2026-08-02",
        }],
        "routine_logs": [
            {"id": "log-old", "user_id": CURRENT_USER, "routine_id": "routine-history", "date": "2026-08-01", "done": True},
            {"id": "log-new", "user_id": CURRENT_USER, "routine_id": "routine-history", "date": "2026-08-03", "done": True},
        ],
        "routine_exceptions": [],
    }
    original_logs = deepcopy(database.tables["routine_logs"])

    response = _range(client)

    assert response.status_code == 200
    assert [row["date"] for row in response.json()] == ["2026-08-01"]
    assert database.tables["routine_logs"] == original_logs
    assert not _writes(database)


def test_routine_exception_dates_still_exclude_matching_logs(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [{
            "id": "routine-exception",
            "user_id": CURRENT_USER,
            "text": "Exception-aware routine",
            "is_active": True,
            "deleted_at": None,
        }],
        "routine_logs": [
            {"id": "log-one", "user_id": CURRENT_USER, "routine_id": "routine-exception", "date": "2026-08-01", "done": True},
            {"id": "log-two", "user_id": CURRENT_USER, "routine_id": "routine-exception", "date": "2026-08-02", "done": True},
            {"id": "log-three", "user_id": CURRENT_USER, "routine_id": "routine-exception", "date": "2026-08-03", "done": False},
        ],
        "routine_exceptions": [{
            "id": "exception-a",
            "user_id": CURRENT_USER,
            "start_date": "2026-08-02",
            "end_date": "2026-08-02",
        }],
    }

    response = _range(client)

    assert response.status_code == 200
    assert [row["date"] for row in response.json()] == ["2026-08-01", "2026-08-03"]
    assert not _writes(database)


def test_date_range_boundaries_are_inclusive_and_read_only(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [{
            "id": "routine-boundary",
            "user_id": CURRENT_USER,
            "text": "Boundary routine",
            "is_active": True,
            "deleted_at": None,
        }],
        "routine_logs": [
            {"id": "log-before", "user_id": CURRENT_USER, "routine_id": "routine-boundary", "date": "2026-07-31", "done": True},
            {"id": "log-start", "user_id": CURRENT_USER, "routine_id": "routine-boundary", "date": START_DATE, "done": False},
            {"id": "log-end", "user_id": CURRENT_USER, "routine_id": "routine-boundary", "date": END_DATE, "done": True},
            {"id": "log-after", "user_id": CURRENT_USER, "routine_id": "routine-boundary", "date": "2026-08-04", "done": False},
        ],
        "routine_exceptions": [],
    }
    original_tables = deepcopy(database.tables)

    response = _range(client)

    assert response.status_code == 200
    assert [row["date"] for row in response.json()] == [START_DATE, END_DATE]
    assert database.tables == original_tables
    assert not _writes(database)


def test_account_scope_excludes_foreign_rows_and_scopes_all_reads(routines_range_client):
    client, database = routines_range_client
    database.tables = {
        "routines": [
            {"id": "routine-a", "user_id": CURRENT_USER, "text": "Mine", "is_active": True, "deleted_at": None},
            {"id": "routine-b", "user_id": FOREIGN_USER, "text": "Foreign", "is_active": True, "deleted_at": None},
        ],
        "routine_logs": [
            {"id": "log-a", "user_id": CURRENT_USER, "routine_id": "routine-a", "date": "2026-08-02", "done": True},
            {"id": "log-b", "user_id": FOREIGN_USER, "routine_id": "routine-b", "date": "2026-08-02", "done": True},
        ],
        "routine_exceptions": [{
            "id": "exception-b",
            "user_id": FOREIGN_USER,
            "start_date": "2026-08-02",
            "end_date": "2026-08-02",
        }],
    }

    response = _range(client, "2026-08-02", "2026-08-02")

    assert response.status_code == 200
    assert response.json() == [{
        "date": "2026-08-02",
        "text": "Mine",
        "done": True,
        "is_active": True,
    }]
    for table in ("routines", "routine_logs", "routine_exceptions"):
        reads = _select_calls(database, table)
        assert len(reads) == 1
        assert ("user_id", CURRENT_USER) in reads[0]["filters"]
    assert not _writes(database)
