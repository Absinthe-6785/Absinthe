from types import SimpleNamespace

from fastapi import HTTPException
from fastapi.testclient import TestClient
import pytest

import main


class FakeTable:
    def __init__(self, database: "FakeSupabase", table: str):
        self.database = database
        self.table = table
        self.operation = None
        self.filters: list[tuple[str, object]] = []
        self.ids: set[str] | None = None

    def select(self, _columns: str):
        self.operation = "select"
        return self

    def in_(self, column: str, values: list[str]):
        if column != "id":
            raise AssertionError(column)
        self.ids = set(values)
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, column: str, value: object):
        self.filters.append((column, value))
        return self

    def upsert(self, rows: list[dict], on_conflict: str):
        self.operation = "upsert"
        self.database.operations.append({
            "kind": "upsert",
            "table": self.table,
            "rows": rows,
            "on_conflict": on_conflict,
        })
        return self

    def execute(self):
        if self.operation == "select":
            rows = self.database.existing_by_table.get(self.table, [])
            if self.ids is not None:
                rows = [row for row in rows if row.get("id") in self.ids]
            self.database.operations.append({"kind": "select", "table": self.table, "ids": self.ids})
            return SimpleNamespace(data=rows)
        if self.operation == "delete":
            self.database.operations.append({"kind": "delete", "table": self.table, "filters": self.filters})
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self):
        self.existing_by_table: dict[str, list[dict]] = {}
        self.operations: list[dict] = []

    def table(self, table: str) -> FakeTable:
        return FakeTable(self, table)

    @property
    def writes(self) -> list[dict]:
        return [operation for operation in self.operations if operation["kind"] in {"delete", "upsert"}]


def note_row(note_id: str = "note-1", user_id: str | None = None) -> dict:
    row = {"id": note_id, "title": "Note", "body": "Body", "updated_at": 1}
    if user_id is not None:
        row["user_id"] = user_id
    return row


def folder_row(folder_id: str = "folder-1") -> dict:
    return {"id": folder_id, "name": "Folder", "created_at": 1}


def schedule_row(schedule_id: str = "schedule-1") -> dict:
    return {
        "id": schedule_id,
        "date": "2026-08-18",
        "text": "Study",
        "start_time": "09:00",
        "end_time": "10:00",
    }


def weekly_schedule_row(weekly_id: str = "weekly-1", user_id: str | None = None) -> dict:
    row = {
        "id": weekly_id,
        "day": 0,
        "title": "Weekly study",
        "start_time": "09:00",
        "end_time": "10:00",
        "color": "blue",
    }
    if user_id is not None:
        row["user_id"] = user_id
    return row


@pytest.fixture
def destructive_client(monkeypatch: pytest.MonkeyPatch):
    supabase = FakeSupabase()
    monkeypatch.setattr(main, "supabase", supabase)
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", False)
    main.app.dependency_overrides[main.get_current_user] = lambda: "test-user"
    try:
        yield TestClient(main.app), supabase
    finally:
        main.app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_reset_is_locked_in_recovery_mode(monkeypatch: pytest.MonkeyPatch):
    supabase = FakeSupabase()
    monkeypatch.setattr(main, "supabase", supabase)
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", True)
    with pytest.raises(HTTPException) as exc:
        await main.reset_all_data("test-user")
    assert exc.value.status_code == 423
    assert supabase.writes == []


@pytest.mark.asyncio
async def test_restore_is_locked_before_any_table_write(monkeypatch: pytest.MonkeyPatch):
    supabase = FakeSupabase()
    monkeypatch.setattr(main, "supabase", supabase)
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", True)
    with pytest.raises(HTTPException) as exc:
        await main.import_backup(main.RestorePayload(), "test-user")
    assert exc.value.status_code == 423
    assert supabase.writes == []


@pytest.mark.asyncio
async def test_non_destructive_health_endpoints_remain_available():
    assert await main.root() == {"status": "ok"}
    assert await main.ping() == {"pong": True}


@pytest.mark.parametrize("header", [None, "reset-wrong", ""])
def test_reset_rejects_missing_wrong_and_empty_intent(destructive_client, header):
    client, supabase = destructive_client
    headers = {} if header is None else {"X-Absinthe-Recovery-Intent": header}
    response = client.delete("/api/reset", headers=headers)
    assert response.status_code == 428
    assert supabase.writes == []


@pytest.mark.parametrize("header", [None, "restore-wrong", ""])
def test_restore_rejects_missing_wrong_and_empty_intent(destructive_client, header):
    client, supabase = destructive_client
    headers = {} if header is None else {"X-Absinthe-Recovery-Intent": header}
    response = client.post("/api/restore", headers=headers, json={})
    assert response.status_code == 428
    assert supabase.writes == []


@pytest.mark.parametrize(
    ("method", "path", "headers", "payload"),
    [
        ("DELETE", "/api/reset", {"X-Absinthe-Recovery-Intent": main.RESET_RECOVERY_INTENT}, None),
        ("POST", "/api/restore", {"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT}, {}),
    ],
)
def test_destructive_recovery_requires_authentication(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    headers: dict[str, str],
    payload: dict | None,
):
    monkeypatch.setattr(main, "RECOVERY_MODE_ACTIVE", False)
    response = TestClient(main.app).request(method, path, headers=headers, json=payload)
    assert response.status_code in {401, 403}


def test_reset_exact_intent_runs_only_authenticated_account_scope(destructive_client):
    client, supabase = destructive_client
    response = client.delete(
        "/api/reset",
        headers={"X-Absinthe-Recovery-Intent": main.RESET_RECOVERY_INTENT},
    )
    assert response.status_code == 200
    expected_tables = [
        "routine_logs", "routine_exceptions", "workout_logs", "inbody_logs", "schedules", "todos",
        "weekly_schedules", "notes", "note_folders", "routines", "exercise_blocks", "health_routines", "recipes",
    ]
    assert [write["table"] for write in supabase.writes] == expected_tables
    assert all(write["filters"] == [("user_id", "test-user")] for write in supabase.writes)


def test_reset_ignores_request_account_target(destructive_client):
    client, supabase = destructive_client
    response = client.delete(
        "/api/reset?user_id=other-user",
        headers={"X-Absinthe-Recovery-Intent": main.RESET_RECOVERY_INTENT},
    )
    assert response.status_code == 200
    assert all(write["filters"] == [("user_id", "test-user")] for write in supabase.writes)


def test_restore_rejects_malformed_top_level_and_unknown_table(destructive_client):
    client, supabase = destructive_client
    headers = {"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT}
    assert client.post("/api/restore", headers=headers, json={"notes": "not-a-list"}).status_code == 422
    assert client.post("/api/restore", headers=headers, json={"unexpected": []}).status_code == 422
    assert supabase.writes == []


def test_restore_rejects_invalid_row_shape_and_unknown_field(destructive_client):
    client, supabase = destructive_client
    headers = {"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT}
    assert client.post("/api/restore", headers=headers, json={"notes": [1]}).status_code == 422
    assert client.post("/api/restore", headers=headers, json={"notes": [{**note_row(), "unexpected": True}]}).status_code == 422
    assert supabase.writes == []


def test_restore_rejects_duplicate_ids_and_row_cap_before_writes(destructive_client):
    client, supabase = destructive_client
    headers = {"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT}
    duplicate = client.post("/api/restore", headers=headers, json={"notes": [note_row(), note_row()]})
    too_many = client.post(
        "/api/restore",
        headers=headers,
        json={"notes": [{"title": "N", "body": "B", "updated_at": 1} for _ in range(main.MAX_RESTORE_ROWS + 1)]},
    )
    assert duplicate.status_code == 422
    assert too_many.status_code == 422
    assert supabase.writes == []


def test_restore_rejects_foreign_payload_owner_before_writes(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"notes": [note_row(user_id="other-user")]},
    )
    assert response.status_code == 403
    assert supabase.writes == []


def test_restore_rejects_existing_foreign_id_before_any_write(destructive_client):
    client, supabase = destructive_client
    supabase.existing_by_table["notes"] = [{"id": "note-1", "user_id": "other-user"}]
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"note_folders": [folder_row()], "notes": [note_row()]},
    )
    assert response.status_code == 409
    assert supabase.writes == []


def test_restore_allows_existing_own_id_and_forces_authenticated_owner(destructive_client):
    client, supabase = destructive_client
    supabase.existing_by_table["notes"] = [{"id": "note-1", "user_id": "test-user"}]
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"notes": [note_row()]},
    )
    assert response.status_code == 200
    upsert = next(write for write in supabase.writes if write["kind"] == "upsert")
    assert upsert["rows"][0]["user_id"] == "test-user"
    assert upsert["on_conflict"] == "id"


def test_restore_fails_closed_on_ambiguous_existing_id_metadata(destructive_client):
    client, supabase = destructive_client
    supabase.existing_by_table["notes"] = [
        {"id": "note-1", "user_id": "test-user"},
        {"id": "note-1", "user_id": "test-user"},
    ]
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"notes": [note_row()]},
    )
    assert response.status_code == 503
    assert supabase.writes == []


def test_restore_writes_valid_rows_after_all_preflight_checks(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"notes": [note_row()], "schedules": [schedule_row()]},
    )
    assert response.status_code == 200
    assert [write["table"] for write in supabase.writes] == ["notes", "schedules"]
    assert all(write["rows"][0]["user_id"] == "test-user" for write in supabase.writes)


def test_late_table_invalid_payload_causes_zero_writes(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={
            "note_folders": [folder_row()],
            "schedules": [{**schedule_row(), "start_time": 9}],
        },
    )
    assert response.status_code == 422
    assert supabase.writes == []


def test_late_table_collision_causes_zero_writes(destructive_client):
    client, supabase = destructive_client
    supabase.existing_by_table["notes"] = [{"id": "note-1", "user_id": "other-user"}]
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"note_folders": [folder_row()], "notes": [note_row()]},
    )
    assert response.status_code == 409
    assert supabase.writes == []


def test_restore_dispatches_weekly_schedule_and_rebinds_current_owner(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"weekly_schedules": [weekly_schedule_row()]},
    )
    assert response.status_code == 200
    upserts = [write for write in supabase.writes if write["kind"] == "upsert"]
    assert len(upserts) == 1
    assert upserts[0]["table"] == "weekly_schedules"
    assert upserts[0]["rows"] == [{**weekly_schedule_row(), "user_id": "test-user"}]
    assert upserts[0]["on_conflict"] == "id"


def test_restore_rejects_foreign_serialized_weekly_owner_before_write(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"weekly_schedules": [weekly_schedule_row(user_id="other-user")]},
    )
    assert response.status_code == 403
    assert supabase.writes == []


def test_restore_rejects_foreign_weekly_id_before_write(destructive_client):
    client, supabase = destructive_client
    supabase.existing_by_table["weekly_schedules"] = [weekly_schedule_row(user_id="other-user")]
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"weekly_schedules": [weekly_schedule_row()]},
    )
    assert response.status_code == 409
    assert supabase.writes == []


def test_restore_upserts_same_user_weekly_id_without_delete(destructive_client):
    client, supabase = destructive_client
    existing = weekly_schedule_row(user_id="test-user")
    supabase.existing_by_table["weekly_schedules"] = [existing]
    replacement = {**weekly_schedule_row(), "title": "Updated weekly study"}
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={"weekly_schedules": [replacement]},
    )
    assert response.status_code == 200
    assert [write["kind"] for write in supabase.writes] == ["upsert"]
    assert supabase.writes[0]["table"] == "weekly_schedules"
    assert supabase.writes[0]["rows"] == [{**replacement, "user_id": "test-user"}]


def test_restore_weekly_absence_and_empty_collection_are_non_destructive(destructive_client):
    client, supabase = destructive_client
    existing = weekly_schedule_row("weekly-existing", user_id="test-user")
    supabase.existing_by_table["weekly_schedules"] = [existing]
    headers = {"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT}

    empty = client.post("/api/restore", headers=headers, json={"weekly_schedules": []})
    missing = client.post("/api/restore", headers=headers, json={})

    assert empty.status_code == 200
    assert missing.status_code == 200
    assert supabase.writes == []
    assert supabase.existing_by_table["weekly_schedules"] == [existing]


def test_restore_rejects_malformed_weekly_row_before_any_write(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={
            "schedules": [schedule_row()],
            "weekly_schedules": [{**weekly_schedule_row(), "start_time": 900}],
        },
    )
    assert response.status_code == 422
    assert supabase.writes == []


def test_restore_preserves_existing_planner_domain_dispatch(destructive_client):
    client, supabase = destructive_client
    response = client.post(
        "/api/restore",
        headers={"X-Absinthe-Recovery-Intent": main.RESTORE_RECOVERY_INTENT},
        json={
            "schedules": [schedule_row()],
            "todos": [{"date": "2026-08-18", "text": "Task"}],
            "routines": [{"text": "Routine"}],
            "routine_logs": [{"date": "2026-08-18", "done": False}],
            "ddays": [{"date": "2026-08-18", "text": "D-day"}],
            "routine_exceptions": [{"start_date": "2026-08-18", "end_date": "2026-08-19"}],
        },
    )
    assert response.status_code == 200
    assert [write["table"] for write in supabase.writes] == [
        "schedules", "todos", "routines", "routine_logs", "ddays", "routine_exceptions",
    ]
