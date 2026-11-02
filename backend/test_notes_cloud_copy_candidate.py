from __future__ import annotations

import copy
from uuid import uuid4

import pytest

from identity_candidates.notes_private_gateway import GatewayDenied, GatewayIndeterminate
from notes_cloud_copy_candidate import CloudCopyError, NotesCloudCopyService


OWNER = "11111111-1111-4111-8111-111111111111"
LOCAL_ID = "local-note-α"
TOKEN = "verified-token"
SNAPSHOT = {"title": "Original title", "body": "Body [[note:old-id|label]]", "updated_at": 17, "starred": False}


class FakeGateway:
    def __init__(self):
        self.calls = []
        self.records = {}
        self.fail_after_reserve = False
        self.fail_after_publish = False
        self.fail_before_publish = False

    def run_cloud_copy(self, token, action, operation_id, **kwargs):
        assert token == TOKEN
        self.calls.append((action, operation_id, copy.deepcopy(kwargs)))
        local = kwargs["local_note_id"]
        record = self.records.get(local)
        if action == "reserve":
            if record and record["reserve_operation_id"] != operation_id:
                raise GatewayDenied("CLOUD_ALIAS_ALREADY_BOUND")
            if not record:
                record = {"account_id": OWNER, "local_note_id": local, "cloud_note_id": str(uuid4()),
                          "state": "RESERVED", "reserve_operation_id": operation_id,
                          "publication": None, "retire_operation_id": None}
                self.records[local] = record
            if self.fail_after_reserve:
                self.fail_after_reserve = False
                raise GatewayIndeterminate("synthetic lost reserve response")
            return record["cloud_note_id"]
        if action == "read":
            if record is None:
                raise GatewayDenied("CLOUD_ALIAS_UNAVAILABLE")
            return copy.deepcopy(record)
        if action == "publish":
            if record is None or record["cloud_note_id"] != kwargs["cloud_id"]:
                raise GatewayDenied("CLOUD_ALIAS_UNAVAILABLE")
            if record["state"] == "RETIRED":
                raise GatewayDenied("IDENTITY_RETIRED")
            if self.fail_before_publish:
                self.fail_before_publish = False
                raise GatewayIndeterminate("synthetic lost outcome before commit")
            if record["state"] == "LIVE":
                if record["publication"]["payload"] != kwargs["payload"]:
                    raise GatewayDenied("IMMUTABLE_CLOUD_COPY")
                return "REPLAY_LIVE"
            record["state"] = "LIVE"
            record["publication"] = {"operation_id": operation_id, "payload": copy.deepcopy(kwargs["payload"]),
                                      "digest": "a" * 64}
            if self.fail_after_publish:
                self.fail_after_publish = False
                raise GatewayIndeterminate("synthetic lost response after commit")
            return "CREATED"
        raise AssertionError(f"unexpected gateway action: {action}")

    def retire(self, local_note_id):
        self.records[local_note_id]["state"] = "RETIRED"
        self.records[local_note_id]["publication"] = None
        self.records[local_note_id]["retire_operation_id"] = "retired"


def test_creates_distinct_server_identity_and_confirms_exact_snapshot_readback():
    gateway = FakeGateway()
    original = copy.deepcopy(SNAPSHOT)
    result = NotesCloudCopyService(gateway).create_copy(TOKEN, LOCAL_ID, SNAPSHOT)

    assert result["status"] == "created"
    assert result["localNoteId"] == LOCAL_ID
    assert result["cloudNoteId"] != LOCAL_ID
    assert [call[0] for call in gateway.calls] == ["reserve", "read", "publish", "read"]
    assert gateway.calls[2][2]["payload"] == SNAPSHOT
    assert gateway.records[LOCAL_ID]["publication"]["payload"] == SNAPSHOT
    assert SNAPSHOT == original


def test_explicit_repeat_is_read_only_and_never_overwrites_an_existing_copy():
    gateway = FakeGateway()
    service = NotesCloudCopyService(gateway)
    first = service.create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    calls_before = len(gateway.calls)

    repeated = service.create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert repeated == {"status": "already_copied", "localNoteId": LOCAL_ID,
                        "cloudNoteId": first["cloudNoteId"]}
    assert [call[0] for call in gateway.calls[calls_before:]] == ["reserve", "read"]

    changed = {**SNAPSHOT, "body": "newer local body"}
    with pytest.raises(CloudCopyError) as caught:
        service.create_copy(TOKEN, LOCAL_ID, changed)
    assert caught.value.code == "CLOUD_COPY_ALREADY_EXISTS"
    assert gateway.records[LOCAL_ID]["publication"]["payload"] == SNAPSHOT
    assert all(call[0] != "publish" for call in gateway.calls[calls_before:])


def test_retired_cloud_identity_is_never_resurrected():
    gateway = FakeGateway()
    service = NotesCloudCopyService(gateway)
    service.create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    gateway.retire(LOCAL_ID)
    calls_before = len(gateway.calls)

    with pytest.raises(CloudCopyError) as caught:
        service.create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert caught.value.code == "CLOUD_COPY_RETIRED"
    assert all(call[0] != "publish" for call in gateway.calls[calls_before:])


def test_ambiguous_reservation_is_reconciled_by_read_before_publication():
    gateway = FakeGateway()
    gateway.fail_after_reserve = True
    result = NotesCloudCopyService(gateway).create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert result["status"] == "created"
    assert [call[0] for call in gateway.calls] == ["reserve", "read", "publish", "read"]


def test_ambiguous_publication_is_read_back_without_automatic_redispatch():
    gateway = FakeGateway()
    gateway.fail_after_publish = True
    result = NotesCloudCopyService(gateway).create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert result["status"] == "created"
    assert [call[0] for call in gateway.calls] == ["reserve", "read", "publish", "read"]
    assert sum(action == "publish" for action, _, _ in gateway.calls) == 1


def test_unconfirmed_publication_is_not_retried_and_returns_indeterminate():
    gateway = FakeGateway()
    gateway.fail_before_publish = True
    with pytest.raises(CloudCopyError) as caught:
        NotesCloudCopyService(gateway).create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert caught.value.code == "CLOUD_COPY_RESULT_INDETERMINATE"
    assert [call[0] for call in gateway.calls] == ["reserve", "read", "publish", "read"]
    assert gateway.records[LOCAL_ID]["state"] == "RESERVED"
    assert sum(action == "publish" for action, _, _ in gateway.calls) == 1


def test_a_separate_user_confirmed_retry_can_resume_a_reserved_alias_with_fresh_authority():
    gateway = FakeGateway()
    gateway.fail_before_publish = True
    service = NotesCloudCopyService(gateway)
    with pytest.raises(CloudCopyError) as caught:
        service.create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert caught.value.code == "CLOUD_COPY_RESULT_INDETERMINATE"
    first_reservation = gateway.records[LOCAL_ID]["reserve_operation_id"]

    result = service.create_copy(TOKEN, LOCAL_ID, SNAPSHOT)
    assert result["status"] == "created"
    assert gateway.records[LOCAL_ID]["reserve_operation_id"] == first_reservation
    assert gateway.records[LOCAL_ID]["state"] == "LIVE"
    assert sum(action == "publish" for action, _, _ in gateway.calls) == 2


@pytest.mark.parametrize("payload", [
    {}, {**SNAPSHOT, "properties": {}}, {**SNAPSHOT, "relations": []},
    {**SNAPSHOT, "body": "![attachment](attachment://original)"},
    {**SNAPSHOT, "updated_at": True},
])
def test_unsupported_or_malformed_snapshots_are_rejected_before_gateway(payload):
    gateway = FakeGateway()
    before = copy.deepcopy(payload)
    with pytest.raises(CloudCopyError) as caught:
        NotesCloudCopyService(gateway).create_copy(TOKEN, LOCAL_ID, payload)
    assert caught.value.code == "INVALID_CLOUD_COPY_REQUEST"
    assert gateway.calls == [] and payload == before


def test_invalid_local_identity_is_rejected_before_gateway():
    gateway = FakeGateway()
    with pytest.raises(CloudCopyError):
        NotesCloudCopyService(gateway).create_copy(TOKEN, "   ", SNAPSHOT)
    assert gateway.calls == []
