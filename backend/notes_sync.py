"""K-97G — Incremental note sync helpers and batch upsert chunking."""
from __future__ import annotations

from typing import Any, Iterable, Sequence

DEFAULT_BATCH_CHUNK_SIZE = 50
BATCH_CHUNK_SIZES = (20, 50, 100)


def note_changed_since(row: dict[str, Any], updated_after: int) -> bool:
    """Include active edits and soft-deletes (deleted_at) when updated_at advances."""
    updated_at = int(row.get("updated_at") or 0)
    deleted_at = row.get("deleted_at")
    if updated_at > updated_after:
        return True
    if deleted_at is not None and int(deleted_at) > updated_after:
        return True
    return False


def filter_notes_incremental(rows: Sequence[dict[str, Any]], updated_after: int) -> list[dict[str, Any]]:
    filtered = [row for row in rows if note_changed_since(row, updated_after)]
    filtered.sort(
        key=lambda row: max(int(row.get("updated_at") or 0), int(row.get("deleted_at") or 0)),
        reverse=True,
    )
    return filtered


def build_notes_delta_or_filter(updated_after: int) -> str:
    """Supabase OR filter for Notes changed-since sync."""
    cursor = max(0, int(updated_after or 0))
    return f"updated_at.gt.{cursor},deleted_at.gt.{cursor}"


def build_incremental_notes_filter(updated_after: int | None) -> dict[str, Any]:
    """Supabase filter descriptor — None means legacy full sync."""
    cursor = max(0, int(updated_after or 0))
    return {
        "or": build_notes_delta_or_filter(cursor),
        "value": cursor,
        "order": "updated_at",
        "desc": True,
        "include_deleted": True,
    }


def chunk_note_payloads(notes: Sequence[dict[str, Any]], chunk_size: int = DEFAULT_BATCH_CHUNK_SIZE) -> list[list[dict[str, Any]]]:
    size = max(1, chunk_size)
    return [list(notes[i : i + size]) for i in range(0, len(notes), size)]


def estimate_batch_request_count(note_count: int, chunk_size: int) -> int:
    if note_count <= 0:
        return 0
    size = max(1, chunk_size)
    return (note_count + size - 1) // size


def estimate_single_request_count(note_count: int) -> int:
    return note_count
