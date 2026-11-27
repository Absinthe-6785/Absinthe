# Canonical Health transport (isolated local QA)

This is the existing REL-05G4 Workout transport, limited to synthetic
first creates and conditional updates. There is no product adapter, Wrangler
deployment target, production database migration, or runtime flag change.
The canonical local-save QA namespace continues to deny remote authority
and reset intent. The transport tests use fresh fake IndexedDB factories
and their own synthetic owners, devices, remote project and D1 database.

- The Worker only serves the named synthetic mode at
  `http://127.0.0.1:8789`. The existing Core JWT verifier reads only an
  injected local public JWKS from the isolated test (ES256 with a fixed
  synthetic issuer); it does not contact Supabase or accept real credentials.
  Verification alone does not confer database authority.
- The existing shared generation route confirms only a fixture-seeded
  account/device/generation tuple. Workout discovery returns only an existing
  open, active, matching binding; there is no registration or provisioning
  endpoint. Push and pull recheck the binding and authority epoch inside
  their D1 batch, including before any replay receipt can be returned.
- `POST /api/sync/v2/workouts/mutations` admits only canonical
  `entity_snapshot` upserts. A null remote CAS base is create-only; a positive
  base requires an existing exact-ID entity at that revision. The owner,
  project, binding, epoch and lineage checks are part of the guarded append.
  The existing validator, payload hash and request digest are unchanged.
  A stale base returns the current revision, content hash and mutation reference
  without writing. A positive base for a missing entity never creates it.
- One D1 batch appends the full validated revision and reads back the receipt.
  A SQLite trigger advances the entity's current revision pointer and inserts
  the immutable receipt index within the append, so a failure rolls back all
  three effects. The entity stores only its latest revision/sequence pointer;
  the full record is stored once per revision in the event. Receipts point to
  their original event, not to the mutable head. A valid replay returns the
  original evidence after any number of updates. Mutation and idempotency keys
  are unique per authenticated owner and trusted project.
- `GET /api/sync/v2/workouts/changes` uses a per-account/project sequence
  and the existing incremental wire format. A short page (max 16 records)
  advances only to the last included sequence. There is no pruning, so
  retention floor is 0. An epoch mismatch can signal full resync required;
  the snapshot/reset operations themselves are unsupported. The indexed first
  event fences reads and writes if its authoritative epoch changes; old
  events are never restamped. Pull cannot acknowledge an outbox mutation.
  Multiple revisions of the same entity are delivered in sequence, including
  within one page. Delete/tombstone, restore and reset are unsupported.

Run with Node 24 and the existing lockfiles installed:

```text
npm --prefix prototypes/recipe-d1-local ci
npm --prefix frontend ci
npm --prefix frontend test -- --mode health-worker-qa
```

The existing `recipe-worker-qa` job invokes this mode separately, without
replacing its Recipe or shared Auth suites. Tests bundle the Worker in memory
and exercise Workerd/D1 with two independent local clients. Metrics are
local D1 statement/row metadata and wire/bundle byte counts, not production
billing, mounted Health UI, or physical-device measurements.
The update fixture also measures UTF-8 record bytes held by immutable events.
These exclude event/receipt metadata, indexes and SQLite allocation overhead.
