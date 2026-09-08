from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import main


OWNER = "account-a"
FOREIGN_OWNER = "account-b"


class FakeDbError(Exception):
    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


def note_payload(note_id: str = "note-1", **overrides):
    payload = {
        "id": note_id,
        "title": "Title",
        "body": "Body",
        "updated_at": 100,
        "folder_id": None,
        "deleted_at": None,
        "starred": False,
        "properties": {"Type": "Test"},
        "relations": {"Related": ["note-2"]},
    }
    payload.update(overrides)
    return payload


def stored_row(note_id: str = "note-1", user_id: str = OWNER, **overrides):
    row = {"user_id": user_id, **note_payload(note_id)}
    row.update(overrides)
    return row


class NotesQuery:
    def __init__(self, client):
        self.client = client
        self.operation = "select"
        self.payload = None
        self.filters = []
        self.single = False
        self.columns = "*"

    def select(self, columns):
        self.operation = "select"
        self.columns = columns
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = dict(payload)
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = dict(payload)
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def _matches(self, row):
        return all(row.get(column) == value for column, value in self.filters)

    def execute(self):
        if self.operation == "select":
            if self.client.legacy_columns and any(
                column in self.columns.split(",") for column in main.NOTE_LEGACY_OPTIONAL_COLUMNS
            ):
                self.client.operations.append(("select", self.columns, list(self.filters)))
                raise FakeDbError("column starred does not exist", "42703")
            matches = [dict(row) for row in self.client.rows if self._matches(row)]
            self.client.operations.append(("select", self.columns, list(self.filters)))
            if self.client.select_override is not None:
                return SimpleNamespace(data=self.client.select_override)
            if self.single:
                return SimpleNamespace(data=matches[0] if len(matches) == 1 else None)
            return SimpleNamespace(data=matches)

        if self.client.legacy_columns and any(
            key in self.payload for key in main.NOTE_LEGACY_OPTIONAL_COLUMNS
        ):
            self.client.operations.append((self.operation, dict(self.payload), list(self.filters)))
            raise FakeDbError("column starred does not exist", "42703")

        if self.operation == "insert":
            self.client.operations.append(("insert", dict(self.payload), []))
            if any(row["id"] == self.payload["id"] for row in self.client.rows):
                raise FakeDbError("duplicate key violates unique constraint", "23505")
            row = dict(self.payload)
            self.client.rows.append(row)
            data = [dict(row)]
        else:
            if self.client.delete_before_update:
                self.client.rows[:] = [row for row in self.client.rows if not self._matches(row)]
            updated = []
            for row in self.client.rows:
                if self._matches(row):
                    row.update(self.payload)
                    updated.append(dict(row))
            self.client.operations.append(("update", dict(self.payload), list(self.filters)))
            data = updated

        if self.client.mutation_override is not None:
            data = self.client.mutation_override
        return SimpleNamespace(data=data)


class NotesSupabase:
    def __init__(self, rows=(), *, legacy_columns=False):
        self.rows = [dict(row) for row in rows]
        self.legacy_columns = legacy_columns
        self.delete_before_update = False
        self.select_override = None
        self.mutation_override = None
        self.operations = []

    def table(self, name):
        assert name == "notes"
        return NotesQuery(self)


@pytest.mark.asyncio
async def test_new_note_insert_assigns_authenticated_owner(monkeypatch):
    client = NotesSupabase()
    monkeypatch.setattr(main, "supabase", client)

    result = await main.upsert_note(main.NoteCreate(**note_payload()), OWNER)

    assert result == stored_row()
    assert client.rows == [stored_row()]
    assert [operation[0] for operation in client.operations] == ["select", "insert"]


@pytest.mark.asyncio
async def test_existing_note_update_is_predicated_by_id_and_owner(monkeypatch):
    client = NotesSupabase([stored_row(title="Old", updated_at=50)])
    monkeypatch.setattr(main, "supabase", client)

    result = await main.upsert_note(main.NoteCreate(**note_payload(title="New")), OWNER)

    update = client.operations[-1]
    assert update[0] == "update"
    assert ("id", "note-1") in update[2]
    assert ("user_id", OWNER) in update[2]
    assert "user_id" not in update[1]
    assert result["title"] == "New"


@pytest.mark.asyncio
async def test_foreign_same_id_collision_is_generic_and_does_not_mutate_or_disclose(monkeypatch):
    foreign = stored_row(user_id=FOREIGN_OWNER, title="private title", body="private body")
    client = NotesSupabase([foreign])
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.upsert_note(main.NoteCreate(**note_payload()), OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "NOTE_ID_UNAVAILABLE"
    assert client.rows == [foreign]
    assert "private" not in str(error.value.detail)


@pytest.mark.asyncio
async def test_owner_row_disappearance_fails_without_insert_fallback(monkeypatch):
    client = NotesSupabase([stored_row()])
    client.delete_before_update = True
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.upsert_note(main.NoteCreate(**note_payload(title="Changed")), OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "NOTE_WRITE_CONFLICT"
    assert [operation[0] for operation in client.operations] == ["select", "update"]
    assert client.rows == []


@pytest.mark.asyncio
async def test_client_user_id_cannot_transfer_note_ownership(monkeypatch):
    client = NotesSupabase([stored_row()])
    monkeypatch.setattr(main, "supabase", client)
    requested = main.NoteCreate(**note_payload(), user_id=FOREIGN_OWNER)

    result = await main.upsert_note(requested, OWNER)

    assert result["user_id"] == OWNER
    assert client.rows[0]["user_id"] == OWNER
    assert "user_id" not in client.operations[-1][1]


@pytest.mark.asyncio
async def test_success_returns_exact_normalized_authoritative_fields(monkeypatch):
    client = NotesSupabase()
    monkeypatch.setattr(main, "supabase", client)

    result = await main.upsert_note(main.NoteCreate(**note_payload()), OWNER)

    assert set(result) == set(main.NOTE_AUTHORITATIVE_COLUMNS.split(","))
    assert result == stored_row()


@pytest.mark.asyncio
async def test_malformed_mutation_result_fails_closed(monkeypatch):
    client = NotesSupabase()
    client.mutation_override = []
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.upsert_note(main.NoteCreate(**note_payload()), OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "NOTE_WRITE_UNCONFIRMED"


@pytest.mark.asyncio
async def test_exact_owner_readback_returns_authoritative_row(monkeypatch):
    client = NotesSupabase([stored_row()])
    monkeypatch.setattr(main, "supabase", client)

    result = await main.get_note("note-1", OWNER)

    assert result == stored_row()
    assert client.operations[-1][2] == [("id", "note-1"), ("user_id", OWNER)]


@pytest.mark.asyncio
@pytest.mark.parametrize("rows", [[], [stored_row(user_id=FOREIGN_OWNER)]])
async def test_foreign_and_absent_readback_are_indistinguishable(monkeypatch, rows):
    client = NotesSupabase(rows)
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.get_note("note-1", OWNER)

    assert error.value.status_code == 404
    assert error.value.detail == "Not found"


@pytest.mark.asyncio
async def test_legacy_retry_preserves_owner_predicate_and_authoritative_contract(monkeypatch):
    legacy_row = stored_row()
    for key in main.NOTE_LEGACY_OPTIONAL_COLUMNS:
        legacy_row.pop(key)
    client = NotesSupabase([legacy_row], legacy_columns=True)
    monkeypatch.setattr(main, "supabase", client)

    result = await main.upsert_note(main.NoteCreate(**note_payload()), OWNER)

    updates = [operation for operation in client.operations if operation[0] == "update"]
    assert len(updates) == 2
    assert all(("id", "note-1") in operation[2] and ("user_id", OWNER) in operation[2] for operation in updates)
    assert set(result) == set(main.NOTE_AUTHORITATIVE_COLUMNS.split(","))
    assert result["starred"] is False
    assert result["properties"] is None
    assert result["relations"] is None


@pytest.mark.asyncio
async def test_legacy_readback_retries_only_with_owner_scoped_core_columns(monkeypatch):
    legacy_row = stored_row()
    for key in main.NOTE_LEGACY_OPTIONAL_COLUMNS:
        legacy_row.pop(key)
    client = NotesSupabase([legacy_row], legacy_columns=True)
    monkeypatch.setattr(main, "supabase", client)

    result = await main.get_note("note-1", OWNER)

    selects = [operation for operation in client.operations if operation[0] == "select"]
    assert [operation[1] for operation in selects] == [
        main.NOTE_AUTHORITATIVE_COLUMNS,
        main.NOTE_LEGACY_AUTHORITATIVE_COLUMNS,
    ]
    assert all(operation[2] == [("id", "note-1"), ("user_id", OWNER)] for operation in selects)
    assert result == {**legacy_row, "starred": False, "properties": None, "relations": None}
