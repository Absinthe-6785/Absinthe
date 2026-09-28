# REL-05G4C Workout remote reset (dormant foundation)

G4C adds an authenticated, server-side Workout reset primitive. It is an
authority transition, not a hard delete and not a Settings UI cutover. The
frontend client and repository methods in this change are dormant; G5 owns
product orchestration and G6 owns ACTIVE capability/legacy-writer fencing.
The existing `/api/reset` and Settings flow are unchanged in G4C. In
particular they do **not** invoke this primitive or claim cross-device Workout
deletion. Do not use them as a substitute for this transition after cutover.

## Authority and lock order

The two reset SQL RPCs call G4A's `health_workout_authority_context_v1`, which
acquires the sole transaction advisory lock keyed by authenticated owner UUID,
trusted `K323_PROJECT_SCOPE`, and `health_workout_session`. The order is
authority lock, capability/current epoch/binding, job and immutable manifest,
canonical entities, then the existing owner/project change-stream lock. G4A
registration and mutation use the same authority lock. Reset cannot race a
previously authorized create outside its inventory; old-epoch requests after
the transition are rejected before receipt replay or canonical writes.

The backend derives owner from the verified JWT and project from server
configuration. The client supplies a v4 reset ID and SHA-256 digest over the
frozen `absinthe-workout-reset-v1` tuple (protocol version, owner, project,
domain, namespace, generation, device, binding, source epoch, reset ID). SQL
recomputes it, checks current capability and binding for **initiation**, and
uses the same ID/digest for idempotent replay. A different tuple under the
same reset ID is rejected. Continuation uses the historical source tuple only
for the already-authorized job; it cannot initiate a second transition.

## Durable transition and recovery

`begin_health_workout_reset_v1` freezes every canonical Workout row for the
owner/project, including already-deleted rows and independent of producing
generation. A single transaction writes the immutable source revisions,
records, hashes, refs, states, deterministic per-entity reset refs, count and
digest to `health_workout_reset_jobs/items`, then moves authority from E to
E+1 and enters `RESET_FENCED`. If inventory capture fails, the transaction
does not advance the epoch. Already-deleted rows are counted but not
re-tombstoned. Server epoch is unchanged.

Each `continue_health_workout_reset_v1` call applies at most 25 frozen active
items. It checks each entity against its frozen source before updating. The
canonical tombstone gets revision+1, retained record/content hash, deletedAt,
target authority epoch and a reset ref. In the same SQL transaction it writes
an immutable reset-owned receipt, account-wide Workout change event and item
progress. The receipt is provenance for a later explicit target-epoch restore,
not a client push ACK; its source binding cannot authorize a target-epoch
client replay. A rolled-back batch has no entity/change/item effect. A
committed batch is never logically applied again. Completion verifies all
active items' canonical/change/receipt evidence, records a completion digest,
then changes authority to OPEN atomically.

If the initiating client disappears, an authenticated owner may call
`POST /api/sync/v2/workouts/resets/active/recover` to apply the next existing
batch without creating a new reset. Repeated calls eventually finish the
frozen job. Normal requests use `POST /api/sync/v2/workouts/resets` followed by
`POST /api/sync/v2/workouts/resets/{resetId}/continue`. A completed reset ID
returns its historical result; a genuinely new reset under a fresh current
binding advances the epoch once more. No direct table DML is granted to
`anon`, `authenticated`, or `service_role`; the trusted backend alone may call
the security-definer RPCs.

## Devices, snapshots and local data

The target epoch remains fenced until completion, including target-epoch
registration and writes. Old generation bindings and receipts remain
historical, never rebound. A fresh shared generation and Workout binding can
discover the new epoch after completion. Disconnected devices' old bound
outbox requests are rejected; normal account-wide pull or full resync observes
the reset tombstones. G4B3 preserves pending local edits as conflicts, without
pull-based ACK or CAS rebase. No IndexedDB store is cleared or upgraded; v7
retains a separate `health_workout_session.reset` intent record in the
existing authority store. The dormant client persists this ID/digest before
network I/O, applies one server batch per call and can resume after response
loss. It does not change local entities, outbox, checkpoint or product UI.

G4A's fixed-watermark snapshot token is bound to the issuing authority epoch
and binding. A snapshot begun before the transition is consistently rejected
with `AUTHORITY_RESET_FENCED` during application and
`STALE_AUTHORITY_EPOCH` after completion, even though its stream watermark
remains immutable. The caller must discover a fresh generation/binding and
start a new snapshot; the dormant G4B3 client abandons only its old staging
session on either reset-specific rejection, preserving local entities and
pending outbox. A post-reset snapshot contains the reset tombstones.

An active dormant G1 row without a G4A content hash/ref/committed receipt is
not safe to emit as a G4B3 change. Initiation returns
`RESET_INVENTORY_UNSUPPORTED` **before** the epoch changes. Such data needs an
explicit adoption/repair design; it is not silently hashed, skipped or
reported as successfully reset. Already-deleted G1 rows are included in the
inventory and need no new event. This is a deployment preflight concern.

## Operational evidence and scope

The job stores source/target epochs, phase, frozen inventory count/digest,
applied count, completion digest and timestamps. The item store supplies
per-entity source and result evidence. These records are the bounded
diagnostics; no tokens or full user payloads are logged by the endpoint.
Backend migration uses service-role-only functions and owner/project-scoped
rows. No G5/G6 activation, legacy writer shutdown, Notes/Health redesign,
or production data migration is part of G4C.
