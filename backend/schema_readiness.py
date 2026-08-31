"""Fail-closed checks for schema required by the active backend release."""

from __future__ import annotations

from typing import Any


class SchemaReadinessError(RuntimeError):
    """Raised when the database cannot satisfy the active release contract."""


def verify_recipe_deleted_at_schema(client: Any) -> None:
    """Verify that the Recipes tombstone column is queryable before startup.

    The migration is intentionally applied outside the application process.  A
    bounded, read-only PostgREST query is therefore used as the activation
    gate: a missing table/column, unavailable credentials, or an invalid row
    shape all stop the backend before it can serve schema-dependent routes.
    """

    try:
        response = (
            client.table("recipes")
            .select("deleted_at")
            .limit(1)
            .execute()
        )
    except Exception as error:  # pragma: no cover - concrete client errors vary
        raise SchemaReadinessError("public.recipes.deleted_at schema is not ready") from error

    rows = getattr(response, "data", None)
    if not isinstance(rows, list):
        raise SchemaReadinessError("public.recipes.deleted_at schema response is invalid")

    for row in rows:
        if not isinstance(row, dict):
            raise SchemaReadinessError("public.recipes.deleted_at schema response is invalid")
        value = row.get("deleted_at")
        if value is not None and not isinstance(value, str):
            raise SchemaReadinessError("public.recipes.deleted_at is not timestamp-compatible")
