import math
from pathlib import Path
import subprocess
import sys

import pytest
from pydantic import ValidationError

import restore_validation as rv


EXPECTED_TABLES = (
    "notes",
    "note_folders",
    "schedules",
    "weekly_schedules",
    "todos",
    "routines",
    "routine_logs",
    "exercise_blocks",
    "workout_logs",
    "inbody_logs",
    "ddays",
    "recipes",
    "routine_exceptions",
)

EXPECTED_ALLOWED_FIELDS = {
    "notes": {"id", "user_id", "title", "body", "updated_at", "folder_id", "deleted_at", "starred", "properties", "relations"},
    "note_folders": {"id", "user_id", "name", "created_at"},
    "schedules": {"id", "user_id", "date", "text", "start_time", "end_time", "is_dday", "color", "category", "end_next_day", "created_at"},
    "weekly_schedules": {"id", "user_id", "day", "title", "start_time", "end_time", "color"},
    "todos": {"id", "user_id", "date", "text", "done", "created_at"},
    "routines": {"id", "user_id", "text", "created_date", "created_timestamp", "created_at", "deleted_at", "is_active"},
    "routine_logs": {"id", "user_id", "routine_id", "date", "done", "is_completed"},
    "exercise_blocks": {"id", "user_id", "name", "type", "tags", "cardio_mode"},
    "workout_logs": {"id", "user_id", "date", "block_id", "sets", "sort_order"},
    "inbody_logs": {"id", "user_id", "date", "weight", "smm", "pbf"},
    "ddays": {"id", "user_id", "date", "text", "start_time", "end_time", "is_dday", "color", "category", "end_next_day", "created_at"},
    "recipes": {"id", "user_id", "title", "category", "ingredients", "steps", "memo", "starred", "created_at"},
    "routine_exceptions": {"id", "user_id", "start_date", "end_date", "reason"},
}

VALID_MINIMAL_ROWS = {
    "notes": {"title": "Note", "body": "", "updated_at": 0},
    "note_folders": {"name": "Folder", "created_at": 0},
    "schedules": {"date": "2026-08-28", "text": "Study", "start_time": "09:00", "end_time": "10:00"},
    "weekly_schedules": {"day": 0, "title": "Weekly study", "start_time": "09:00", "end_time": "10:00", "color": "blue"},
    "todos": {"date": "2026-08-28", "text": "Task"},
    "routines": {"text": "Routine"},
    "routine_logs": {"date": "2026-08-28", "done": False},
    "exercise_blocks": {"name": "Block", "type": "strength"},
    "workout_logs": {"date": "2026-08-28", "block_id": None, "sets": [], "sort_order": 0},
    "inbody_logs": {"date": "2026-08-28", "weight": 0, "smm": 0, "pbf": 0},
    "ddays": {"date": "2026-08-28", "text": "D-day"},
    "recipes": {"title": "Recipe"},
    "routine_exceptions": {"start_date": "2026-08-28", "end_date": "2026-08-29"},
}

REQUIRED_FIELDS = {
    "notes": ("title", "body", "updated_at"),
    "note_folders": ("name", "created_at"),
    "schedules": ("date", "text", "start_time", "end_time"),
    "weekly_schedules": ("day", "title", "start_time", "end_time", "color"),
    "todos": ("date", "text"),
    "routines": ("text",),
    "routine_logs": ("date", "done"),
    "exercise_blocks": ("name", "type"),
    "workout_logs": ("date", "block_id", "sets", "sort_order"),
    "inbody_logs": ("date", "weight", "smm", "pbf"),
    "ddays": ("date", "text"),
    "recipes": ("title",),
    "routine_exceptions": ("start_date", "end_date"),
}


def test_restore_table_contract_is_unchanged():
    assert rv.RESTORE_TABLE_FIELDS == EXPECTED_TABLES
    assert set(rv.RESTORE_ROW_CONTRACTS) == set(EXPECTED_TABLES)
    for table in EXPECTED_TABLES:
        assert rv.RESTORE_ROW_CONTRACTS[table][0] == frozenset(EXPECTED_ALLOWED_FIELDS[table])
        assert rv.RESTORE_ROW_CONTRACTS[table][1] == frozenset(REQUIRED_FIELDS[table])


@pytest.mark.parametrize("table", EXPECTED_TABLES)
def test_all_restore_tables_accept_valid_minimal_rows(table):
    rv._validate_restore_row(table, dict(VALID_MINIMAL_ROWS[table]))


def test_full_notes_and_workout_rows_accept():
    rv._validate_restore_row(
        "notes",
        {
            "id": "note-1",
            "user_id": "user-1",
            "title": "Note",
            "body": "Body",
            "updated_at": 1,
            "folder_id": "folder-1",
            "deleted_at": None,
            "starred": True,
            "properties": {"topic": "health"},
            "relations": {"related": ["note-2"]},
        },
    )
    rv._validate_restore_row(
        "workout_logs",
        {
            "id": "workout-1",
            "user_id": "user-1",
            "date": "2026-08-28",
            "block_id": "block-1",
            "sets": [{
                "set": 1,
                "done": True,
                "type": "strength",
                "kg": 80,
                "reps": 5,
                "weight_source_value": 80,
                "weight_source_unit": "kg",
            }],
            "sort_order": 0,
        },
    )


def test_weekly_schedule_restore_contract_accepts_safe_fields_and_server_owner():
    rv._validate_restore_row(
        "weekly_schedules",
        {
            "id": "weekly-1",
            "user_id": "user-1",
            "day": 0,
            "title": "Weekly study",
            "start_time": "09:00",
            "end_time": "10:00",
            "color": "blue",
        },
    )


def test_weekly_schedule_restore_contract_rejects_unsafe_or_malformed_fields():
    valid = dict(VALID_MINIMAL_ROWS["weekly_schedules"])
    with pytest.raises(ValueError, match="unknown_restore_field:weekly_schedules:created_at"):
        rv._validate_restore_row("weekly_schedules", {**valid, "created_at": 1})
    with pytest.raises(ValueError, match="invalid_restore_field:weekly_schedules:day"):
        rv._validate_restore_row("weekly_schedules", {**valid, "day": 7})
    with pytest.raises(ValueError, match="invalid_restore_field:weekly_schedules:start_time"):
        rv._validate_restore_row("weekly_schedules", {**valid, "start_time": 900})


@pytest.mark.parametrize(
    ("table", "missing_field"),
    [(table, field) for table, fields in REQUIRED_FIELDS.items() for field in fields],
)
def test_restore_rows_reject_missing_required_fields(table, missing_field):
    row = dict(VALID_MINIMAL_ROWS[table])
    row.pop(missing_field)
    with pytest.raises(ValueError, match=f"missing_restore_field:{table}:{missing_field}"):
        rv._validate_restore_row(table, row)


def test_restore_rows_reject_forbidden_extra_fields_and_invalid_ids():
    extra = dict(VALID_MINIMAL_ROWS["notes"], unexpected=True)
    with pytest.raises(ValueError, match="unknown_restore_field:notes:unexpected"):
        rv._validate_restore_row("notes", extra)

    invalid_id = dict(VALID_MINIMAL_ROWS["notes"], id=" ")
    with pytest.raises(ValueError, match="invalid_restore_id:notes"):
        rv._validate_restore_row("notes", invalid_id)

    invalid_owner = dict(VALID_MINIMAL_ROWS["notes"], user_id="")
    with pytest.raises(ValueError, match="invalid_restore_owner:notes"):
        rv._validate_restore_row("notes", invalid_owner)


def test_restore_rows_reject_non_finite_and_invalid_numeric_values():
    for value in (math.nan, math.inf, -math.inf):
        row = dict(VALID_MINIMAL_ROWS["notes"], updated_at=value)
        with pytest.raises(ValueError, match="invalid_restore_field:notes:updated_at"):
            rv._validate_restore_row("notes", row)

    inbody = dict(VALID_MINIMAL_ROWS["inbody_logs"], weight="not-a-number")
    with pytest.raises(ValueError, match="invalid_restore_field:inbody_logs:weight"):
        rv._validate_restore_row("inbody_logs", inbody)


def test_restore_rows_reject_invalid_date_time_text_and_malformed_shapes():
    schedule = dict(VALID_MINIMAL_ROWS["schedules"], start_time="")
    with pytest.raises(ValueError, match="invalid_restore_field:schedules:start_time"):
        rv._validate_restore_row("schedules", schedule)

    block = dict(VALID_MINIMAL_ROWS["exercise_blocks"], tags=["ok", 1])
    with pytest.raises(ValueError, match="invalid_restore_field:exercise_blocks:tags"):
        rv._validate_restore_row("exercise_blocks", block)

    note = dict(VALID_MINIMAL_ROWS["notes"], relations={"related": [1]})
    with pytest.raises(ValueError, match="invalid_restore_field:notes:relations"):
        rv._validate_restore_row("notes", note)

    workout = dict(VALID_MINIMAL_ROWS["workout_logs"], sets=[{"set": 1, "done": True, "type": "unknown"}])
    with pytest.raises(ValueError, match="invalid_restore_field:workout_logs:sets"):
        rv._validate_restore_row("workout_logs", workout)


def test_restore_payload_preserves_strict_extra_duplicate_and_validation_errors():
    with pytest.raises(ValidationError):
        rv.RestorePayload.model_validate({"notes": "not-a-list"})
    with pytest.raises(ValidationError):
        rv.RestorePayload.model_validate({"unexpected": []})

    duplicate = {"id": "duplicate", **VALID_MINIMAL_ROWS["notes"]}
    with pytest.raises(ValidationError, match="duplicate_restore_id:notes"):
        rv.RestorePayload.model_validate({"notes": [duplicate, dict(duplicate)]})


def test_restore_payload_preserves_row_cap_boundaries():
    assert rv.MAX_RESTORE_ROWS == 10_000
    row = VALID_MINIMAL_ROWS["notes"]
    for count in (rv.MAX_RESTORE_ROWS - 1, rv.MAX_RESTORE_ROWS):
        rv.RestorePayload.model_validate({"notes": [dict(row) for _ in range(count)]})
    with pytest.raises(ValidationError, match="restore_row_limit_exceeded"):
        rv.RestorePayload.model_validate({"notes": [dict(row) for _ in range(rv.MAX_RESTORE_ROWS + 1)]})


def test_restore_validation_module_import_is_side_effect_free():
    script = (
        "import sys; import restore_validation; "
        "assert 'fastapi' not in sys.modules; "
        "assert 'supabase' not in sys.modules; "
        "assert 'dotenv' not in sys.modules; "
        "assert not hasattr(restore_validation, 'app')"
    )
    subprocess.run(
        [sys.executable, "-c", script],
        cwd=Path(__file__).parent,
        check=True,
        capture_output=True,
        text=True,
    )
