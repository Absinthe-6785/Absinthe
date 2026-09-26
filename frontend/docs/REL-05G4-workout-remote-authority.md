# REL-05G4A workout remote authority foundation

This document describes G4A only. The product workout UI and legacy workout
routes remain unchanged. G4B local binding/push/pull/IndexedDB v7, G4C reset,
G5 cutover, and G6 ACTIVE/legacy writer fence are deferred.

## Dormant activation boundary

`WORKOUT_REMOTE_FOUNDATION_ENABLED` defaults to disabled in the backend. All
new `/api/sync/v2/workouts/*` routes require a verified JWT and the trusted
server's `K323_PROJECT_SCOPE`. The existing generic K-323 v2 routes continue
to reject `health_workout_session`, regardless of their flags. A missing
`health_workout_capabilities` row means `DISABLED`. Only a trusted database
administrator can explicitly set `FOUNDATION_READY`; G4A provides no client
capability-write API and does not auto-upgrade any account. The G4A database
constraint excludes `ADOPTION_READY` and `ACTIVE`.

The server endpoint is only a thin validated caller of PostgreSQL functions.
Registration requires an existing active `remote_sync_generations` row under
the same owner/project/namespace/generation identity. This follows the shared
K-323 generation lifecycle; G4A does not create or reactivate that shared row.
An exact repeated registration returns its original server-allocated UUID
`bindingId`. The binding is immutable and retains its original `authorityEpoch`
even if a future G4C transition advances the account epoch.

## Authority and transaction order

`lock_health_workout_authority_v1(owner, project)` is the sole lock helper.
Its transaction-scoped key is
`ownerUUID|trustedProjectScope|health_workout_session|authority` hashed by
`hashtextextended(...,0)`. G4C must acquire this same key before an epoch or
reset-state transition. The first authority row is created at epoch 1 only
after an explicit `FOUNDATION_READY` capability decision under that lock.
`RESET_FENCED` and nullable reset-job schema exist for compatibility; G4A
exposes no reset transition or epoch-increment RPC.

For a mutation the SQL order is authority lock, capability/current epoch,
exact generation binding and shared generation lifecycle fence, mutation and
idempotency receipt decision, whole-entity revision CAS, entity write,
immutable receipt, append-only shared change event, commit. The existing
owner/project stream lock serializes sequence allocation with K-323 and
fixed-watermark snapshots. Any exception rolls back entity, receipt and
change together. Receipt lookup never precedes current-epoch validation.
An old-epoch receipt is durable history, never current permission.

The canonical entity is `health_workout_sessions_v2`. A first create needs
`remoteCasBaseRevision: null` and produces revision 1; subsequent upsert,
tombstone and explicit restore require the exact current server revision and
increment it once. A tombstone retains the last full record/content hash.
Restore is allowed only from a tombstone. The local G2/G3 `baseRevision` is
not the server CAS base. `created_at`, `updated_at`, and client `createdAt`
are not concurrency authority.

An existing dormant G1 row is not implicitly adopted: matching its revision
is insufficient without current authority epoch, content hash and committed
receipt evidence. Create returns `ENTITY_ALREADY_EXISTS`; update, tombstone
and restore return `AUTHORITY_EVIDENCE_MISSING` (HTTP 409), with no entity,
receipt or change write. Explicit adoption remains outside G4A.

## Canonical wire contract

`WorkoutSessionV1` validation is strict on the server: exact object keys,
UUIDv4 IDs, nonempty ordered entries/sets, unique IDs, exercise/set kind
coherence, contiguous 1-based set ordinals, safe integers, and canonical
decimal strings. `localDate` uses ASCII digits and real calendar validity.
The dormant G4A external authority wire requires lowercase UUID text in
`entityId`, `bindingId`, the mutation UUID component and snapshot token;
mixed-case external values are rejected with a deterministic HTTP 400 before
the RPC. Inside a `WorkoutSessionV1` payload, session/entry/set UUIDv4 text
retains the frozen frontend's case-insensitive grammar. UUID-value equality
checks that payload `record.id` matches external `entityId`, and case-only
duplicate session/entry/set UUIDs are invalid. Neither validation nor SQL
lowercases the stored payload strings: content/payload hashes commit their
original spelling. For G4B, a mixed-case local session must retain its exact
record and hashes, derive lowercase external `entityId` from the UUID value,
then compute requestDigest using that external ID plus the original payload
hash. G4B owns that binding/delivery step; G4A rewrites no G1-G3 local data.
Canonical UTF-8 record bytes
may not exceed 131072. The
decimal grammar is `^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$`; weight/source
have at most two fractional digits and distance meters at most three.
Pounds-to-kilograms verification uses exact decimal multiplication by
`0.45359237` and HALF_UP to two places, never binary float. The server
recomputes both the canonical payload hash and request digest before calling
the SQL authority RPC. After SQL establishes the current epoch and exact
binding, it independently recomputes the same digest tuple and rejects a
mismatch before receipt lookup. The shared JSON fixture
`protocol/rel05g4a-workout-vectors.json` is consumed by Python and JS tests.

The request digest is SHA-256 of compact JSON array encoding with this exact
field order (strings retain their wire spelling):

1. `"absinthe-workout-remote-v1"`, `2`
2. JWT-derived owner UUID string, trusted server project string
3. `"health_workout_session"`, namespace key, generation ID, device ID
4. server binding ID, numeric authority epoch
5. mutation ID, idempotency key, entity UUID string, operation
6. remote CAS base revision (`null` for create), local revision, canonical
   payload hash

Canonical objects inside payload use the existing sorted-key, compact UTF-8
K-323 serializer; arrays retain order. `createdAt` is accepted as validated
non-authoritative metadata but excluded from the digest, because its
immutability across future G4B delivery/retries is not guaranteed by G4A.
Transmission time is never bound. A changed bound field requires a changed
digest. SQL receipts persist both this digest and the immutable epoch/binding
evidence. The trusted service-role backend is the digest-recomputation
boundary; direct untrusted roles cannot call the RPC.

An exact repeated bound request returns the original committed reference,
revision, sequence, content hash and timestamp with `outcome: exact_replay`;
it cannot write a second entity version, receipt or event. Same mutation ID
with a different digest returns `MUTATION_ID_CONFLICT`.

## Shared change stream and snapshot

Workout events append to `remote_reference_changes_v2`, not a parallel
workout stream. Workout pull validates the caller's current generation binding
but selects events by JWT owner + trusted project + workout domain + sequence,
not by the producing namespace/generation. This is deliberately separate
from the existing K-323 reference and routine pull functions, whose semantics
are unchanged. `serverEpoch` remains the K-323 stream-continuity UUID and is
distinct from numeric workout `authorityEpoch`.

`begin_health_workout_snapshot_v1` serializes with the shared stream lock,
captures the committed maximum sequence watermark, and stores an opaque UUID
token bound to owner/project/domain, binding, authority epoch and server epoch.
`page_health_workout_snapshot_v1` uses entity-UUID keyset pagination (default
16 whole records) over each entity's latest append-only event with sequence
`<= watermark`. Thus a later update cannot contaminate earlier pages. A
server-epoch change invalidates the token; an authority/binding change fails
closed. Tokens have no time expiry in G4A. Workout change history must not be
pruned while such tokens may be used; retention/cleanup is deferred and must
be designed with G4B full-resync completion in mind. Pre-G4 dormant rows
without a change event remain untouched, but are not part of a remote
snapshot until a future authorized mutation creates history for them.

## Permissions and deployment notes

RLS remains enabled on workout tables; `anon`, `authenticated`, and
`service_role` have no direct DML on workout entity, authority, binding or
snapshot tables. The functions are `SECURITY DEFINER` with empty search path,
owned by the trusted migration role, and only the authenticated backend's
service role can execute the public workout RPCs. Internal helpers have no
service-role EXECUTE grant. Existing K-323 service-role INSERT privileges on
the shared receipt/change tables remain for older domains; a domain-specific
trigger rejects direct service-role insertion of workout rows outside the
migration-owner RPC. A deployment whose migration role does not own those
tables/functions must verify ownership before enabling the feature flag.

Real PostgreSQL integration and concurrency tests run in the CI
`backend-rel05g1` job with `K323_POSTGRES_INTEGRATION=1`. Local Docker
absence is not a waiver: G4A cannot be called complete until the exact-head
hosted CI job has passed those tests. No application runtime invokes these
new routes in G4A.
