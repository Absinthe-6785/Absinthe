"""Default-off application service. Never issues or changes an operator approval."""
from uuid import uuid4

from identity_candidates.notes_private_gateway import (
    GatewayDenied, GatewayIndeterminate, cloud_snapshot_supported,
)


class LaptopPublicationError(RuntimeError):
    def __init__(self, code, status_code):
        super().__init__(code)
        self.code, self.status_code = code, status_code


class NotesLaptopPublicationService:
    def __init__(self, gateway):
        self.gateway = gateway

    @staticmethod
    def validate(note_id, approval_operation_id, snapshot):
        if (type(note_id) is not str or note_id != note_id.strip() or not 1 <= len(note_id) <= 512
                or type(approval_operation_id) is not str
                or approval_operation_id != approval_operation_id.strip()
                or not 1 <= len(approval_operation_id) <= 512
                or not cloud_snapshot_supported(snapshot) or "[[" in snapshot["body"]
                or len(snapshot["title"].encode("utf-8")) > 8192
                or len(snapshot["body"].encode("utf-8")) > 1048576):
            raise LaptopPublicationError("INVALID_LAPTOP_PUBLICATION_REQUEST", 400)

    def readback(self, token, owner, note_id, approval_operation_id, snapshot):
        self.validate(note_id, approval_operation_id, snapshot)
        try:
            return self._read(token, owner, note_id, approval_operation_id, snapshot)
        except GatewayIndeterminate:
            raise LaptopPublicationError("LAPTOP_PUBLICATION_INDETERMINATE", 503) from None
        except GatewayDenied:
            raise LaptopPublicationError("LAPTOP_PUBLICATION_APPROVAL_REQUIRED", 409) from None
        except Exception:
            raise LaptopPublicationError("LAPTOP_PUBLICATION_UNAVAILABLE", 503) from None

    def _read(self, token, owner, note_id, approval_operation_id, snapshot):
        # A separate call/connection commits independently of publication.
        result = self.gateway.run_laptop(
            token, "read", "laptop-read:" + uuid4().hex, note_id=note_id,
            approval_operation_id=approval_operation_id, payload=snapshot,
        )
        if (type(result) is not dict or result.get("account_id") != owner
                or result.get("note_id") != note_id
                or result.get("operation_id") != approval_operation_id
                or result.get("payload") != snapshot
                or result.get("policy") != "OWNER_APPROVED_HISTORICAL_ADOPTION"):
            raise GatewayIndeterminate("UNCONFIRMED_LAPTOP_READBACK")
        return {"status": "VERIFIED", "noteId": note_id, "approvalOperationId": approval_operation_id}

    def publish(self, token, owner, note_id, approval_operation_id, snapshot):
        self.validate(note_id, approval_operation_id, snapshot)
        try:
            # No approval call, INSERT fallback or automatic mutation retry.
            self.gateway.run_laptop(
                token, "publish", "laptop-publish:" + uuid4().hex, note_id=note_id,
                approval_operation_id=approval_operation_id, payload=snapshot,
            )
        except GatewayIndeterminate:
            raise LaptopPublicationError("LAPTOP_PUBLICATION_INDETERMINATE", 503) from None
        except GatewayDenied:
            raise LaptopPublicationError("LAPTOP_PUBLICATION_APPROVAL_REQUIRED", 409) from None
        except Exception:
            # Dispatch may already have committed; do not infer rollback.
            raise LaptopPublicationError("LAPTOP_PUBLICATION_INDETERMINATE", 503) from None
        try:
            return self._read(token, owner, note_id, approval_operation_id, snapshot)
        except Exception:
            raise LaptopPublicationError("LAPTOP_PUBLICATION_INDETERMINATE", 503) from None
