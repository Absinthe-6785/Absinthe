# REL-05F Health routine aggregate convergence

## Pre-cutover authority characterization

The product had three overlapping representations:

- `healthRoutinePresets:v1:<encodeURIComponent(accountId)>` stored the account-scoped `RoutinePresetState` used by the Health preset UI. It included the Default preset, named presets, split count, ordered days, block membership/order, planned-set counts, and `activePresetId`.
- `healthSplitCount` and `healthRoutinePlannedSets` were unscoped compatibility inputs. `healthRoutinePresetLegacyAdoption:v1:<encodeURIComponent(accountId)>` recorded explicit account-bound adoption. These keys remain compatibility reads and are not deleted by REL-05F.
- `health_routines` was the remote/default-routine child-row representation. Health bootstrap read `/api/health_routines`; the old Health save path posted child rows to the same endpoint and the local Health repository also exposed a `health_routines` store. Named presets and active preset identity had no remote representation.

`HealthView` and `useRoutinePresetController` owned the production preset mutations. Bootstrap reconciliation used remote existence, row count, and row timestamps as heuristics around legacy Default rows. There was no preset storage-event listener, realtime subscription, or polling loop. Vault extensions carried legacy split/planned metadata, while Settings reset cleared local preset state and the legacy routine projection. Workout, InBody, nutrition, exercise-library, and Notes authority are separate and unchanged.

## Canonical authority

`HealthRoutinePresetAggregate` is the single complete preset record. One revision contains the stable UUID, name, split count, ordered days, ordered block UUIDs, planned-set values, and Default identity. `HealthRoutineProfileAggregate` is the separate account singleton that carries the active preset UUID.

The fixed Default ID is `00000000-0000-5000-8000-000000000001`; the profile ID is `00000000-0000-5000-8000-000000000002`. Existing non-UUID local preset IDs are migrated deterministically from account ID plus the original preset identity. Array position is never identity material. Actual duplicate legacy IDs are disambiguated by a canonical fingerprint of each colliding logical record, so unrelated reordering and later renames do not change the primary mapping and same-name presets with distinct legacy IDs are not collapsed. The migrated account-scoped snapshot is retained in the existing local key as a compatibility cache.

Strict adapters convert between `RoutinePresetState` and the aggregate records. Sync rejects malformed IDs, unknown fields, non-contiguous day order, duplicate blocks, invalid planned-set references or bounds, and profile references with invalid shape. UI component state is a projection, not sync authority.

## Durable local-first path and adoption

Health routine startup opens a REL-05D namespace scoped by account, project, device, and generation. Bootstrap reconciles every preset and the profile from the complete account-scoped source into durable entities and outbox records. It does not treat the presence of one preset as migration completion, so restart after any partial durable import finishes the missing records idempotently without replacing equivalent records or changing their mutation identity. A pre-authority `health_routines` response is compatibility input only; it cannot replace an explicit local three-day snapshot merely because it exists or has more rows. Materially ambiguous local/legacy states preserve conflict evidence and fail closed instead of using timestamp last-write-wins.

Every edit first commits the complete changed aggregate and its outbox mutation atomically. The UI updates from that local result, and remote synchronization is started separately in the background. A hung or failed transport cannot hold a later durable local commit behind the network operation. Transport runs only at authenticated startup/account activation, explicit save, and browser `online`; there is no visibility/focus trigger, realtime subscription, or periodic poll in this phase. Pending local edits survive reload and remain authoritative when a newer pull conflicts. A remote change and conflict/checkpoint boundary are committed atomically.

## Remote authority and compatibility projection

The closed K-323 v2 domains are `health_routine_preset` and `health_routine_profile`. The backend derives the owner from the verified JWT, performs strict domain validation, and invokes dedicated PostgreSQL functions. Dedicated typed tables hold server revisions and mutation references; the existing immutable receipt and append-only change stream provide exact replay and pull ordering. Generic reference domains stay independently disabled.

Clients write only the new aggregate authority. The legacy `POST /api/health_routines` writer is disabled, and `/api/reset` no longer deletes legacy routine rows independently. After a successful Default-preset mutation, PostgreSQL rebuilds that account's complete `health_routines` projection in the same transaction: existing rows are deleted and the current Default days are inserted. Named presets are not projected. Therefore a four-to-three-day aggregate revision removes the old Day 4 row, and legacy rows never write back into aggregate authority.

Preset deletion is a revisioned tombstone and restore reuses the same UUID. The fixed Default cannot be tombstoned at the frontend, server-validation, or PostgreSQL authority boundary, and only that fixed ID may carry `isDefault=true`. An active named preset cannot be tombstoned until the profile is moved; profile updates reject a missing or tombstoned target. When an outbox contains deletions, claim selection prioritizes the prerequisite profile mutation before applying the batch limit, so the dependency survives batches larger than 100 and restart/retry. A profile pulled before its referenced preset is locally applicable is preserved through the conflict/checkpoint safety boundary rather than accepted by arrival order.

## Backup, recovery, reset, and limitations

Vault backup asynchronously reads the account-scoped durable routine repository, preserving stable IDs, active profile, named presets, planned sets, and full logical state. The localStorage snapshot is used only as a compatibility fallback when durable authority is unavailable. Restore first validates and writes that account snapshot, then `recover` emits ordinary durable aggregate mutations; backup timestamps are not freshness authority.

Settings reset first pulls the complete canonical account inventory and server revisions, then writes an empty fixed Default, moves the profile, and tombstones every named preset through the same revisioned durable path. Profile-before-delete ordering is enforced before bounded claims. Reset reports success only after synchronization completes and no pending, claimed, retrying, conflicted, or permanently failed Health mutation remains. The compatibility projection follows the successful Default mutation, and another device subsequently converges to the same single-Default state.

REL-05F does not sync workouts, InBody, nutrition, the exercise library, Notes, Planner, Recipes, or Knowledge. Cross-device convergence is bounded by startup/save/online activation; a device that remains open and online without one of those triggers does not continuously poll for another device's changes.
