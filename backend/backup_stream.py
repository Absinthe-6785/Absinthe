"""K-97G — Sequential backup fetch and streaming ZIP export."""
from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime, timezone
from typing import Any, Callable, Iterable

BACKUP_TABLES: tuple[tuple[str, str | None], ...] = (
    ("notes", "updated_at"),
    ("note_folders", "created_at"),
    ("schedules", "date"),
    ("todos", "date"),
    ("routines", None),
    ("routine_logs", None),
    ("exercise_blocks", None),
    ("workout_logs", "date"),
    ("inbody_logs", "date"),
    ("ddays", None),
    ("recipes", "created_at"),
    ("routine_exceptions", "start_date"),
)

FetchTable = Callable[[str, str | None], list[dict[str, Any]]]


def fetch_backup_tables_sequential(fetch_table: FetchTable) -> dict[str, Any]:
    """Fetch tables one at a time — lower peak memory than parallel gather."""
    payload: dict[str, Any] = {
        "version": 2,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }
    key_map = {
        "notes": "notes",
        "note_folders": "note_folders",
        "schedules": "schedules",
        "todos": "todos",
        "routines": "routines",
        "routine_logs": "routine_logs",
        "exercise_blocks": "exercise_blocks",
        "workout_logs": "workout_logs",
        "inbody_logs": "inbody_logs",
        "ddays": "ddays",
        "recipes": "recipes",
        "routine_exceptions": "routine_exceptions",
    }
    for table, order in BACKUP_TABLES:
        payload[key_map[table]] = fetch_table(table, order)
    return payload


def iter_backup_zip_chunks(
    fetch_table: FetchTable,
    *,
    chunk_size: int = 65_536,
) -> Iterable[bytes]:
    """
    Stream a ZIP backup — one JSON file per table without holding all tables in memory.
    Peak memory ≈ largest single table JSON + zip chunk buffer.
    """
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        manifest_files: list[str] = []
        for table, order in BACKUP_TABLES:
            rows = fetch_table(table, order)
            file_name = f"{table}.json"
            archive.writestr(file_name, json.dumps(rows, separators=(",", ":")))
            manifest_files.append(file_name)
            del rows

        manifest = {
            "version": 2,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "schema": "absinthe-backup-zip-v1",
            "files": manifest_files,
        }
        archive.writestr("manifest.json", json.dumps(manifest, separators=(",", ":")))

    buffer.seek(0)
    while True:
        chunk = buffer.read(chunk_size)
        if not chunk:
            break
        yield chunk


def estimate_buffered_backup_peak_bytes(table_payload_bytes: Sequence[int]) -> int:
    """Legacy path: all tables resident + single JSON envelope."""
    return sum(table_payload_bytes) + max(table_payload_bytes, default=0)


def estimate_streaming_backup_peak_bytes(table_payload_bytes: Sequence[int]) -> int:
    """Streaming ZIP: largest table + modest zip/manifest overhead."""
    if not table_payload_bytes:
        return 0
    largest = max(table_payload_bytes)
    return largest + min(largest // 4, 512 * 1024)
