"""Default-off, explicitly requested single-Note Cloud Copy orchestration.

This module does not activate the candidate schema or transport. It accepts a
single bounded snapshot, reserves a distinct server identity, publishes once,
and verifies the exact result through the existing private gateway. It never
updates an existing cloud Note or retries an ambiguous dispatch.
"""
from __future__ import annotations

from typing import Protocol
from uuid import UUID, uuid4

from identity_candidates.notes_private_gateway import (
    GatewayDenied,
    GatewayIndeterminate,
    cloud_snapshot_supported,
)


class CloudCopyError(RuntimeError):
    def __init__(self, code: str, *, status_code: int):
        super().__init__(code)
        self.code = code
        self.status_code = status_code


class CloudCopyGateway(Protocol):
    def run_cloud_copy(self, token: str, action: str, operation_id: str, **kwargs) -> str | dict: ...


def _operation_id(kind: str) -> str:
    # Each explicit user confirmation gets fresh authority. The durable alias
    # prevents a new reservation; readback recovers its original operation ID.
    return f"notes-cloud-copy-v1:{kind}:{uuid4().hex}"


def _valid_cloud_id(value: object) -> bool:
    try:
        return type(value) is str and str(UUID(value)) == value and UUID(value).int != 0
    except (ValueError, TypeError, AttributeError):
        return False


class NotesCloudCopyService:
    def __init__(self, gateway: CloudCopyGateway):
        self._gateway = gateway

    def create_copy(self, token: str, local_note_id: object, payload: object) -> dict:
        if (type(local_note_id) is not str or not local_note_id or local_note_id != local_note_id.strip()
                or len(local_note_id) > 512 or not cloud_snapshot_supported(payload)):
            raise CloudCopyError("INVALID_CLOUD_COPY_REQUEST", status_code=400)

        try:
            # A stable reservation intent prevents a second local ID from being
            # rebound. This does not adopt the local ID as a cloud identity.
            reserve_operation_id = _operation_id("reserve")
            try:
                cloud_note_id = self._gateway.run_cloud_copy(
                    token, "reserve", reserve_operation_id, local_note_id=local_note_id,
                )
                if not _valid_cloud_id(cloud_note_id) or cloud_note_id == local_note_id:
                    raise GatewayIndeterminate("UNCONFIRMED_CLOUD_ID")
                before = self._read(token, local_note_id)
            except (GatewayDenied, GatewayIndeterminate) as reserve_failure:
                # The reservation may have committed before its response was
                # lost, or an older reservation may be bound to this local ID.
                # Reconcile with a fresh read-only authority; never issue a
                # second reservation or publication merely because it failed.
                try:
                    before = self._read(token, local_note_id)
                except Exception:
                    if isinstance(reserve_failure, GatewayIndeterminate):
                        raise reserve_failure
                    raise
                cloud_note_id = before.get("cloud_note_id")
            if not _valid_cloud_id(cloud_note_id) or cloud_note_id == local_note_id:
                raise GatewayIndeterminate("UNCONFIRMED_CLOUD_ID")
            if before["cloud_note_id"] != cloud_note_id:
                raise GatewayIndeterminate("CLOUD_ID_MISMATCH")
            if type(before.get("reserve_operation_id")) is not str or not before["reserve_operation_id"]:
                raise GatewayIndeterminate("UNCONFIRMED_RESERVATION_READBACK")
            if before["state"] == "RETIRED":
                raise CloudCopyError("CLOUD_COPY_RETIRED", status_code=409)
            if before["state"] == "LIVE":
                if before["publication"]["payload"] == payload:
                    return {"status": "already_copied", "localNoteId": local_note_id,
                            "cloudNoteId": cloud_note_id}
                raise CloudCopyError("CLOUD_COPY_ALREADY_EXISTS", status_code=409)
            if before["state"] != "RESERVED" or before["publication"] is not None:
                raise GatewayIndeterminate("UNCONFIRMED_CLOUD_STATE")

            try:
                self._gateway.run_cloud_copy(
                    token, "publish", _operation_id("publish"),
                    local_note_id=local_note_id, cloud_id=cloud_note_id, payload=payload,
                )
            except (GatewayDenied, GatewayIndeterminate) as publish_failure:
                # Reconcile only by readback. This request never redispatches a
                # failed or ambiguous publication.
                try:
                    after = self._read(token, local_note_id)
                except Exception:
                    if isinstance(publish_failure, GatewayIndeterminate):
                        raise publish_failure
                    raise
                if (after["cloud_note_id"] == cloud_note_id and after["state"] == "LIVE"
                        and after["publication"] is not None and after["publication"]["payload"] == payload):
                    return {"status": "created", "localNoteId": local_note_id,
                            "cloudNoteId": cloud_note_id}
                if after["state"] == "LIVE":
                    raise CloudCopyError("CLOUD_COPY_ALREADY_EXISTS", status_code=409)
                if after["state"] == "RETIRED":
                    raise CloudCopyError("CLOUD_COPY_RETIRED", status_code=409)
                if isinstance(publish_failure, GatewayIndeterminate):
                    raise GatewayIndeterminate("CLOUD_COPY_PUBLISH_INDETERMINATE") from None
                raise CloudCopyError("CLOUD_COPY_NOT_COMPLETED", status_code=409) from None
            try:
                after = self._read(token, local_note_id)
            except Exception:
                raise GatewayIndeterminate("CLOUD_COPY_READBACK_UNAVAILABLE") from None
            if after["state"] == "RETIRED":
                raise CloudCopyError("CLOUD_COPY_RETIRED", status_code=409)
            if (after["cloud_note_id"] == cloud_note_id and after["state"] == "LIVE"
                    and after["publication"] is not None and after["publication"]["payload"] != payload):
                raise CloudCopyError("CLOUD_COPY_ALREADY_EXISTS", status_code=409)
            if (after["cloud_note_id"] != cloud_note_id or after["state"] != "LIVE"
                    or after["publication"] is None or after["publication"]["payload"] != payload):
                raise GatewayIndeterminate("CLOUD_COPY_READBACK_MISMATCH")
            return {"status": "created", "localNoteId": local_note_id, "cloudNoteId": cloud_note_id}
        except CloudCopyError:
            raise
        except GatewayIndeterminate:
            raise CloudCopyError("CLOUD_COPY_RESULT_INDETERMINATE", status_code=503) from None
        except GatewayDenied:
            # Do not expose SQL, account, identity, or transport details and do
            # not infer that a failed dispatch rolled back.
            raise CloudCopyError("CLOUD_COPY_UNAVAILABLE", status_code=503) from None
        except Exception:
            raise CloudCopyError("CLOUD_COPY_UNAVAILABLE", status_code=503) from None

    def _read(self, token: str, local_note_id: str) -> dict:
        result = self._gateway.run_cloud_copy(
            token, "read", f"notes-cloud-copy-read-v1:{uuid4().hex}", local_note_id=local_note_id,
        )
        if (type(result) is not dict or result.get("local_note_id") != local_note_id
                or not _valid_cloud_id(result.get("cloud_note_id"))
                or result.get("state") not in {"RESERVED", "LIVE", "RETIRED"}
                or "publication" not in result or "reserve_operation_id" not in result):
            raise GatewayIndeterminate("UNCONFIRMED_CLOUD_READBACK")
        return result
