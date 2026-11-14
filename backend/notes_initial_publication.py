"""Single owner pilot: user-JWT INSERT only, never an upsert or historical proof.

Activation requires operator proof of no unfenced authoritative identity ledger.
This service neither inspects nor installs private Identity/Gateway objects.
"""
import httpx

from notes_laptop_publication import LaptopPublicationError, NotesLaptopPublicationService

POLICY = "OWNER_ACKNOWLEDGED_INITIAL_ADOPTION_V1"
AUTHORITY = "NO_UNFENCED_LEDGER_VERIFIED_V1"


class InitialPublicationService:
    def __init__(self, url, key, verifier, account, client_factory=httpx.Client):
        self.url = url.rstrip("/") + "/rest/v1/notes"
        self.key, self.verifier, self.account = key, verifier, account
        self.client_factory = client_factory

    def request(self, token, owner, payload, *, read_only=False):
        note_id, snapshot = payload.noteId, payload.snapshot
        NotesLaptopPublicationService.validate(note_id, POLICY, snapshot)
        ids = payload.knownDeletedIds
        if (len(ids) > 500 or len(set(ids)) != len(ids)
                or any(type(i) is not str or not i or i != i.strip() or len(i) > 512 for i in ids)):
            raise LaptopPublicationError("INVALID_INITIAL_PUBLICATION_REQUEST", 400)
        if payload.policy != POLICY or note_id in payload.knownDeletedIds:
            raise LaptopPublicationError("INITIAL_PUBLICATION_INELIGIBLE", 409)
        if owner != self.account:
            raise LaptopPublicationError("INITIAL_PUBLICATION_UNAVAILABLE", 403)
        expected = dict(id=note_id, user_id=owner, **snapshot, folder_id=None, deleted_at=None)

        def send(method):
            # Reauthenticate immediately before each independent HTTP request.
            if self.verifier.verify_token(token) != owner:
                raise ValueError("account changed")
            with self.client_factory(timeout=10.0) as client:
                headers = {"apikey": self.key, "Authorization": "Bearer " + token}
                if method == "POST":
                    headers["Prefer"] = "return=representation"
                    return client.post(self.url, headers=headers, json=expected)
                return client.get(self.url, headers=headers, params={
                    "id": "eq." + note_id, "user_id": "eq." + owner,
                    "select": "*", "limit": "2",
                })

        def matches(response):
            rows = response.json()
            if type(rows) is not list or len(rows) != 1 or type(rows[0]) is not dict:
                return False
            row = rows[0]
            return (set(row) <= set(expected) | {"properties", "relations", "created_at"}
                    and all(k in row and type(row[k]) is type(v) and row[k] == v for k, v in expected.items())
                    and row.get("properties") is None and row.get("relations") is None)

        if not read_only:
            try:
                response = send("POST")  # Exactly one request; no retry or schema fallback.
                if response.status_code == 409 and response.json().get("code") == "23505":
                    raise LaptopPublicationError("INITIAL_PUBLICATION_CONFLICT", 409)
                if response.status_code != 201 or not matches(response):
                    raise ValueError("unconfirmed insert")
            except LaptopPublicationError:
                raise
            except Exception:
                raise LaptopPublicationError("INITIAL_PUBLICATION_INDETERMINATE", 503) from None
        try:
            response = send("GET")  # A new client/request, after the INSERT response.
            if response.status_code != 200 or not matches(response):
                raise ValueError("unconfirmed readback")
            if self.verifier.verify_token(token) != owner:
                raise ValueError("stale authentication")
        except Exception:
            raise LaptopPublicationError("INITIAL_PUBLICATION_INDETERMINATE", 503) from None
        return dict(status="VERIFIED", noteId=note_id, policy=POLICY)
