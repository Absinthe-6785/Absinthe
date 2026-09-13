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


def folder_payload(folder_id: str = "folder-1", **overrides):
    payload = {"id": folder_id, "name": "Folder", "created_at": 100}
    payload.update(overrides)
    return payload


def folder_row(folder_id: str = "folder-1", user_id: str = OWNER, **overrides):
    row = {"user_id": user_id, **folder_payload(folder_id)}
    row.update(overrides)
    return row


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
        "relations": {"Related": []},
    }
    payload.update(overrides)
    return payload


def note_row(note_id: str = "note-1", user_id: str = OWNER, **overrides):
    row = {"user_id": user_id, **note_payload(note_id)}
    row.update(overrides)
    return row


class OwnershipQuery:
    def __init__(self, client, table_name: str):
        self.client = client
        self.table_name = table_name
        self.operation = "select"
        self.columns = "*"
        self.payload = None
        self.filters = []
        self.single = False

    def select(self, columns):
        self.operation = "select"
        self.columns = columns
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = dict(payload)
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = dict(payload)
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def _matches(self, row):
        return all(row.get(column) == value for column, value in self.filters)

    def _project(self, row):
        if self.columns == "*":
            return dict(row)
        return {column: row.get(column) for column in self.columns.split(",")}

    def execute(self):
        rows = self.client.rows[self.table_name]
        if self.operation == "select":
            matches = [self._project(row) for row in rows if self._matches(row)]
            self.client.operations.append(
                (self.table_name, "select", self.columns, list(self.filters))
            )
            if self.single:
                return SimpleNamespace(data=matches[0] if len(matches) == 1 else None)
            return SimpleNamespace(data=matches)

        if self.client.before_mutation is not None:
            callback = self.client.before_mutation
            self.client.before_mutation = None
            callback(self, self.client)

        if self.operation == "insert":
            self.client.operations.append(
                (self.table_name, "insert", dict(self.payload), [])
            )
            if any(row.get("id") == self.payload.get("id") for row in rows):
                raise FakeDbError("duplicate key violates unique constraint", "23505")
            inserted = dict(self.payload)
            rows.append(inserted)
            data = [dict(inserted)]
        elif self.operation == "update":
            updated = []
            for row in rows:
                if self._matches(row):
                    row.update(self.payload)
                    updated.append(dict(row))
            self.client.operations.append(
                (self.table_name, "update", dict(self.payload), list(self.filters))
            )
            data = updated
        else:
            deleted = [dict(row) for row in rows if self._matches(row)]
            rows[:] = [row for row in rows if not self._matches(row)]
            self.client.operations.append(
                (self.table_name, "delete", None, list(self.filters))
            )
            data = deleted

        override = self.client.mutation_overrides.get((self.table_name, self.operation))
        if override is not None:
            data = override
        return SimpleNamespace(data=data)


class OwnershipSupabase:
    def __init__(self, *, folders=(), notes=()):
        self.rows = {
            "note_folders": [dict(row) for row in folders],
            "notes": [dict(row) for row in notes],
        }
        self.operations = []
        self.before_mutation = None
        self.mutation_overrides = {}

    def table(self, name):
        assert name in self.rows
        return OwnershipQuery(self, name)


@pytest.mark.asyncio
async def test_folder_create_assigns_authenticated_owner(monkeypatch):
    client = OwnershipSupabase()
    monkeypatch.setattr(main, "supabase", client)

    result = await main.upsert_note_folder(
        main.NoteFolderCreate(**folder_payload(), user_id=FOREIGN_OWNER), OWNER
    )

    assert result == [folder_row()]
    assert client.rows["note_folders"] == [folder_row()]
    assert [operation[1] for operation in client.operations] == ["select", "insert"]
    assert client.operations[-1][2]["user_id"] == OWNER


@pytest.mark.asyncio
async def test_folder_same_owner_update_is_owner_scoped_and_validated(monkeypatch):
    client = OwnershipSupabase(folders=[folder_row(name="Old", created_at=50)])
    monkeypatch.setattr(main, "supabase", client)

    result = await main.upsert_note_folder(
        main.NoteFolderCreate(**folder_payload(name="Renamed", created_at=100)), OWNER
    )

    update = client.operations[-1]
    assert update == (
        "note_folders",
        "update",
        {"name": "Renamed", "created_at": 100},
        [("id", "folder-1"), ("user_id", OWNER)],
    )
    assert result == [folder_row(name="Renamed", created_at=100)]


@pytest.mark.asyncio
async def test_folder_cross_owner_create_or_update_collision_is_generic(monkeypatch):
    foreign = folder_row(user_id=FOREIGN_OWNER, name="Private folder")
    client = OwnershipSupabase(folders=[foreign])
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.upsert_note_folder(main.NoteFolderCreate(**folder_payload()), OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "FOLDER_ID_UNAVAILABLE"
    assert "Private" not in str(error.value.detail)
    assert client.rows["note_folders"] == [foreign]
    assert [operation[1] for operation in client.operations] == ["select"]


@pytest.mark.asyncio
async def test_folder_insert_race_maps_collision_without_owner_transfer(monkeypatch):
    client = OwnershipSupabase()
    monkeypatch.setattr(main, "supabase", client)

    def insert_foreign_folder(query, db):
        if query.table_name == "note_folders" and query.operation == "insert":
            db.rows["note_folders"].append(folder_row(user_id=FOREIGN_OWNER, name="Private"))

    client.before_mutation = insert_foreign_folder

    with pytest.raises(HTTPException) as error:
        await main.upsert_note_folder(main.NoteFolderCreate(**folder_payload()), OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "FOLDER_ID_UNAVAILABLE"
    assert client.rows["note_folders"] == [folder_row(user_id=FOREIGN_OWNER, name="Private")]


@pytest.mark.asyncio
async def test_folder_update_stale_preflight_fails_on_final_owner_predicate(monkeypatch):
    client = OwnershipSupabase(folders=[folder_row(name="Original")])
    monkeypatch.setattr(main, "supabase", client)

    def transfer_before_update(query, db):
        if query.table_name == "note_folders" and query.operation == "update":
            db.rows["note_folders"][0]["user_id"] = FOREIGN_OWNER

    client.before_mutation = transfer_before_update

    with pytest.raises(HTTPException) as error:
        await main.upsert_note_folder(
            main.NoteFolderCreate(**folder_payload(name="Attacker change")), OWNER
        )

    assert error.value.status_code == 409
    assert error.value.detail == "FOLDER_WRITE_CONFLICT"
    assert client.rows["note_folders"][0]["name"] == "Original"
    assert client.operations[-1][3] == [("id", "folder-1"), ("user_id", OWNER)]


@pytest.mark.asyncio
async def test_folder_cross_owner_delete_changes_nothing(monkeypatch):
    foreign_folder = folder_row(user_id=FOREIGN_OWNER)
    foreign_note = note_row(user_id=FOREIGN_OWNER, folder_id="folder-1")
    client = OwnershipSupabase(folders=[foreign_folder], notes=[foreign_note])
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.delete_note_folder("folder-1", OWNER)

    assert error.value.status_code == 403
    assert error.value.detail == "Forbidden"
    assert client.rows["note_folders"] == [foreign_folder]
    assert client.rows["notes"] == [foreign_note]
    assert [operation[1] for operation in client.operations] == ["select"]


@pytest.mark.asyncio
async def test_folder_delete_clears_only_authenticated_users_relationships(monkeypatch):
    own_note = note_row("own-note", folder_id="folder-1")
    foreign_note = note_row("foreign-note", user_id=FOREIGN_OWNER, folder_id="folder-1")
    client = OwnershipSupabase(folders=[folder_row()], notes=[own_note, foreign_note])
    monkeypatch.setattr(main, "supabase", client)

    result = await main.delete_note_folder("folder-1", OWNER)

    assert result == [folder_row()]
    assert client.rows["note_folders"] == []
    assert client.rows["notes"][0]["folder_id"] is None
    assert client.rows["notes"][1] == foreign_note
    relationship_update = client.operations[1]
    folder_delete = client.operations[2]
    assert relationship_update[3] == [("folder_id", "folder-1"), ("user_id", OWNER)]
    assert folder_delete[3] == [("id", "folder-1"), ("user_id", OWNER)]


@pytest.mark.asyncio
async def test_folder_delete_stale_preflight_cannot_delete_new_owner(monkeypatch):
    client = OwnershipSupabase(folders=[folder_row()])
    monkeypatch.setattr(main, "supabase", client)

    def transfer_before_delete(query, db):
        if query.table_name == "note_folders" and query.operation == "delete":
            db.rows["note_folders"][0]["user_id"] = FOREIGN_OWNER

    # Relationship clearing runs first, so install the race immediately after it.
    def arm_transfer(query, db):
        if query.table_name == "notes" and query.operation == "update":
            db.before_mutation = transfer_before_delete

    client.before_mutation = arm_transfer

    with pytest.raises(HTTPException) as error:
        await main.delete_note_folder("folder-1", OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "FOLDER_DELETE_CONFLICT"
    assert client.rows["note_folders"] == [folder_row(user_id=FOREIGN_OWNER)]
    assert client.operations[-1][3] == [("id", "folder-1"), ("user_id", OWNER)]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("override", "expected_detail"),
    [
        ([], "FOLDER_DELETE_CONFLICT"),
        ({}, "FOLDER_DELETE_UNCONFIRMED"),
        ([folder_row(user_id=FOREIGN_OWNER)], "FOLDER_DELETE_UNCONFIRMED"),
        ([folder_row(), folder_row()], "FOLDER_DELETE_UNCONFIRMED"),
    ],
)
async def test_folder_delete_zero_malformed_wrong_owner_and_multi_results_fail_closed(
    monkeypatch, override, expected_detail
):
    client = OwnershipSupabase(folders=[folder_row()])
    client.mutation_overrides[("note_folders", "delete")] = override
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.delete_note_folder("folder-1", OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == expected_detail


@pytest.mark.asyncio
async def test_folder_relationship_wrong_owner_result_fails_before_folder_delete(monkeypatch):
    client = OwnershipSupabase(
        folders=[folder_row()],
        notes=[note_row(folder_id="folder-1")],
    )
    client.mutation_overrides[("notes", "update")] = [
        note_row(user_id=FOREIGN_OWNER, folder_id=None)
    ]
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.delete_note_folder("folder-1", OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == "FOLDER_RELATIONSHIP_CLEAR_UNCONFIRMED"
    assert client.rows["note_folders"] == [folder_row()]
    assert not any(operation[1] == "delete" for operation in client.operations)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("override", "expected_detail"),
    [
        ([], "FOLDER_WRITE_CONFLICT"),
        ({}, "FOLDER_WRITE_UNCONFIRMED"),
        ([folder_row(user_id=FOREIGN_OWNER)], "FOLDER_WRITE_UNCONFIRMED"),
        ([folder_row(), folder_row()], "FOLDER_WRITE_UNCONFIRMED"),
    ],
)
async def test_folder_zero_malformed_wrong_owner_and_multi_results_fail_closed(
    monkeypatch, override, expected_detail
):
    client = OwnershipSupabase()
    client.mutation_overrides[("note_folders", "insert")] = override
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.upsert_note_folder(main.NoteFolderCreate(**folder_payload()), OWNER)

    assert error.value.status_code == 409
    assert error.value.detail == expected_detail


@pytest.mark.asyncio
async def test_batch_new_and_same_owner_rows_use_single_note_authority(monkeypatch):
    existing = note_row("existing", title="Old")
    client = OwnershipSupabase(notes=[existing])
    monkeypatch.setattr(main, "supabase", client)
    batch = main.NoteBatchCreate(
        notes=[
            main.NoteCreate(**note_payload("new")),
            main.NoteCreate(**note_payload("existing", title="Updated")),
        ]
    )

    result = await main.upsert_notes_batch(batch, OWNER, chunk_size=1)

    assert [row["id"] for row in result] == ["new", "existing"]
    assert all(row["user_id"] == OWNER for row in result)
    update = next(operation for operation in client.operations if operation[1] == "update")
    assert update[3] == [("id", "existing"), ("user_id", OWNER)]
    assert "user_id" not in update[2]


@pytest.mark.asyncio
async def test_batch_foreign_collision_does_not_mutate_or_disclose(monkeypatch):
    foreign = note_row(user_id=FOREIGN_OWNER, title="Private title", body="Private body")
    client = OwnershipSupabase(notes=[foreign])
    monkeypatch.setattr(main, "supabase", client)
    batch = main.NoteBatchCreate(notes=[main.NoteCreate(**note_payload())])

    with pytest.raises(HTTPException) as error:
        await main.upsert_notes_batch(batch, OWNER, chunk_size=main.DEFAULT_BATCH_CHUNK_SIZE)

    assert error.value.status_code == 409
    assert error.value.detail == "NOTE_ID_UNAVAILABLE"
    assert "Private" not in str(error.value.detail)
    assert client.rows["notes"] == [foreign]


@pytest.mark.asyncio
async def test_batch_client_owner_spoof_is_ignored(monkeypatch):
    client = OwnershipSupabase()
    monkeypatch.setattr(main, "supabase", client)
    spoofed = main.NoteCreate(**note_payload(), user_id=FOREIGN_OWNER)

    result = await main.upsert_notes_batch(
        main.NoteBatchCreate(notes=[spoofed]), OWNER, chunk_size=main.DEFAULT_BATCH_CHUNK_SIZE
    )

    assert result == [note_row()]
    assert client.rows["notes"] == [note_row()]


@pytest.mark.asyncio
async def test_batch_partial_failure_never_returns_full_success(monkeypatch):
    foreign = note_row("foreign", user_id=FOREIGN_OWNER, title="Private")
    client = OwnershipSupabase(notes=[foreign])
    monkeypatch.setattr(main, "supabase", client)
    batch = main.NoteBatchCreate(
        notes=[
            main.NoteCreate(**note_payload("created")),
            main.NoteCreate(**note_payload("foreign")),
        ]
    )

    with pytest.raises(HTTPException) as error:
        await main.upsert_notes_batch(batch, OWNER, chunk_size=1)

    assert error.value.detail == "NOTE_ID_UNAVAILABLE"
    assert any(row["id"] == "created" and row["user_id"] == OWNER for row in client.rows["notes"])
    assert next(row for row in client.rows["notes"] if row["id"] == "foreign") == foreign


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "override",
    [
        [],
        {},
        [note_row(user_id=FOREIGN_OWNER)],
        [note_row(), note_row()],
    ],
)
async def test_batch_zero_malformed_wrong_owner_and_multi_results_fail_closed(
    monkeypatch, override
):
    client = OwnershipSupabase()
    client.mutation_overrides[("notes", "insert")] = override
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.upsert_notes_batch(
            main.NoteBatchCreate(notes=[main.NoteCreate(**note_payload())]),
            OWNER,
            chunk_size=main.DEFAULT_BATCH_CHUNK_SIZE,
        )

    assert error.value.status_code == 409
    assert error.value.detail == "NOTE_WRITE_UNCONFIRMED"


@pytest.mark.asyncio
async def test_batch_stale_preflight_cannot_update_new_owner(monkeypatch):
    client = OwnershipSupabase(notes=[note_row(title="Original")])
    monkeypatch.setattr(main, "supabase", client)

    def transfer_before_update(query, db):
        if query.table_name == "notes" and query.operation == "update":
            db.rows["notes"][0]["user_id"] = FOREIGN_OWNER

    client.before_mutation = transfer_before_update
    batch = main.NoteBatchCreate(
        notes=[main.NoteCreate(**note_payload(title="Attacker change"))]
    )

    with pytest.raises(HTTPException) as error:
        await main.upsert_notes_batch(batch, OWNER, chunk_size=main.DEFAULT_BATCH_CHUNK_SIZE)

    assert error.value.status_code == 409
    assert error.value.detail == "NOTE_WRITE_CONFLICT"
    assert client.rows["notes"][0]["title"] == "Original"
    assert client.operations[-1][3] == [("id", "note-1"), ("user_id", OWNER)]
