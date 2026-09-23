# REL-05G2: Workout local durable foundation

REL-05G2 adds a dormant, versioned local representation for workout sessions on the existing REL-05D durable database. It does not switch product runtime authority or add a workout network transport.

## Canonical record

`WorkoutSessionV1` stores a UUIDv4 session ID, a local calendar date, ordered exercise entries, historical exercise snapshots, and ordered sets. Session, entry, and set IDs are identity; array order and the one-based contiguous set ordinal describe display order. Reordering does not change identity. The canonical record contains no local/server revision, mutation, tombstone, sync status, or timestamp conflict authority.

Strength and bodyweight repetitions use safe integers. Assisted repetitions normalize zero/blank to `null`; a present value is positive and cannot exceed total repetitions. Strength measurements are canonical decimal strings with at most two fractional digits; cardio distance is a canonical decimal string with at most three. Canonical decimals have no redundant leading or trailing zeros. Input normalization and lbs-to-kg use integer/`BigInt` arithmetic; lbs conversion rounds HALF_UP to two kg decimals. Kilometer conversion is an exact ×1000 shift and rejects precision that cannot be represented in meters. Cardio duration is integer seconds. The canonical JSON payload is limited to 131,072 UTF-8 bytes.

The serializer and hash are the existing `canonicalPayloadJson`, `canonicalPayloadSnapshot`, and `hashCanonicalPayload` utilities. Floating-point JSON numbers are not accepted as authoritative workout measurements.

## Local persistence and delivery boundary

`WorkoutSessionRepository` maps the canonical record to the existing `health_workout_session` `LocalEntityEnvelope`. Local revision remains the REL-05D entity revision; server revision remains separate and starts as `null`. Create, update, tombstone-delete, and restore use the existing atomic entity-plus-outbox mutation. `OutboxRecord.baseRevision` continues to mean the previous local revision.

Every new workout outbox row explicitly stores `{ version: 1, state: "unbound" }`. Such rows cannot be claimed. If an explicit-unbound row already contains attempt evidence, a delivery-candidate or claim scan persists `UNBOUND_ATTEMPT_QUARANTINED` without changing its payload, mutation ID, idempotency key, or attempt evidence. Legacy rows that omit `deliveryBinding` retain existing behavior. G2 adds no bound state, request digest, remote CAS, authority epoch, or send API.

The generic `commitRemoteConvergenceBatch()` writes remote active/tombstone changes or unresolved conflict evidence together with the sync checkpoint in one IndexedDB transaction. A pending local entity and its outbox are preserved; the remote candidate is stored as conflict evidence rather than winning by timestamp or silently overwriting local state. Checkpoint or batch failure aborts all entity/conflict/checkpoint writes.

## Deliberately dormant scope

Current product workout callers continue using the existing workout store and `local_version` behavior. G2 does not read, migrate, or backfill current or legacy workout records and does not change backend files or the `DISABLED` G1 capability. There is no workout push/pull transport. G3–G6 adoption, binding, authority, and transport work remains deferred. Local durable data is not equivalent to cloud-settled data.

Windows Edge installed-app storage and iOS Safari Add to Home Screen storage are independent device-local stores. G2 assumes no shared IndexedDB, generation, recovery state, or device identity between them.
