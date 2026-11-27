# Canonical Health transport (isolated local QA)

This is the existing REL-05G4 Workout transport, limited to a synthetic,
insert-only first-create slice. There is no product adapter, Wrangler
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
  `entity_snapshot` upserts with a null remote CAS base. It uses the same
  WorkoutSessionV1 validator, payload hash and request digest as the client.
  A guarded insert plus SQLite trigger creates the entity, change and receipt
  in the same transaction. The batch reads back that receipt; a replay can
  only return the original immutable acknowledgement. Lookup and uniqueness
  are scoped by authenticated owner and trusted project.
- `GET /api/sync/v2/workouts/changes` uses a per-account/project sequence
  and the existing incremental wire format. A short page (max 16 records)
  advances only to the last included sequence. There is no pruning, so
  retention floor is 0. An epoch mismatch can signal full resync required;
  the snapshot/reset operations themselves are unsupported. The indexed first
  event fences reads and writes if its authoritative epoch changes; old
  events are never restamped. Pull cannot acknowledge an outbox mutation.

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
