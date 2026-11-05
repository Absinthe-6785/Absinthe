from __future__ import annotations

import base64
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

import main


def schedule_row(number: int, user_id: str = "account-a", date: str = "2026-09-01") -> dict:
    return {
        "id": f"{number:08x}-0000-4000-8000-000000000000",
        "user_id": user_id,
        "date": date,
        "text": f"Schedule {number}",
        "start_time": "09:00",
        "end_time": "10:00",
        "is_dday": False,
        "color": "purple",
        "category": "Work",
    }


class FakeScheduleQuery:
    def __init__(self, gateway: "FakeScheduleGateway") -> None:
        self.gateway = gateway
        self.filters: dict[str, str] = {}
        self.count_mode: str | None = None
        self.page_limit: int | None = None
        self.ordered_by: str | None = None

    def select(self, columns: str, count: str | None = None):
        self.count_mode = count
        return self

    def eq(self, column: str, value: str):
        self.filters[column] = value
        return self

    def gte(self, column: str, value: str):
        self.filters[f"{column}_gte"] = value
        return self

    def lte(self, column: str, value: str):
        self.filters[f"{column}_lte"] = value
        return self

    def gt(self, column: str, value: str):
        self.filters[f"{column}_gt"] = value
        return self

    def order(self, column: str, desc: bool = False):
        assert desc is False
        self.ordered_by = column
        return self

    def limit(self, value: int):
        self.page_limit = value
        return self

    def execute(self):
        if self.gateway.fail_reads:
            raise RuntimeError("synthetic read failure")
        matching = [row for row in self.gateway.rows
            if row["user_id"] == self.filters.get("user_id")
            and self.filters.get("date_gte", "") <= row["date"] <= self.filters.get("date_lte", "")
            and row["id"] > self.filters.get("id_gt", "")]
        if self.ordered_by:
            matching.sort(key=lambda row: row[self.ordered_by])
        exact_count = len(matching) if self.count_mode == "exact" and self.gateway.count_available else None
        result_limit = self.page_limit if self.page_limit is not None else len(matching)
        if self.gateway.server_row_cap is not None:
            result_limit = min(result_limit, self.gateway.server_row_cap)
        self.gateway.calls.append({
            "filters": dict(self.filters),
            "count": self.count_mode,
            "order": self.ordered_by,
            "limit": self.page_limit,
        })
        return SimpleNamespace(data=matching[:result_limit], count=exact_count)


class FakeScheduleGateway:
    def __init__(self, rows: list[dict] | None = None, server_row_cap: int | None = None) -> None:
        self.rows = list(rows or [])
        self.server_row_cap = server_row_cap
        self.count_available = True
        self.fail_reads = False
        self.calls: list[dict] = []

    def table(self, name: str):
        assert name == "schedules"
        return FakeScheduleQuery(self)


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch):
    gateway = FakeScheduleGateway()
    current_account = {"id": "account-a"}
    monkeypatch.setattr(main, "supabase", gateway)
    monkeypatch.setattr(main, "SCHEDULE_RANGE_CURSOR_SIGNING_KEY", "test-schedule-range-cursor-key-32-bytes-minimum")
    main.app.dependency_overrides[main.get_current_user] = lambda: current_account["id"]
    try:
        yield TestClient(main.app), gateway, current_account
    finally:
        main.app.dependency_overrides.clear()


def range_params(**overrides) -> dict:
    return {
        "start_date": "2026-09-01",
        "end_date": "2026-09-30",
        **overrides,
    }


def test_legacy_caller_keeps_plain_array_response(api) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(1)]

    response = client.get("/api/schedules/range", params=range_params())

    assert response.status_code == 200
    assert response.json() == gateway.rows
    assert gateway.calls[0]["count"] is None
    assert gateway.calls[0]["order"] is None
    assert gateway.calls[0]["filters"]["user_id"] == "account-a"


def test_opt_in_pagination_reaches_end_under_simulated_server_row_truncation(api) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(number) for number in range(1, 6)]
    gateway.server_row_cap = 2
    params = range_params(page_size=4)
    collected: list[str] = []

    first = client.get("/api/schedules/range", params=params)
    assert first.status_code == 200
    page = first.json()
    assert page["items"] == gateway.rows[:2]
    assert page["remaining_count"] == 5
    assert page["complete"] is False
    assert page["completion_evidence"] == "exact_count_exceeds_returned_items"
    assert page["snapshot_consistency"] == "per_request_not_cross_page_snapshot"
    assert page["order_by"] == "id_ascending"
    collected.extend(row["id"] for row in page["items"])

    while not page["complete"]:
        params["cursor"] = page["next_cursor"]
        response = client.get("/api/schedules/range", params=params)
        assert response.status_code == 200
        page = response.json()
        collected.extend(row["id"] for row in page["items"])

    assert page["remaining_count"] == len(page["items"])
    assert page["next_cursor"] is None
    assert collected == [row["id"] for row in gateway.rows]
    assert len(gateway.calls) == 3
    assert all(call["count"] == "exact" for call in gateway.calls)
    assert all(call["order"] == "id" and call["limit"] == 4 for call in gateway.calls)
    assert all(call["filters"]["user_id"] == "account-a" for call in gateway.calls)


def test_empty_range_is_explicitly_complete_only_with_exact_zero_count(api) -> None:
    client, gateway, _ = api

    response = client.get("/api/schedules/range", params=range_params(page_size=10))

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["remaining_count"] == 0
    assert response.json()["complete"] is True
    assert response.json()["completion_evidence"] == "exact_count_equals_returned_items"


def test_every_page_remains_account_filtered_and_cursor_is_account_bound(api) -> None:
    client, gateway, current_account = api
    gateway.rows = [schedule_row(1), schedule_row(2), schedule_row(3, "account-b")]
    gateway.server_row_cap = 1
    params = range_params(page_size=2)

    first = client.get("/api/schedules/range", params=params).json()
    assert [row["user_id"] for row in first["items"]] == ["account-a"]
    params["cursor"] = first["next_cursor"]
    second = client.get("/api/schedules/range", params=params).json()
    assert [row["user_id"] for row in second["items"]] == ["account-a"]
    assert all(call["filters"]["user_id"] == "account-a" for call in gateway.calls)

    current_account["id"] = "account-b"
    before = len(gateway.calls)
    replay = client.get("/api/schedules/range", params=params)
    assert replay.status_code == 400
    assert replay.json()["detail"] == "INVALID_SCHEDULE_RANGE_CURSOR"
    assert len(gateway.calls) == before


@pytest.mark.parametrize(("params", "status"), [
    ({"start_date": "2026-09-02", "end_date": "2026-09-01", "page_size": 10}, 400),
    ({"start_date": "2026-02-30", "end_date": "2026-03-01", "page_size": 10}, 400),
    ({"start_date": "2026-09-01", "end_date": "2026-09-30", "page_size": 101}, 422),
    ({"start_date": "2026-09-01", "end_date": "2026-09-30", "cursor": "abc"}, 400),
    ({"start_date": "2026-09-01", "end_date": "2026-09-30", "page_size": 10, "cursor": "%%%"}, 400),
])
def test_invalid_ranges_and_pagination_inputs_fail_before_database_read(api, params: dict, status: int) -> None:
    client, gateway, _ = api
    response = client.get("/api/schedules/range", params=params)
    assert response.status_code == status
    assert gateway.calls == []


def test_cursor_is_bound_to_range_and_page_size(api) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(1), schedule_row(2)]
    first = client.get("/api/schedules/range", params=range_params(page_size=1)).json()
    cursor = first["next_cursor"]
    assert cursor

    changed_range = client.get("/api/schedules/range", params=range_params(page_size=1, end_date="2026-09-29", cursor=cursor))
    changed_size = client.get("/api/schedules/range", params=range_params(page_size=2, cursor=cursor))
    assert changed_range.status_code == 400
    assert changed_size.status_code == 400
    assert len(gateway.calls) == 1


def test_cursor_payload_tampering_is_rejected_before_database_read(api) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(1), schedule_row(2)]
    first = client.get("/api/schedules/range", params=range_params(page_size=1)).json()
    encoded_payload, encoded_signature = first["next_cursor"].split(".", maxsplit=1)
    raw = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
    payload = json.loads(raw.decode("utf-8"))
    payload["after_id"] = schedule_row(99)["id"]
    forged_payload = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"),
    ).decode("ascii").rstrip("=")

    response = client.get("/api/schedules/range", params=range_params(
        page_size=1, cursor=f"{forged_payload}.{encoded_signature}",
    ))

    assert response.status_code == 400
    assert response.json()["detail"] == "INVALID_SCHEDULE_RANGE_CURSOR"
    assert len(gateway.calls) == 1


@pytest.mark.parametrize("signing_key", ["", "too-short"])
def test_paginated_range_fails_closed_without_a_server_signing_key(
    api, monkeypatch: pytest.MonkeyPatch, signing_key: str,
) -> None:
    client, gateway, _ = api
    monkeypatch.setattr(main, "SCHEDULE_RANGE_CURSOR_SIGNING_KEY", signing_key)

    response = client.get("/api/schedules/range", params=range_params(page_size=10))

    assert response.status_code == 503
    assert response.json()["detail"] == "SCHEDULE_RANGE_PAGINATION_UNAVAILABLE"
    assert gateway.calls == []


@pytest.mark.parametrize("failure", ["exception", "missing-count", "no-progress"])
def test_unverified_or_nonprogressing_reads_fail_instead_of_claiming_empty(api, failure: str) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(1)]
    if failure == "exception":
        gateway.fail_reads = True
    elif failure == "missing-count":
        gateway.count_available = False
    else:
        gateway.server_row_cap = 0

    response = client.get("/api/schedules/range", params=range_params(page_size=10))

    assert response.status_code == 503
    assert response.json()["detail"] == "SCHEDULE_RANGE_READ_UNVERIFIED"


def test_wrong_account_or_malformed_rows_never_become_authoritative(api) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(1, "account-b")]

    response = client.get("/api/schedules/range", params=range_params(page_size=10))

    assert response.status_code == 503
    assert response.json()["detail"] == "SCHEDULE_RANGE_READ_UNVERIFIED"


def test_pages_explicitly_do_not_claim_one_snapshot_across_concurrent_mutations(api) -> None:
    client, gateway, _ = api
    gateway.rows = [schedule_row(2), schedule_row(3)]
    first = client.get("/api/schedules/range", params=range_params(page_size=1)).json()
    assert first["items"][0]["id"] == schedule_row(2)["id"]
    assert first["complete"] is False

    # A row inserted behind the keyset cursor after page one is not part of an atomic traversal.
    gateway.rows.insert(0, schedule_row(1))
    last = client.get("/api/schedules/range", params=range_params(page_size=1, cursor=first["next_cursor"]))

    assert last.status_code == 200
    assert last.json()["complete"] is True
    assert last.json()["items"][0]["id"] == schedule_row(3)["id"]
    assert last.json()["snapshot_consistency"] == "per_request_not_cross_page_snapshot"
