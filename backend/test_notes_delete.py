from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import main


class Query:
    def __init__(self, data):
        self.data = data
        self.filters = []

    def select(self, _columns):
        return self

    def delete(self):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return SimpleNamespace(data=self.data)


class NotesSupabase:
    def __init__(self, selected, deleted):
        self.queries = [Query(selected), Query(deleted)]

    def table(self, name):
        assert name == "notes"
        return self.queries.pop(0)


@pytest.mark.asyncio
async def test_single_note_delete_filters_by_exact_owner_and_returns_safe_receipt(monkeypatch):
    client = NotesSupabase(
        {"user_id": "account-a"},
        [{"id": "note-1", "user_id": "account-a", "title": "not returned"}],
    )
    delete_query = client.queries[1]
    monkeypatch.setattr(main, "supabase", client)

    result = await main.delete_note("note-1", "account-a")

    assert result == {"deleted": True, "note_id": "note-1", "account_id": "account-a"}
    assert ("id", "note-1") in delete_query.filters
    assert ("user_id", "account-a") in delete_query.filters
    assert "title" not in result


@pytest.mark.asyncio
async def test_single_note_delete_rejects_cross_account_before_delete(monkeypatch):
    client = NotesSupabase({"user_id": "account-b"}, [{"id": "note-1", "user_id": "account-b"}])
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.delete_note("note-1", "account-a")

    assert error.value.status_code == 403
    assert len(client.queries) == 1


@pytest.mark.asyncio
async def test_single_note_delete_fails_closed_when_delete_receipt_is_empty(monkeypatch):
    client = NotesSupabase({"user_id": "account-a"}, [])
    monkeypatch.setattr(main, "supabase", client)

    with pytest.raises(HTTPException) as error:
        await main.delete_note("note-1", "account-a")

    assert error.value.status_code == 409
