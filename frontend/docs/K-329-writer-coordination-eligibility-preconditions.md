# K-329B — Production writer coordination and eligibility preconditions

## Verdict and scope

`WRITER_COORDINATION_ARCHITECTURE_SELECTED`

`SELECTED_ARCHITECTURE: WEB_LOCKS_PLUS_DURABLE_WRITER_REGISTRY_AND_EPOCH_ADMISSION`

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

K-329B is a pure, deterministic architecture model. It adds no production caller, storage schema, browser API, timer, network operation, UI, worker, service worker, K-328 invocation, source mutation, or eligibility activation. K-326G is unchanged and remains fail-closed.

The selected future composition is one physical-source Web Lock plus a durable coordination authority, exact code-reviewed manifest authority, writer/self registration, exact drain acknowledgements, durable admitted-operation evidence, epoch fencing in the authoritative source transaction, six chained checkpoints, and verifier-captured source evidence. BroadcastChannel and heartbeats may be advisory only.

## Trusted reviewed-manifest authority

The protocol trust root is not supplied by an evaluator caller. `createK329BReviewedManifestAuthority(physicalSourceDigest)` derives an authority record from the frozen `K329B_REVIEWED_WRITER_MANIFEST_ENTRIES` source:

| Field | Contract |
|---|---|
| authority ID | `k329-source-reviewed-manifest` |
| schema / byte format | `1` / `1` |
| manifest version | `k329b-source-reviewed-v1` |
| reviewed entry count | exactly `30` |
| physical binding | exact 64-character lowercase SHA-256 source digest |
| manifest digest | SHA-256 of the fixed-order canonical manifest bytes, including the physical-source digest |
| authority digest | SHA-256 of the fixed-order canonical authority bytes |

The validator reconstructs the exact reviewed manifest for the authority's physical source and recomputes its digest. A caller cannot substitute a smaller manifest and a matching self-issued authority. Entry changes, reorderings, roles, contexts, capabilities, counts, versions, and physical bindings fail as `REVIEWED_MANIFEST_AUTHORITY_MISMATCH`.

There is no runtime manifest replacement or version-bump action. A future update requires a new source audit, a separately code-reviewed frozen manifest/version constant, updated exact count and tests, and an explicit later persistence migration. Old authority bytes cannot authorize a new inventory.

## Corrected writer inventory

The source review covers 30 stable writer types: 15 authoritative, 4 auxiliary, 4 metadata, 1 remote-only, and 6 dormant/test-only. The sum, manifest length, and authority `reviewedEntryCount` are tested equal.

| Stable writer type | Source boundary / trigger / physical container | Mutation and commit signal | Drainability / authority / rule |
|---|---|---|---|
| `legacy.notes.cross_tab_merge` | `useNotesStore.ts/applyStorageMerge`; storage event; live Notes IDB/localStorage | merge then persistence call; sync return or unawaited promise | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.idb_snapshot` | `noteIndexedDb.ts/saveNotesToIndexedDb`; persistence facade; `absinthe-notes-v1/notes` | full clear-and-put transaction; IDB `oncomplete`, revision separately | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.init_rescue_seed` | `notePersistence.ts/initNotesPersistence`; startup; IDB/localStorage | rescue merge or welcome replacement; selected async path | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.persistence_facade` | `notePersistence.ts/saveNotesAsync`; page action; IDB/localStorage fallback | full-array replacement; promise often discarded | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.persistence_migration` | `migrateLocalStorageNotesToIndexedDb`; startup migration; IDB/localStorage | merge/replace/marker/remove across commits | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.storage_migration` | `noteUtils.ts/migrateLegacyStorageIfNeeded`; page load; historical/current localStorage | merge plus Notes/folder/active/marker writes | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.store_actions` | `useNotesStore.ts/persistNotes` and mutations; page actions; live Notes source | full-array replacement; sync result or unawaited promise | uncoordinated authoritative writer; `must_participate` |
| `legacy.notes.embedded_attachment_migration` | `embeddedAttachmentMigration.ts/migrateEmbeddedDataUrlsToAttachments`; explicit review-panel run; Notes plus attachment stores | backup, blob/metadata writes, then awaited `input.updateNote` | later authoritative Note mutation; not drain-aware; `must_be_disabled` |
| `legacy.notes.embedded_attachment_restore` | `embeddedAttachmentMigrationRestore.ts/restoreEmbeddedAttachmentMigrationBackup`; explicit confirmed restore; migration backup plus live Note | read/hash guards then awaited `input.updateNote` | authoritative restore consumer/writer; not drain-aware; `must_be_disabled` |
| `legacy.notes.idb_clear` | `noteIndexedDb.ts/clearIndexedDbNotes`; reset/cleanup; live IDB | store clear; IDB `oncomplete` | destructive authoritative writer; `must_be_disabled` |
| `legacy.notes.idb_delete` | `noteIndexedDb.ts/deleteNoteFromIndexedDb`; permanent delete; live IDB | record delete; IDB `oncomplete` | destructive authoritative writer; `must_be_disabled` |
| `legacy.notes.local_snapshot` | `notePersistence.ts/saveNotesToLocalStorageResult`; fallback; `notes-v2` | full-array `setItem`; synchronous return | non-atomic authoritative fallback; `must_be_disabled` |
| `legacy.notes.remote_hydration_merge` | `useNotesStore.ts/hydrateFromDB`; hydration job; live Notes source | remote/local merge then local replacement | sync writer currently recovery-blocked; `must_be_disabled` |
| `legacy.notes.reset_cleanup` | reset/clear and `persistenceCleanup.ts`; reset/startup; IDB/localStorage | remove/clear/seed fan-out | destructive authoritative writer; `must_be_disabled` |
| `legacy.notes.restore_import` | vault restore flow/store restore and undo; restore job; Notes/folders | selected merge/replacement fan-out | authoritative restore writer; `must_be_disabled` |
| `legacy.notes.backup_durability` | `notePersistence.ts/backupNotesBeforeDurabilityWrite`; before rescue/migration; timestamped localStorage backup | full payload `setItem`; synchronous return | auxiliary, not live authority; `excluded_with_proof:AUXILIARY_CONTAINER_NOT_AUTHORITY` |
| `legacy.notes.embedded_attachment_backup` | `createLocalEmbeddedAttachmentMigrationBackupWriter`; before embedded conversion; `absinthe.notes.embeddedAttachmentMigration.backup.*` | original Note body/content JSON `setItem`; synchronous return inside async writer | auxiliary preservation container that can later feed the separately classified restore; `excluded_with_proof:AUXILIARY_CONTAINER_NOT_AUTHORITY` |
| `legacy.notes.vault_restore_snapshot` | `vaultRestoreSnapshot.ts`; restore preparation/cleanup; pre-restore localStorage snapshot | snapshot set/remove; synchronous return | auxiliary recovery evidence; `excluded_with_proof:AUXILIARY_CONTAINER_NOT_AUTHORITY` |
| `legacy.notes.vault_snapshot_auto` | `vaultSnapshotAuto.ts`/`vaultSnapshotStore.ts`; automatic/export/restore snapshot; localStorage index/chunks | multi-key snapshot and retention writes | auxiliary recovery evidence; `excluded_with_proof:AUXILIARY_CONTAINER_NOT_AUTHORITY` |
| `legacy.notes.folder_metadata` | `noteUtils.ts/saveFolders`/active Note; page actions; folder/active localStorage | full folder/scalar set; synchronous return | metadata only; `excluded_with_proof:METADATA_NOT_SOURCE_AUTHORITY` |
| `legacy.notes.idb_metadata` | migration marker/revision helpers; after IDB work; localStorage | scalar set; best effort | metadata only; `excluded_with_proof:METADATA_NOT_SOURCE_AUTHORITY` |
| `legacy.notes.notes_sync_metadata` | `notesSyncClient.ts`; sync lifecycle; timestamp/bootstrap localStorage | set/remove; synchronous return | metadata only; `excluded_with_proof:METADATA_NOT_SOURCE_AUTHORITY` |
| `legacy.notes.onboarding_marker` | `notesOnboarding.ts`; seed/startup; localStorage | scalar set/remove | metadata only; `excluded_with_proof:METADATA_NOT_SOURCE_AUTHORITY` |
| `legacy.notes.lifecycle_remote_flush` | timer/pagehide/beforeunload; remote API | best-effort remote mutation | no local source mutation; `excluded_with_proof:REMOTE_ONLY_NO_LOCAL_SOURCE_MUTATION` |
| `handoff.k328_evidence` | dormant cross-context handoff API; separate evidence DB | evidence writes only; strict IDB completion | no production caller; `excluded_with_proof:DORMANT_NO_PRODUCTION_CALLER` |
| `legacy.notes.audit_k96b` | explicit audit/test fixture | test seed/clear/migrate | test-only; `excluded_with_proof:TEST_ONLY_NO_PRODUCTION_REACHABILITY` |
| `legacy.notes.audit_k96d` | explicit audit/test fixture | injected/default storage audit writes | test-only; `excluded_with_proof:TEST_ONLY_NO_PRODUCTION_REACHABILITY` |
| `legacy.notes.audit_k97f` | explicit audit/test fixture | seed/clear/marker audit writes | test-only; `excluded_with_proof:TEST_ONLY_NO_PRODUCTION_REACHABILITY` |
| `local_first.k325_migration` | dormant local-first migration capability | target generation writes | no production caller; `excluded_with_proof:DORMANT_NO_PRODUCTION_CALLER` |
| `local_first.k326_cutover` | dormant cutover capability | local-first metadata/fence writes | no production caller; `excluded_with_proof:DORMANT_NO_PRODUCTION_CALLER` |

`SOURCE_GROUNDED_WRITER_INVENTORY_COMPLETE_FOR_BASE`

New source, injected scripts, extensions, or an unreviewed context do not inherit this verdict. They force a new source review and otherwise fail closed as inventory/unknown-writer evidence.

## Durable model and canonical persistence

`WriterCoordinationModelState` owns every eligibility-significant value:

```text
authority
reviewedManifestAuthority
reviewedManifest
registrations[]
operations[]
checkpointChain[]
sourceEvidence | null
eligibilityEvidence | null
```

The full model and each record type have fixed-order UTF-8 canonical encoders and strict decoders. Decoding rejects invalid UTF-8, duplicate keys, extra/missing/accessor/inherited fields, unknown versions, invalid ordering, wrong digest bindings, non-canonical bytes, and byte/count ceilings. Successful decode returns detached data and exact re-encoding. Registrations and operations are canonicalized by locale-independent ordinal identifiers. No persisted bytes are repaired or normalized after decode.

The model ceiling is 1 MiB; individual authority/manifest-authority/registration/operation/checkpoint/source/eligibility records have explicit lower ceilings. Restart tests round-trip the entire graph rather than reconstructing evidence from caller flags.

## Authority, writer, and operation lifecycle

Every action carries the actor, exact authority transition revision, coordination epoch, and authority digest. The reducer checks these before applying a transition.

Canonical registration begins only as:

```text
registrationState = registered
coordinated = false
acknowledgedDrainRevision = null
latestOperationId = null
```

Only the exact writer ID/session may register itself. Type, context, capabilities, source, epoch, writer ID encoding, and session are bound. Duplicate writer IDs or sessions fail. A restarted instance has a new writer/session and changes the live instance digest; disappearance or timeout never fabricates shutdown.

After `REQUEST_DRAIN`, the authority records the exact request transition revision. Only the same writer/session can acknowledge that exact revision, only from `registered`, and only with no active admitted operation for that writer. Stale, future, copied, pre-acknowledged, coordinator/verifier/recovery, or new-epoch acknowledgement fails. A valid acknowledgement transitions to `drain_acknowledged`, `coordinated = true`, and records the exact revision.

Admission creates a durable `admitted` operation bound to physical source, writer type/ID/session, epoch, authority revision, idempotency key, mutation type, and expected source revision. Exact retries are idempotent; identity or metadata conflicts fail. Only the same writer/session can terminalize it. Quiescence requires zero unresolved/admitted operations. Production still lacks the required atomic source-write plus operation-terminalization topology.

## Checkpoint chain

The immutable ordered chain is:

1. `BEFORE_DRAIN`
2. `AFTER_ADMISSION_CLOSED`
3. `AFTER_OPERATIONS_TERMINAL`
4. `BEFORE_SOURCE_VERIFICATION`
5. `AFTER_SOURCE_VERIFICATION`
6. `BEFORE_ELIGIBILITY_COMMIT`

Each phase has a distinct reducer action. There is no generic checkpoint API. The reducer derives source binding, state, epoch, transition revision, actor/session, manifest-authority digest, stable writer identity digest, live instance digest, operation digest/count, unresolved count, prior checkpoint digest, source-evidence digest, and self digest from current state.

Checkpoints 1–3 are coordinator-only; 4–6 are verifier-only. Exact phase state/order is enforced. Skip, duplicate, reorder, replay, forged predecessor, copied final state, wrong actor/session, changed manifest, changed writer identity, late/restarted writer, changed capability/context/state, operation mutation, source replay, or stale epoch/revision fails. The protected live-instance digest from checkpoint 3 must remain equal through checkpoints 4–6.

## Source verification evidence

During `VERIFYING_SOURCE`, only the authority-bound verifier may capture:

```text
physicalSourceDigest, sourceType, ownershipProven, canonical, withinBounds,
revisionBefore, digestBefore, revisionAfter, digestAfter,
authoritativeSourceDecision, ambiguityCode,
k328AdapterAvailable, k328PhysicalSourceDigest,
captureActor/session, epoch, transition revision, previous checkpoint digest,
evidence digest
```

The reducer supplies actor/session, epoch, revision, predecessor, and evidence digest; callers cannot add source flags at commit. The after-source and pre-commit checkpoints bind the exact source-evidence digest. Wrong source/K-328 binding, missing adapter, ambiguous source, unproven ownership, malformed or over-budget source, changed revision/digest, wrong actor/session, stale epoch, or missing evidence fails with a stable bounded code. K-329B models the evidence but does not invoke K-328.

## Actor matrix

| Action | Coordinator | Writer | Verifier | Recovery |
|---|---:|---:|---:|---:|
| register writer | no | self only | no | no |
| checkpoint 1–3 | yes, exact phase | no | no | no |
| request drain / close admission / begin drain / mark quiescent | yes | no | no | no |
| acknowledge drain | no | self only | no | no |
| admit / terminalize operation | no | self only | no | no |
| checkpoint 4–6 | no | no | yes, exact phase | no |
| begin/capture source verification | no | no | yes | no |
| commit eligibility | no | no | yes | no |
| abort/fail before terminal state | yes | no | yes | yes |

`WRITER_ACTION_ACTOR_MATRIX` is executable and tests every negative role boundary. Recovery has no registration, acknowledgement, operation, checkpoint, source-success, or eligibility authority.

## Reducer-only eligibility commit

`COMMIT_ELIGIBILITY` accepts only the common CAS envelope and `expectedFinalCheckpointDigest`. It accepts no manifest, manifest completeness boolean, registration/operation array, checkpoint array, source observation, ownership flag, revision, digest, or K-328 flag.

The reducer derives the decision from durable state and requires:

- exact trusted manifest/authority/source binding;
- valid six-record chain, order, predecessor digests, actors, phases, epochs, revisions, and manifest binding;
- stable identity across all checkpoints and stable protected live set through source verification;
- exact persisted source evidence and both source-bound checkpoints;
- full manifest coverage, exact acknowledgements, and required disabled writers absent;
- closed admission and `VERIFYING_SOURCE` authority state;
- zero unresolved/admitted operations;
- exact final checkpoint digest and verifier actor/session;
- exact current CAS revision, epoch, and authority digest.

The successful evidence is reducer-derived and stored in the next model state. No free-form eligibility evaluator is exported or retained.

`COMMIT_ELIGIBILITY_CONSUMES_ONLY_DURABLE_REDUCER_STATE`

`NO_FREE_FORM_ELIGIBILITY_ENTRYPOINT_REMAINS`

## Restart, races, and immutability evidence

Tests restore canonical full-model bytes for `OPEN`, `DRAIN_REQUESTED`, `ADMISSION_CLOSED`, `DRAINING`, `QUIESCENT_CANDIDATE`, and `VERIFYING_SOURCE`, plus two/five checkpoints, missing/present source evidence without the final checkpoint, unresolved operations, missing acknowledgements, and manifest-authority mismatch. Restart preserves closed admission, epochs, operations, registrations, checkpoint chain, source evidence, and authority; it does not synthesize a checkpoint or eligibility.

All race evidence is reducer-driven. Tests cover close/admit on shared revisions, token use after close, stale epochs, duplicate/conflicting idempotency, crash before mutation, response loss after terminalization, missing terminal evidence, same-type new tabs, session restart/disappearance, capability/context/state mutation, writer insertion/restart/removal between checkpoints, source revision/digest changes, wrong actors/sources/epochs/K-328 bindings, partial chains, copied snapshots, stale CAS, unresolved operations, and arbitrary/forged manifests. No standalone boolean or string scheduler grants eligibility.

## Atomicity and current blockers

The model defines the required semantics but does not make current production storage eligible. A later reviewed implementation must place durable authority, admission/terminal evidence, source records, and source revision in one compatible transaction or provide an equivalent proven atomic protocol under the same physical lock. Current blockers remain:

- live Notes IDB snapshot writes clear and rewrite the store and update revision separately;
- localStorage remains an authoritative fallback and cannot join the IDB transaction;
- page/store callers can fire-and-forget persistence;
- storage events notify but do not serialize cross-tab writes;
- migration, embedded migration/restore, hydration, restore, reset, and cleanup paths are not registered/drain-aware;
- no production durable registry, checkpoint store, or epoch admission exists;
- K-328 has no production caller and must not accept unproven evidence;
- Web Locks/platform availability and crash/restart behavior require later real-browser validation;
- no user/operator drain UX or recovery procedure is implemented.

Therefore `NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE` remains mandatory.

## Validation and production reachability

The permanent suite covers authority substitution, canonical codecs, lifecycle, actor matrix, checkpoints, source evidence, CAS/epoch races, restart, partial graphs, and reducer-only commit. K-329B source imports only the pure SHA-256 helper. Static reachability checks show no production caller, storage upgrade, Notes writer modification, K-328 invocation, UI/network/worker hook, or activation path.

`K329B_REMAINS_PURE_MODEL_AND_DOCUMENTATION_ONLY`

Validation on the K-329B working tree before commit:

| Command | Result |
|---|---|
| `npm test -- --run src/lib/localDatabase/writerCoordinationEligibility` | 85 passed; 4.73 s |
| `npm test -- --run src/lib/localDatabase/crossContextHandoff` | 73 passed; 1.48 s |
| `npm test -- --run src/lib/localDatabase/crossContextSourceHandoffSpike.test.ts` | 391 passed; 2.16 s |
| `npm test -- --run src/lib/localDatabase/localFirstCutover.test.ts` | 77 passed; 2.68 s |
| `npm test -- --run src/lib/localDatabase/legacyNotesMigration.test.ts` | 150 passed; 2.39 s |
| `npm test -- --run src/lib/localDatabase/` | 1,064 passed; 5.79 s |
| `npm test -- --run src/lib/recovery` | 70 passed; 11.66 s |
| `npm run typecheck` | passed; 23.7 s |
| `npm run build` | passed; 12.63 s; existing mixed dynamic/static import and chunk-size warnings only |
| `git diff --check` | passed; line-ending conversion notices only |
| `npm test -- --maxWorkers=4` | 5,342 passed / 7 skipped; 181.07 s; no flakes observed |
