# Default-OFF laptop initial publication pilot

No SQL installation, role/schema/ledger changes, production writes, deployment,
or activation are performed by this package.

## Activation admission (separate owner approval)

- Verify the deployed notes PK is immediate and globally unique by ID, and user
  JWT RLS restricts SELECT/INSERT to the same account. Backend API key alone is
  not user authority: each REST request carries the current user's Bearer JWT.
- Verify no unfenced authoritative identity ledger exists, or verify the
  existing effective write fence rejects protected/retired IDs. Unknown catalog
  state stays OFF. Before changing ledger/fence installation while enabled,
  disable this pilot first. An env string is an operator attestation, not a
  runtime catalog inspection or permission to bypass a fence.
- Configure NOTES_INITIAL_PUBLISH_ENABLED=enabled, one exact allowed account in
  NOTES_INITIAL_PUBLISH_ACCOUNT_ID, and
  NOTES_INITIAL_PUBLISH_AUTHORITY=NO_UNFENCED_LEDGER_VERIFIED_V1 only after the
  preceding evidence and controlled change window. All are unset by default.
- Browser VITE_NOTES_INITIAL_PUBLISH_ENABLED=true is independent and default OFF.
  Existing HMAC and Cloud Copy flags do not enable this path.

## User flow and limits

Settings -> manual complete Notes comparison -> local-only Note -> acknowledge
the historical-ID exception -> durable/attachment preflight -> explicit exact-ID
confirmation. No operator operation ID is required. The endpoint accepts exactly
one four-field text snapshot, exact ID, policy acknowledgment and bounded known
deleted IDs. Local tombstones and durable deletion markers are excluded; malformed
marker reads fail closed. Dependencies are never stripped.

The server performs one ordinary INSERT (no upsert/update/schema fallback).
An existing ID, including a retained tombstone or another account's ID, conflicts
under the global PK. It then makes a separate authenticated GET and compares all
supported fields/owner/ID. Only exact readback produces VERIFIED. Concurrent
changes can make readback indeterminate; it is not an immutable receipt.

Unknown historical absence is admitted solely under the approved initial-adoption
exception. Neither a client deletion list nor PK proves permanent deletion
history. Existing installed fences remain authoritative; never disable them.

Ambiguous write responses never trigger automatic retry. The panel blocks repeat
writes for its lifetime and exposes only manual readback. A reload loses this
ephemeral block; a duplicate active row still conflicts in PostgreSQL. If a row
has subsequently been physically deleted, no durable receipt or exactly-once
claim is available: re-publication needs a fresh owner decision, not an automatic
retry. Disable the flag on uncertainty; do not compensate by deleting Notes.

Local source, original ID, editor/navigation, attachments and history are unchanged.
This is supported-text publication, not a full backup or automatic synchronization.
After verified publication use a new comparison / the existing authenticated
read-only route on another device. Physical-device QA and deployed RLS/ledger
admission remain separate, unexecuted gates.
