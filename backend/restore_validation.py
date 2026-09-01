import math
from collections.abc import Callable
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


RESTORE_TABLE_FIELDS = (
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
MAX_RESTORE_ROWS = 10_000


def _non_empty_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _nullable_text(value: object) -> bool:
    return value is None or isinstance(value, str)


def _finite_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _finite_persisted(value: object, allow_empty: bool = False) -> bool:
    if _finite_number(value):
        return True
    if isinstance(value, str):
        if allow_empty and value == "":
            return True
        try:
            return math.isfinite(float(value.strip()))
        except (TypeError, ValueError):
            return False
    return False


def _nullable_finite_number(value: object) -> bool:
    return value is None or _finite_number(value)


def _boolean(value: object) -> bool:
    return isinstance(value, bool)


def _integer(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _weekly_day(value: object) -> bool:
    return _integer(value) and 0 <= value <= 6


def _string_array(value: object) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _string_record(value: object) -> bool:
    return value is None or (
        isinstance(value, dict)
        and all(isinstance(key, str) and isinstance(item, str) for key, item in value.items())
    )


def _relation_record(value: object) -> bool:
    return value is None or (
        isinstance(value, dict)
        and all(isinstance(key, str) and _string_array(item) for key, item in value.items())
    )


def _json_object_array(value: object) -> bool:
    return isinstance(value, list) and all(isinstance(item, dict) for item in value)


def _timestamp(value: object) -> bool:
    return _finite_number(value) or _non_empty_text(value)


def _nullable_timestamp(value: object) -> bool:
    return value is None or _timestamp(value)


def _canonical_uuid(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return str(UUID(value)) == value
    except ValueError:
        return False


def _workout_sets(value: object) -> bool:
    if not _json_object_array(value):
        return False
    for item in value:
        if not _integer(item.get("set")) or item["set"] < 1 or not _boolean(item.get("done")):
            return False
        if not _non_empty_text(item.get("type")):
            return False
        if item["type"] in {"strength", "bodyweight"}:
            if not _finite_persisted(item.get("kg"), allow_empty=True):
                return False
            if not _finite_persisted(item.get("reps"), allow_empty=True):
                return False
            has_source_value = "weight_source_value" in item
            has_source_unit = "weight_source_unit" in item
            if has_source_value != has_source_unit:
                return False
            if has_source_value and (
                not _finite_number(item.get("weight_source_value"))
                or item["weight_source_value"] < 0
                or item.get("weight_source_unit") not in {"kg", "lbs"}
            ):
                return False
        elif item["type"] == "cardio":
            if not isinstance(item.get("time"), str) or not isinstance(item.get("pace"), str):
                return False
            if not _finite_persisted(item.get("distance"), allow_empty=True):
                return False
        else:
            return False
    return True


RestoreFieldValidator = Callable[[object], bool]


# These contracts mirror the existing create/update models and the fields read
# by the current application.  Restore rows are database-shaped records, so
# server-controlled user_id and table-specific identity requirements are
# handled separately below.
RESTORE_ROW_CONTRACTS: dict[str, tuple[frozenset[str], frozenset[str], dict[str, RestoreFieldValidator]]] = {
    "notes": (
        frozenset({"id", "user_id", "title", "body", "updated_at", "folder_id", "deleted_at", "starred", "properties", "relations"}),
        frozenset({"title", "body", "updated_at"}),
        {"title": _non_empty_text, "body": lambda value: isinstance(value, str), "updated_at": _finite_number,
         "folder_id": _nullable_text, "deleted_at": _nullable_finite_number, "starred": _boolean,
         "properties": _string_record, "relations": _relation_record},
    ),
    "note_folders": (
        frozenset({"id", "user_id", "name", "created_at"}), frozenset({"name", "created_at"}),
        {"name": _non_empty_text, "created_at": _finite_number},
    ),
    "schedules": (
        frozenset({"id", "user_id", "date", "text", "start_time", "end_time", "is_dday", "color", "category", "end_next_day", "created_at"}),
        frozenset({"date", "text", "start_time", "end_time"}),
        {"date": _non_empty_text, "text": lambda value: isinstance(value, str), "start_time": _non_empty_text, "end_time": _non_empty_text,
         "is_dday": _boolean, "color": _non_empty_text, "category": _non_empty_text, "end_next_day": _boolean,
         "created_at": _timestamp},
    ),
    "weekly_schedules": (
        frozenset({"id", "user_id", "day", "title", "start_time", "end_time", "color"}),
        frozenset({"day", "title", "start_time", "end_time", "color"}),
        {"day": _weekly_day, "title": _non_empty_text, "start_time": _non_empty_text,
         "end_time": _non_empty_text, "color": _non_empty_text},
    ),
    "todos": (
        frozenset({"id", "user_id", "date", "text", "done", "created_at"}), frozenset({"date", "text"}),
        {"date": _non_empty_text, "text": lambda value: isinstance(value, str), "done": _boolean, "created_at": _timestamp},
    ),
    "routines": (
        frozenset({"id", "user_id", "text", "created_date", "created_timestamp", "created_at", "deleted_at", "is_active"}),
        frozenset({"text"}),
        {"text": _non_empty_text, "created_date": _nullable_text, "created_timestamp": _nullable_text,
         "created_at": _nullable_timestamp, "deleted_at": _nullable_timestamp, "is_active": _boolean},
    ),
    "routine_logs": (
        frozenset({"id", "user_id", "routine_id", "date", "done", "is_completed"}), frozenset({"date", "done"}),
        {"routine_id": _nullable_text, "date": _non_empty_text, "done": _boolean, "is_completed": _boolean},
    ),
    "exercise_blocks": (
        frozenset({"id", "user_id", "name", "type", "tags", "cardio_mode"}), frozenset({"name", "type"}),
        {"name": _non_empty_text, "type": _non_empty_text, "tags": _string_array, "cardio_mode": _nullable_text},
    ),
    "workout_logs": (
        frozenset({"id", "user_id", "date", "block_id", "sets", "sort_order"}),
        frozenset({"date", "block_id", "sets", "sort_order"}),
        {"date": _non_empty_text, "block_id": _nullable_text, "sets": _workout_sets, "sort_order": _integer},
    ),
    "inbody_logs": (
        frozenset({"id", "user_id", "date", "weight", "smm", "pbf"}), frozenset({"date", "weight", "smm", "pbf"}),
        {"date": _non_empty_text, "weight": _nullable_finite_number, "smm": _nullable_finite_number, "pbf": _nullable_finite_number},
    ),
    "ddays": (
        frozenset({"id", "user_id", "date", "text", "start_time", "end_time", "is_dday", "color", "category", "end_next_day", "created_at"}),
        frozenset({"date", "text"}),
        {"date": _non_empty_text, "text": lambda value: isinstance(value, str), "start_time": _non_empty_text, "end_time": _non_empty_text,
         "is_dday": _boolean, "color": _non_empty_text, "category": _non_empty_text, "end_next_day": _boolean,
         "created_at": _timestamp},
    ),
    "recipes": (
        frozenset({"id", "user_id", "title", "category", "ingredients", "steps", "memo", "starred", "created_at", "deleted_at"}),
        frozenset({"id", "title"}),
        {"title": _non_empty_text, "category": _non_empty_text, "ingredients": lambda value: isinstance(value, str),
         "steps": lambda value: isinstance(value, str), "memo": lambda value: isinstance(value, str),
         "starred": _boolean, "created_at": _timestamp, "deleted_at": lambda value: value is None},
    ),
    "routine_exceptions": (
        frozenset({"id", "user_id", "start_date", "end_date", "reason"}), frozenset({"start_date", "end_date"}),
        {"start_date": _non_empty_text, "end_date": _non_empty_text, "reason": lambda value: isinstance(value, str)},
    ),
}


def _validate_restore_row(table: str, row: object) -> None:
    if not isinstance(row, dict):
        raise ValueError(f"invalid_restore_row:{table}:object_required")
    allowed_fields, required_fields, validators = RESTORE_ROW_CONTRACTS[table]
    unknown_fields = sorted(set(row) - allowed_fields)
    if unknown_fields:
        raise ValueError(f"unknown_restore_field:{table}:{unknown_fields[0]}")
    missing_fields = sorted(field for field in required_fields if field not in row)
    if missing_fields:
        raise ValueError(f"missing_restore_field:{table}:{missing_fields[0]}")
    if "id" in row and (not isinstance(row["id"], str) or not row["id"].strip()):
        raise ValueError(f"invalid_restore_id:{table}")
    if table == "recipes" and not _canonical_uuid(row["id"]):
        raise ValueError("invalid_restore_id:recipes")
    if "user_id" in row and (not isinstance(row["user_id"], str) or not row["user_id"].strip()):
        raise ValueError(f"invalid_restore_owner:{table}")
    for field, validator in validators.items():
        if field in row and not validator(row[field]):
            raise ValueError(f"invalid_restore_field:{table}:{field}")


class RestorePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    notes: list[dict] = Field(default_factory=list)
    note_folders: list[dict] = Field(default_factory=list)
    schedules: list[dict] = Field(default_factory=list)
    weekly_schedules: list[dict] = Field(default_factory=list)
    todos: list[dict] = Field(default_factory=list)
    routines: list[dict] = Field(default_factory=list)
    routine_logs: list[dict] = Field(default_factory=list)
    exercise_blocks: list[dict] = Field(default_factory=list)
    workout_logs: list[dict] = Field(default_factory=list)
    inbody_logs: list[dict] = Field(default_factory=list)
    ddays: list[dict] = Field(default_factory=list)
    recipes: list[dict] = Field(default_factory=list)
    routine_exceptions: list[dict] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_complete_rows(self) -> "RestorePayload":
        total_rows = 0
        for table in RESTORE_TABLE_FIELDS:
            rows = getattr(self, table)
            seen_ids: set[str] = set()
            for row in rows:
                _validate_restore_row(table, row)
                row_id = row.get("id")
                if row_id is not None:
                    if row_id in seen_ids:
                        raise ValueError(f"duplicate_restore_id:{table}")
                    seen_ids.add(row_id)
                total_rows += 1
        if total_rows > MAX_RESTORE_ROWS:
            raise ValueError("restore_row_limit_exceeded")
        return self
