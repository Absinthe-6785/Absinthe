# REL-05G4B1 — dormant Workout remote binding foundation

This workstream adds local control-plane evidence only. It does not start a Workout worker, send mutations, pull changes, apply snapshots, or alter the Health product path. G4B2 owns push and receipts; G4B3 owns pull/full resync; G4C reset, G5 cutover, and G6 irreversible writer fencing remain deferred.

## Additive database v7

Version 7 adds four stores without clearing or normalizing v6 entities, outbox rows, Notes, or G3 adoption data:

| Store | Key | Purpose |
| --- | --- | --- |
| `workout_remote_authority` | account, namespace, generation, domain | Authenticated G4A capability/epoch/project-scope/generation binding evidence, including device and server epoch |
| `workout_remote_ids` | account, namespace, generation, domain, original local ID | Original case-preserved local Workout UUID ↔ lowercase wire UUID; `by_wire_id` supports reverse lookup |
| `workout_full_resync_sessions` | account, namespace, generation, session | Reserved for G4B3; not populated in G4B1 |
| `workout_full_resync_items` | account, namespace, generation, session, wire ID | Reserved for G4B3; not populated in G4B1 |

Existing explicit `{version:1,state:'unbound'}` Workout rows remain unchanged and non-sendable. Non-Workout rows without `deliveryBinding` retain their REL-05D behavior.

## Authority discovery and local fences

The dormant client uses the existing authenticated K-323 v2 `ensureGeneration` request with the *same* namespace/generation/device identity. It then reads `GET /api/sync/v2/workouts/authority` and, when required, registers that exact generation through `POST /api/sync/v2/workouts/generations`. It accepts only `FOUNDATION_READY`, open authority, a positive epoch, a canonical binding UUID, and matching `projectScope` across both authenticated G4A responses. `projectScope` is never inferred from the local project reference or environment. Capability disabled, reset fenced, stale binding, auth failure, network failure, and malformed response never grant local permission. A registration response can be retried after local persistence failure; server idempotency must return the same binding.

Before network I/O, each discovery reserves a monotonically increasing sequence in the existing v7 authority store. IndexedDB serializes it across tabs. A successful authenticated discovery persists its exact authority result with that sequence and a random `verificationId`; an older completion cannot replace a newer reservation. Starting a new discovery invalidates the previous token even if the new attempt fails. The binding transaction requires the caller's exact verification ID and the latest reserved sequence. Persisted authority is durable evidence, not timeless permission: a new immutable binding uses `discoverAndBind` (fresh discovery → optional registration → persistence → bind), never a cached row alone. `verifiedAt` is diagnostic, not authority ordering. Higher authenticated epochs can replace older epochs despite a backward client clock; same-epoch authority-critical identity disagreement fails closed. Already-bound requests remain immutable and can be inspected without rediscovery.

## Immutable binding

`bindWorkoutMutation` is an explicit internal call, not a boot hook. One readwrite transaction re-reads active generation, authority, target outbox, immutable payload/hash, current entity and remote metadata, conflict/lineage records, and UUID mapping. It writes the mapping and the exact unbound→bound transition together. Failure after either write aborts both. Concurrent binders observe the same durable result; no alternate binding is produced.

The bound v1 fields are `contractVersion='absinthe-workout-remote-v1'`, server `projectScope`, `authorityEpoch`, `generationBindingId`, `remoteCasBaseRevision`, lowercase `wireEntityId`, `requestDigest`, and `boundPayloadHash`. The digest matches G4A's canonical tuple and excludes `createdAt`. The original outbox payload and hash are never rebuilt from a later entity revision. Local Workout/entry/set UUID spelling and content hashes remain case-preserved. A case-only local session UUID collision is blocked with durable `UUID_MAPPING_COLLISION` evidence, not merged or selected by timestamp. Attempted explicit-unbound rows receive durable `UNBOUND_ATTEMPT_QUARANTINED` evidence and never silently bind.

`remoteCasBaseRevision` is separate from local `baseRevision` and `localRevision`. Null is allowed only for a first local create without remote history, including a G3 adopted create whose completed manifest, verified item, exact target entity/outbox and sealed digests all match. Arbitrary `legacy_migration` provenance never suffices. For a target mutation, the remote CAS base comes from evidence causally tied to its base local state: a newer validated `remoteSequenceBoundary` supersedes older retained ACK history; otherwise the direct acknowledged predecessor may supply the base. Equal-state evidence must agree. No timestamp or maximum-revision heuristic selects the base. Real remote convergence atomically persists `serverRevision` and `remoteState` (`active` or `deleted`); local-only writes do not invent remote state. Update/tombstone require an active remote base, while restore requires a deleted base. Unknown or incompatible state blocks binding. G4B1 does not manufacture acknowledgements; tests seed durable server-settlement evidence only to exercise successor rules. Mixed-case tombstone payload UUIDs compare by value to the lowercase wire UUID in both frontend and G4A validation, preserving the original payload spelling, hash and request digest tuple.

The forward-only `202609270001_rel05g4b1_workout_tombstone_uuid_value.sql` migration replaces only the existing G4A mutation RPC body. It first validates the tombstone payload ID as UUIDv4, then compares UUID values without changing the JSON, hash, digest, function signature, owner, or grants. The deployed G4A migration remains untouched.

All existing generic claim paths continue to skip rows with any `deliveryBinding`, including the new bound variant. No Workout mutation endpoint, retry timer, pull API, snapshot API, AppContent wiring, or legacy fallback is activated here.
