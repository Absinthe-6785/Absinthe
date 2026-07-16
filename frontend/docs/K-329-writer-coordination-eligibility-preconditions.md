# K-329 — Production Writer Coordination and Eligibility Preconditions

## Executive verdict

`WRITER_COORDINATION_ARCHITECTURE_SELECTED`

`SELECTED_ARCHITECTURE: WEB_LOCKS_PLUS_DURABLE_WRITER_REGISTRY_AND_EPOCH_ADMISSION`

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

The selected architecture combines the K-327 physical-source Web Lock with a durable IndexedDB writer registry, monotonic coordination epoch, durable admission/operation records, and an authoritative double-read. Messages and heartbeats are advisory only. Every source mutation must eventually validate its admission in the same authoritative IndexedDB transaction that commits the source revision. The current production writers do not do that, localStorage remains an authoritative fallback, and K-328 has no production adapter or caller. K-326G therefore remains fail-closed.

K-329 adds only a pure deterministic contract model, tests, and this document. It does not register a writer, open storage, mutate Notes, close admission, call K-328, or alter production runtime.

## Base and inspected scope

- Base/main: `f9e9d56217d19c219c35653ec2c7453fbf013788`.
- Branch: `codex/k329-writer-coordination-eligibility-preconditions`.
- K-320 through K-328 documents were read completely. No K-317 or K-319 incident document is present under `frontend/docs`; the merged K-319 contract was inspected in `recoverySafetyPolicy.ts` and its tests.
- The source audit searched `frontend/src`, `frontend/tests`, and `frontend/scripts` for localStorage, IndexedDB, Notes persistence, restore, sync, lifecycle, worker, and Web Locks operations.
- The audit inspected the actual functions and call sites below rather than inferring behavior from names.

## Current writer inventory

Stable IDs identify reviewed writer *types*, not ephemeral browser instances. One runtime instance later receives a separate random instance ID and session ID.

| Writer ID | File/function | Context | Physical source | Trigger | Mutation shape | Commit signal | Cross-context coordinated | Drainable | Known risk |
|---|---|---|---|---|---|---|---|---|---|
| `legacy.notes.local_snapshot` | `notePersistence.ts/saveNotesToLocalStorageResult`, `noteUtils.ts/saveNotes` fallback | page/window | localStorage `notes-v2` | any bridged page action | full-array replace | synchronous `setItem` return | no | no | production; no durable revision |
| `legacy.notes.idb_snapshot` | `noteIndexedDb.ts/saveNotesToIndexedDb` | page/window async task | `absinthe-notes-v1/notes` | persistence facade | `getAllKeys`, `clear`, then all `put`s | IDB `transaction.oncomplete`; later revision write separate | no | no | production; full-store rewrite and non-atomic revision |
| `legacy.notes.idb_delete` | `noteIndexedDb.ts/deleteNoteFromIndexedDb` | page/window async task | same IDB store | permanent delete facade | record delete | IDB `transaction.oncomplete` | no | no | production; recovery-blocked now |
| `legacy.notes.idb_clear` | `noteIndexedDb.ts/clearIndexedDbNotes` | page/window async task | same IDB store | reset/cleanup | full-store clear | IDB `transaction.oncomplete` | no | no | production destructive; recovery-blocked now |
| `legacy.notes.idb_metadata` | `markIndexedDbMigrationComplete`, `bumpNotesIndexedDbRevision` | page/window | localStorage migration/revision keys | after IDB work | scalar set | best-effort synchronous return, errors swallowed | no | no | production; cannot prove IDB commit binding |
| `legacy.notes.persistence_migration` | `notePersistence.ts/migrateLocalStorageNotesToIndexedDb` | startup page job | localStorage + legacy IDB | startup in every tab | merge/full replace, marker, remove | multiple independent completion points | no | no | production migration; partial commit/restart states |
| `legacy.notes.init_rescue_seed` | `notePersistence.ts/initNotesPersistence` | startup page job | localStorage or legacy IDB | hydration/startup | rescue merge or welcome full replace | returned promise after chosen path; fallback switches source | no | no | production; multi-tab fallback race |
| `legacy.notes.persistence_facade` | `notePersistence.ts/saveNotesAsync`, registered bridge | page/window async task | localStorage or legacy IDB | store mutation/fallback | full-array replace | promise exists but many callers discard it | no | no | production; fire-and-forget and authoritative fallback |
| `legacy.notes.store_actions` | `useNotesStore.ts/persistNotes` and mutation actions | React page/window | Notes snapshot | create/import/update/trash/restore/delete | full-array replace per entity action | sync result or unawaited promise | no | no | production; acknowledged UI state can precede durability |
| `legacy.notes.folder_metadata` | `noteUtils.ts/saveFolders`, `saveActiveNoteId` | page/window | `note-folders-v2`, `note-active-v2` | folder/navigation action | folder full replace/scalar set | synchronous localStorage return | no | no | production; folders are migration evidence, no shared revision |
| `legacy.notes.storage_migration` | `noteUtils.ts/migrateLegacyStorageIfNeeded` | synchronous page load | historical/current localStorage keys | first load | merge plus Notes/folder/active/marker writes | no aggregate atomic commit | no | no | production migration; every tab may enter |
| `legacy.notes.cross_tab_merge` | `useNotesStore.ts/applyStorageMerge` | storage-event page/background tab | Notes/folders and IDB revision | storage event | merge then source writeback | sync or unawaited promise | no; event is notification only | no | production stale-tab writer |
| `legacy.notes.remote_hydration_merge` | `useNotesStore.ts/hydrateFromDB` | authenticated page job | local Notes/folders | remote hydration | remote/local merge and local full replace | async function completion does not bind local write promise | no | no | production sync writer; K-319 disables now |
| `legacy.notes.restore_import` | `useVaultRestoreFlow.ts/confirmRestore`, store restore/undo | restore/import page job | Notes/folders + restore snapshot | user restore/import | selected merge/replace and fan-out | pipeline promise across many effects | no | no | production restore writer; K-319 disables now |
| `legacy.notes.reset_cleanup` | `resetAllNotes`, clear functions, `persistenceCleanup.ts` | page/startup cleanup | localStorage + legacy IDB | reset/startup cleanup | remove/clear/seed | multiple sync/async effects | no | no | production destructive writer; K-319 disables now |
| `legacy.notes.onboarding_marker` | `notesOnboarding.ts` marker functions | page/window | `notes-seeded-v1` | startup/seed | scalar set/remove | best-effort synchronous return | no | no | production authority-adjacent metadata |
| `legacy.notes.lifecycle_remote_flush` | store body timer, `pagehide`, `beforeunload` | timer/lifecycle page | remote API/in-memory pending map | debounce/navigation | remote mutation | best effort; navigation may terminate it | no | no | production remote writer; never quiescence proof |
| `legacy.notes.audit_k96b` | `k96bIndexedDbAudit.ts` | developer/audit page or test | default localStorage/legacy IDB | explicit audit | seed/clear/migrate | awaited calls vary | no | no | dev writer; must be unavailable or coordinated |
| `legacy.notes.audit_k96d` | `k96dPersistenceAudit.ts` | developer/audit page or test | injected/default storage + IDB | explicit audit | seed/migrate/clear | awaited calls vary | no | no | dev writer; default-storage mode is hazardous |
| `legacy.notes.audit_k97f` | `k97fSeedLifecycleAudit.ts` | developer/audit page or test | localStorage/legacy IDB | explicit lifecycle audit | seed/clear/marker | awaited calls vary | no | no | dev/test writer; production capability must be absent |
| `local_first.k325_migration` | `localDatabase/legacyNotesMigration.ts` | dormant repository API | `absinthe-local-v2` target | explicit capability only | target generation writes | local DB transaction completion | generation-coordinated, not legacy-source coordinated | outside legacy drain | dormant non-legacy-source writer |
| `local_first.k326_cutover` | `localFirstCutover.ts`, K-326 fence records | dormant capability | local-first metadata/fence | explicit capability only | activation metadata | reviewed transaction/fence settlement | not a legacy Notes source writer | outside legacy drain | dormant, no production caller |
| `handoff.k328_evidence` | `crossContextHandoff/*` | dormant injected-adapter job | separate handoff evidence DB | explicit caller only | authority/candidate evidence; source adapter read-only | strict IDB transaction completion | physical Web Lock inside K-328 | only its evidence operation | dormant; no application caller |
| `legacy.notes.readers` | `loadNotesFromIndexedDb`, K-325/K-328 adapters | page/dormant job | legacy sources | explicit read | none | read result only | not applicable | not applicable | read-only source, not a writer |

`COMPLETE_PRODUCTION_WRITER_INVENTORY_ESTABLISHED`

The source-grounded inventory is complete for reachable migration-critical Notes mutation boundaries at this base. Future code, dynamically injected scripts, extensions, compromised same-origin code, and unreviewed contexts remain outside the cooperative application boundary; any newly discovered writer forces `WRITER_INVENTORY_INCOMPLETE` or `UNKNOWN_WRITER_PRESENT`.

### Current hazards

- `saveNotesToIndexedDb` is a full clear-and-rewrite. Transaction completion is awaited, but the localStorage revision increment is a separate non-atomic write.
- `saveNotesAsync` can fall back from IndexedDB to authoritative localStorage.
- store callers commonly fire and forget the async persistence promise.
- `storage` events notify but do not serialize; the handler itself can rewrite the source.
- K-319's operation epoch is process-local. `mayWriteLegacyNotes` checks K-326 fences, not cross-tab admission. Recovery mode prevents known destructive/remote operations but still permits guarded legacy local persistence.
- `beforeunload`, `pagehide`, timers, and message delivery cannot prove durable completion.
- No production `BroadcastChannel`, SharedWorker, Service Worker, dedicated worker, or writer-facing `navigator.locks` path exists. K-328's Web Lock is dormant.

## Physical source inventory

Logical account identity is not part of physical exclusion identity. The physical K-327/K-328 digest remains the canonical origin, source family, combined backend, `absinthe-notes-v1`, `notes`, and version tuple.

| Container/state | Role now | Can become authoritative? | Coordination status | K-329 eligibility |
|---|---|---|---|---|
| `absinthe-notes-v1/notes` only | legacy live Notes records | yes, only after all writers use atomic epoch admission and migration metadata/folders needed for evidence are brought into the same durable authority | not wired | ineligible now |
| localStorage `notes-v2` only | legacy fallback payload | not as the final authoritative source; it cannot atomically couple admission and payload mutation | direct writers remain | permanently ineligible until reviewed conversion to IDB authority |
| mixed IDB + localStorage, equal | dual physical representation | one may be selected only by a reviewed conversion that makes localStorage non-authoritative | ambiguous dual writes | ineligible |
| mixed IDB + localStorage, divergent | conflicting representations | no automatic selection or merge | ambiguous | ineligible |
| partially migrated / stale marker | incomplete transition evidence | not without exact reconciliation | uncoordinated | ineligible |
| legacy planner/NoteView keys | historical inputs | preservation input only | direct synchronous migration exists | ineligible as authority |
| `absinthe-local-v2` generations | future local-first target | not a legacy source | K-321+ contracts | excluded from K-329 source selection |
| `absinthe-cross-context-handoff-v1` | K-328 authority/candidate evidence | evidence only | dormant K-328 | excluded as live source |
| vault snapshots/recovery exports/backups | preservation evidence | never silently substitutes for the live source | read-only tooling | ineligible as live authority |
| remote Supabase Notes | remote replica | not the local legacy physical source | remote guards | excluded from local source authority decision |
| unknown extra DB/profile/bucket/generation | unknown | no | unknown | `UNKNOWN_CONTEXT_PRESENT` |

## Mechanism comparison

| Mechanism | Cross-tab | Worker coverage | Crash durability | Missed-message safety | Support/constraints | Fail-closed result | Verdict |
|---|---|---|---|---|---|---|---|
| Web Locks only | cooperating same-bucket contexts | supporting workers | lock disappears on crash | yes for queued lock order, no durable writer graph | secure context/API required | cannot reconstruct drain | insufficient |
| Web Locks + BroadcastChannel | lock serializes; messages accelerate drain | participating workers | messages/acks are volatile | no | broad but lifecycle/throttling vary | missed ack ambiguous | advisory only |
| Web Locks + durable IDB registry | common physical lock plus durable registrations | every writer that is instrumented | registry survives restart | yes | IDB/Web Locks required | malformed/missing rows reject | necessary, not sufficient alone |
| durable epoch + admission tokens | source transaction fences stale writers | all instrumented source writers | durable | yes | requires authoritative IDB transaction | stale token rejects | necessary |
| Service Worker coordinator | only routed clients | service worker itself | event lifecycle, not complete authority | messages may be missed | control/activation timing varies | direct page writer bypass remains | rejected as authority |
| SharedWorker coordinator | connected same-origin clients | shared worker | lifetime tied to clients | disconnected clients ambiguous | platform support/lifecycle varies | direct page writer bypass remains | rejected as authority |
| in-memory counters / leader tab | one process only | no | none | no | universally easy | split brain | rejected |
| maintenance restart alone | operational request only | unknown | no proof of closed tabs/processes | no | user dependent | cannot prove absence | rejected |

Selected composition:

```text
physical-source Web Lock
+ durable IndexedDB coordination authority
+ exact reviewed writer-type set digest
+ durable writer registrations and drain acknowledgements
+ durable admission/in-flight records
+ monotonic epoch fencing in the authoritative source transaction
+ stable revision and digest reread
+ exact K-328 physical adapter binding
```

BroadcastChannel may improve UX but has no authority. Heartbeat/last-seen is diagnostic and timeout never removes a writer or grants eligibility.

## Writer identity contract

- `writerTypeId`: reviewed lowercase identifier matching `[a-z0-9][a-z0-9._:-]{0,159}`; stable across releases until its mutation contract changes.
- `writerId`: `writer-v1:<contextType>:<writerTypeId>:<32 lowercase hex random instance nonce>`; one browser context/job instance.
- `sessionId`: `writer-session-v1:<32 lowercase hex random nonce>`; regenerated on restart.
- `operationId`: `writer-operation-v1:<64 lowercase hex>`; digest-derived from protocol version, physical digest, writer/session, and an internal operation nonce.
- `idempotencyKey`: `writer-idempotency-v1:<64 lowercase hex>`; stable for an exact logical retry.
- `physicalSourceDigest`: full 64-character lowercase SHA-256 from K-327/K-328 physical identity; it contains no user ID.
- Every free identifier is at most 192 UTF-8 bytes. IDs contain no Note ID, title, body, account ID, token, or auth value.
- Random nonces are generated internally. A durable-key collision is idempotent only for exact canonical bytes and complete binding; otherwise it is corruption. No overwrite or repair is allowed.
- Wall-clock creation/heartbeat timestamps, when added later, are diagnostics only. Deterministic sequence and transition revisions drive authority.
- A restarted context has a new writer/session identity. Its old row remains evidence until durably disabled/fenced; heartbeat expiry cannot do that.

## Durable schema contracts

All records are strict own-data objects, canonical compact JSON encoded as UTF-8 byte format v1. Unknown/missing/extra/accessor/inherited fields, duplicate keys, noncanonical bytes, invalid UTF-8, unknown versions, and over-limit bytes reject without repair.

### Coordination authority — 4,096-byte ceiling

Exact fields:

```text
kind, schemaVersion, byteFormatVersion, physicalSourceDigest,
coordinationEpoch, state, coordinatorSessionId, expectedWriterSetDigest,
admissionOpen, unresolvedOperationCount,
sourceRevisionBefore, sourceRevisionAfter,
sourceDigestBefore, sourceDigestAfter,
transitionRevision, createdSequence, updatedSequence, failureCode
```

The authority is a singleton keyed by physical-source digest. `admissionOpen` is true only in `OPEN`. The transition revision is a monotonic CAS version. Epoch increments only after all epoch-E admitted operations are terminal, at the quiescent fencing transition.

### Writer registration — 4,096-byte ceiling per record

Exact fields:

```text
kind, schemaVersion, byteFormatVersion, physicalSourceDigest,
writerTypeId, writerId, sessionId, contextType, coordinationEpoch,
capabilities, registrationState, coordinated,
acknowledgedTransitionRevision, latestOperationId, lastSeenSequence
```

Capabilities are the sorted unique subset of `admission`, `drain_ack`, and `source_write`. States are `registered`, `drain_acknowledged`, or `disabled`. An acknowledgement is valid only for the exact authority transition revision.

### Admission/in-flight operation — 4,096-byte ceiling per record

Exact fields:

```text
kind, schemaVersion, byteFormatVersion, physicalSourceDigest,
operationId, idempotencyKey, writerTypeId, writerId, sessionId,
coordinationEpoch, admissionTransitionRevision, mutationType,
expectedSourceRevision, state, committedSourceRevision, terminalResult
```

`admitted` has no committed revision/result. `committed` has both a committed revision and `committed` result. `aborted`/`failed` have no committed revision and the matching terminal result. Ambiguous combinations reject.

### Eligibility evidence — 8,192-byte ceiling

Exact fields:

```text
kind, schemaVersion, byteFormatVersion, strategy,
physicalSourceDigest, coordinationEpoch, authoritativeSource,
writerSetDigest, stableRevision, stableSourceDigest,
authorityTransitionRevision, result
```

It contains no writer instance IDs or source payload. Its SHA-256 is returned as `evidenceDigest`. K-328 may be called only by a future reviewed runtime after rereading and validating this exact evidence and physical identity.

## Admission and drain protocol

### Normal write

1. Derive the physical-source lock name and acquire the exclusive K-327 Web Lock.
2. In one short authoritative IDB transaction, strictly read authority and registration; require state `OPEN`, admission open, current epoch, reviewed writer type, exact physical binding, and no conflicting idempotency record.
3. Add the durable `admitted` operation record. Reading `OPEN` outside this transaction grants nothing.
4. Perform the authoritative source mutation in a transaction that rereads the same authority/epoch and operation. The future production design must place source records, source revision, authority, and operation terminalization in compatible atomic scope.
5. Commit source mutation, monotonic source revision, and terminal operation evidence. Response loss after commit is an idempotent replay, not a second write.
6. Release the Web Lock. No network, UI wait, timer, or arbitrary callback occurs in the transaction.

Current localStorage payload writes cannot satisfy step 4 and must be removed as authoritative writers before eligibility.

### Drain and verification

1. Coordinator acquires the same physical-source Web Lock and rereads strict authority/registry.
2. CAS `OPEN -> DRAIN_REQUESTED` while atomically setting `admissionOpen=false`, recording writer-set digest and source revision/digest before drain. Epoch remains E so already-admitted E operations may finish.
3. Advisory drain messages may be sent. Each writer durably acknowledges the exact transition revision; missing messages/acks remain missing.
4. CAS `DRAIN_REQUESTED -> ADMISSION_CLOSED -> DRAINING`. New durable admission transactions now fail their state CAS.
5. Wait for all reviewed registrations to be durably acknowledged/disabled and all admitted operations to be terminal. A timer produces only `DRAIN_TIMEOUT_UNPROVEN`.
6. With zero unresolved operations, CAS to `QUIESCENT_CANDIDATE` and increment epoch E -> E+1. Old tokens cannot mutate because the authoritative source transaction requires the current epoch.
7. CAS to `VERIFYING_SOURCE`; capture authoritative revision/digest, reread registry/writer-set digest, then reread source revision/digest under the same physical coordination regime.
8. Require identical writer-set, revision, digest, ownership, generation, physical identity, supported source type, resource bounds, and exact K-328 adapter binding.
9. Emit canonical eligibility evidence. Only a later reviewed implementation may CAS `VERIFYING_SOURCE -> ELIGIBLE` and invoke K-328. K-329 does neither.

If coordinator crashes, durable state resumes without inferred transitions. `OPEN` admits normally; `DRAIN_REQUESTED`/`ADMISSION_CLOSED` resume exact drain; `DRAINING` retains unresolved rows; `QUIESCENT_CANDIDATE` repeats strict registry checks; `VERIFYING_SOURCE` repeats authoritative reads; terminal states never reopen. Unknown state is corruption.

## State machine

| State | Admission | Allowed next states | CAS/restart rule | K-328 capture |
|---|---|---|---|---|
| `OPEN` | open | `DRAIN_REQUESTED` | exact transition revision; drain CAS closes admission | forbidden |
| `DRAIN_REQUESTED` | closed; earlier tokens may finish | `ADMISSION_CLOSED`, `ABORTED`, `FAILED` | resume acknowledgement collection; no timeout inference | forbidden |
| `ADMISSION_CLOSED` | closed | `DRAINING`, `ABORTED`, `FAILED` | exact writer set and authority | forbidden |
| `DRAINING` | closed | `QUIESCENT_CANDIDATE`, `INELIGIBLE`, `FAILED` | zero unresolved operations and durable acks required | forbidden |
| `QUIESCENT_CANDIDATE` | closed, epoch fenced | `VERIFYING_SOURCE`, `INELIGIBLE`, `FAILED` | writer set stable; epoch E+1 | forbidden |
| `VERIFYING_SOURCE` | closed | `ELIGIBLE`, `INELIGIBLE`, `FAILED` | stable authoritative double-read and evidence CAS | only after external eligibility contract is implemented; not K-329 |
| `ELIGIBLE` | closed | none | terminal; exact evidence revalidation | potentially allowed by future task |
| `INELIGIBLE` | closed | none | terminal attempt; new attempt requires new authority session | forbidden |
| `ABORTED` | closed | none | no implicit reopen; separately reviewed restart required | forbidden |
| `FAILED` | closed | none | bounded failure evidence; no repair-on-read | forbidden |

The executable transition table rejects shortcuts such as `OPEN -> ELIGIBLE`, `ADMISSION_CLOSED -> ELIGIBLE`, and every terminal-state reopen.

## Authoritative-source resolution matrix

No timestamp-wins or automatic merge rule exists.

| Case | Authority | Eligible | Stable code | Required action |
|---|---|---:|---|---|
| IndexedDB only, exact/canonical/owned/bounded | IndexedDB candidate | only after all writer/epoch/stability conditions | otherwise the failing coordination code | instrument all writers and verify |
| localStorage only | none | no | `WRITER_NOT_COORDINATED` | preserve, then reviewed conversion to IDB authority |
| both present, byte-equivalent | none yet | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | reviewed de-authoritization/conversion |
| both present, divergent | none | no | `MIXED_SOURCE_DIVERGENCE` | preserve both; reviewed reconciliation |
| one malformed, one valid | none | no | `SOURCE_MALFORMED` | preserve and investigate; no fallback selection |
| one empty, one populated | none | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | prove migration history and reconcile |
| stale migration marker | none | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | validate actual containers, not marker |
| partial migration | none | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | reviewed reconciliation |
| newer localStorage / older IDB | none | no | `MIXED_SOURCE_DIVERGENCE` | timestamps are not authority |
| newer IDB / incomplete records | none | no | `SOURCE_MALFORMED` | preserve and investigate completeness |
| tombstone divergence | none | no | `MIXED_SOURCE_DIVERGENCE` | reviewed tombstone-aware reconciliation |
| ownership mismatch | none | no | `SOURCE_OWNERSHIP_UNPROVEN` | prove exact namespace/owner binding |
| generation mismatch | none | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | resolve generation authority explicitly |
| unknown extra database/container | none | no | `UNKNOWN_CONTEXT_PRESENT` | inventory and classify it |
| restored snapshot plus live source | live source remains unresolved | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | keep snapshot as preservation evidence only |
| source above resource bounds | none | no | `SOURCE_RESOURCE_BOUND_EXCEEDED` | separately reviewed bounded export path |

## Eligibility contract and matrix

Eligibility defaults to false. The pure evaluator grants only when every required predicate is true.

| Condition | Eligible | Code if false | Retryable | Required action |
|---|---:|---|---:|---|
| inventory complete | no | `WRITER_INVENTORY_INCOMPLETE` | no | review every production writer |
| no unknown writer/context | no | `UNKNOWN_WRITER_PRESENT` / `UNKNOWN_CONTEXT_PRESENT` | no | classify and coordinate/disable |
| every writer coordinated | no | `WRITER_NOT_COORDINATED` | no | route through durable admission |
| strict registration records | no | `WRITER_REGISTRATION_MALFORMED` | no | implementation correction; no repair |
| writer set unchanged | no | `WRITER_SET_CHANGED` | yes | restart drain |
| Web Locks/IDB supported | no | `COORDINATION_UNSUPPORTED` | no | supported secure environment |
| physical lock acquired | no | `COORDINATION_LOCK_UNAVAILABLE` | yes | retry; no steal/lease fallback |
| current epoch | no | `COORDINATION_EPOCH_STALE` | yes | discard stale token |
| admission durably closed | no | `ADMISSION_NOT_CLOSED` | yes | close by CAS |
| zero admitted operations | no | `IN_FLIGHT_WRITE_PRESENT` | yes | await durable terminal state |
| no ambiguous operation | no | `IN_FLIGHT_STATE_AMBIGUOUS` | no | separately reviewed resolution |
| every writer durably acknowledged | no | `DRAIN_TIMEOUT_UNPROVEN` | yes | collect acks; time is not proof |
| revision stable | no | `SOURCE_REVISION_UNSTABLE` | yes | repeat after quiescence |
| digest stable | no | `SOURCE_CHANGED_DURING_VERIFICATION` | yes | abort and repeat |
| one authoritative source | no | `AUTHORITATIVE_SOURCE_AMBIGUOUS` | no | reviewed source resolution |
| no mixed divergence | no | `MIXED_SOURCE_DIVERGENCE` | no | preserve and reconcile |
| exact ownership | no | `SOURCE_OWNERSHIP_UNPROVEN` | no | establish binding |
| canonical/bounded source | no | `SOURCE_MALFORMED` / `SOURCE_RESOURCE_BOUND_EXCEEDED` | no | preserve and investigate/export |
| no restore/import writer | no | `RESTORE_OR_IMPORT_ACTIVE` | yes | finish/abort durably |
| no sync hydration writer | no | `SYNC_WRITER_ACTIVE` | yes | finish/abort durably |
| K-328 adapter exists | no | `K328_ADAPTER_UNAVAILABLE` | no | implement/review exact adapter |
| K-328 physical identity matches | no | `K328_PHYSICAL_IDENTITY_MISMATCH` | no | correct binding |
| strict evidence/version | no | `ELIGIBILITY_EVIDENCE_CORRUPT` / `ELIGIBILITY_PROTOCOL_VERSION_UNSUPPORTED` | no | stop; reviewed migration only |

These stable codes are bounded and payload-free. They never include Notes, IDs, source JSON, user IDs, tokens, auth objects, stack traces, or raw browser errors.

## Observability contract

Future optional observer events:

```text
coordination_requested, lock_requested, lock_acquired,
epoch_created, admission_close_requested, admission_closed,
writer_registered, writer_drain_acknowledged,
in_flight_operation_observed, operation_terminal,
writer_set_changed, source_revision_captured, source_changed,
authoritative_source_selected, eligibility_granted,
eligibility_rejected, coordinator_aborted, coordinator_restarted
```

Each event must carry an effect class: `attempted`, `durably_committed`, `observed`, or `inferred`. It may carry bounded protocol/state/version/count/digest fields only. Message delivery is `observed`, never `durably_committed`. Observer failure is swallowed at the boundary and cannot change storage or protocol results.

## Deterministic evidence

`writerCoordinationEligibility.ts` is a pure model with no browser globals or side effects. `writerCoordinationEligibility.test.ts` uses explicit immutable snapshots; no sleeps, timers, message timing, or production integration.

Focused result: 64/64 passing scenarios:

| Category | Executions | Covered evidence |
|---|---:|---|
| Happy path/invariants | 4 | one/multiple writers, canonical evidence, default false |
| Admission/new-write races | 7 | two explicit scheduler orderings, post-close token, earlier admitted completion, stale token, debounce, restore/sync |
| In-flight/idempotency | 6 | missing ack/response, crash boundaries, idempotent retry, duplicate record |
| Writer-set changes | 6 | new tab, unknown worker, disappearance, restart, stale row, digest change |
| Coordinator restart | 4 | before/after close, during drain, before evidence commit |
| Source stability/ambiguity | 18 | revision/digest/malformed/bounds and required mixed-source cases |
| Corruption/byte boundaries | 6 | exact records, unknown version, duplicate key, invalid UTF-8, size, canonical bytes |
| State transitions | 13 | allowed chain and forbidden shortcuts/terminal reopening |

Executable invariants:

- eligibility implies durable admission closure;
- eligibility implies zero unresolved admitted operations;
- eligibility implies exact coordinated/disabled writer coverage and stable writer-set digest;
- eligibility implies stable source revision and digest;
- eligibility implies exactly one supported IndexedDB authority;
- evidence binds one physical digest and epoch;
- stale-epoch operations reject;
- missing durable acknowledgement never becomes success;
- timeout/message/heartbeat alone never proves absence;
- unknown writers/contexts and malformed evidence reject without repair;
- K-328 adapter identity must exactly match, but K-329 never calls it.

### Validation evidence

| Command | Result |
|---|---|
| `npm test -- --run src/lib/localDatabase/writerCoordinationEligibility.test.ts` | 64/64 passed |
| `npm test -- --run src/lib/localDatabase/crossContextHandoff` | 73/73 passed across 2 files |
| `npm test -- --run src/lib/localDatabase/crossContextSourceHandoffSpike.test.ts` | 391/391 passed |
| `npm test -- --run src/lib/localDatabase/localFirstCutover.test.ts` | 77/77 passed |
| `npm test -- --run src/lib/localDatabase/legacyNotesMigration.test.ts` | 150/150 passed |
| `npm test -- --run src/lib/localDatabase/` | 1,043/1,043 passed across 12 files |
| `npm test -- --run src/lib/recovery` | 70/70 passed across 2 files |
| `npm run typecheck` | passed |
| `npm run build` | passed; existing dynamic-import/chunk-size warnings only |
| first `npm test -- --maxWorkers=4` | 5,318 passed / 7 skipped; one unrelated K-320 ZIP-byte assertion crossed a one-second header boundary |
| `npm test -- --run src/lib/recoveryExportPackage.test.ts` | immediate diagnostic rerun 52/52 passed without source changes |
| pre-scheduler full rerun | 5,319 passed / 7 skipped across 581 passed / 1 skipped files |
| final `npm test -- --maxWorkers=4` | 5,321 passed / 7 skipped across 581 passed / 1 skipped files |
| `git diff --check` | passed |

The first full-suite failure and successful reruns are both retained here; no K-320 implementation was changed.

## Crash and restart semantics

| Boundary | Durable classification |
|---|---|
| writer disappears before registration commit | no registration/admission; cannot count as reviewed coverage until inventory proof still holds |
| writer disappears after registration, before operation | row remains; missing drain ack blocks; heartbeat timeout is diagnostic only |
| writer crashes after admission, before mutation | `admitted` remains and blocks |
| source commit and terminal operation commit atomic | terminal replay is idempotent even if response is lost |
| source commit without terminal evidence | protocol defect/ambiguous; blocks permanently pending reviewed resolution |
| coordinator crashes before close | `OPEN`; no eligibility attempt exists |
| after close/during drain | durable state resumes; admission stays closed |
| after quiescent epoch fence | old tokens fail current-epoch source transaction |
| during source verification | repeat exact writer/source reads |
| after verification before evidence commit | no eligibility exists; recompute deterministically |
| after evidence commit | reread/validate canonical evidence; never repair or infer |

## Browser and platform constraints

- Web Locks coordinate cooperating contexts in the same storage bucket and require a supported secure context. Unsupported or unavailable locks fail closed.
- BroadcastChannel delivery, storage events, tab visibility, lifecycle hooks, and worker messages are advisory.
- IndexedDB transactions provide the needed atomic authority only for stores in their fixed transaction scope. No crypto, network, UI, timer, or arbitrary await belongs inside the source transaction.
- Suspended/background/mobile tabs may delay acknowledgements indefinitely; delay never equals absence.
- Service/SharedWorker lifecycle does not prevent direct page storage writes and is not authority.
- Private browsing, storage partitioning/eviction, versionchange/blocked opens, process crash, and power loss require real-browser failure evidence in later implementation.
- K-328 collected Chrome Web Locks/IndexedDB evidence for its dormant evidence DB, not for production writer coordination. K-329 makes no cross-browser or production multi-tab claim.

## UX and operational prerequisites

A later production implementation needs a visible “preparing local data” maintenance state, explicit temporary write rejection (or a separately reviewed durable queue), cancel only before irreversible admission/fence boundaries, retry from durable state, conflicting-tab/restore/import/sync warnings, bounded timeout reporting that says proof is incomplete, and a K-320 export fallback. It must retain all legacy data and perform no cleanup until independent verification. Support diagnostics must be payload-free.

Users may be asked to keep tabs open to improve availability, but safety must not depend on following that instruction.

## Production implementation boundary

Defined in K-329:

- source-grounded writer and physical-source inventories;
- selected coordination architecture and rejection analysis;
- writer identity, admission, drain, restart, schema, error, eligibility, and observability contracts;
- authoritative-source resolution matrix;
- deterministic fail-closed model and tests.

Deferred:

- production writer instrumentation and removal of direct localStorage authority;
- durable registry/authority/operation object stores and additive upgrade;
- atomic source revision and admission validation in the authoritative IDB transaction;
- maintenance mode, cross-tab drain, real-browser integration/failure testing, and UX;
- production source adapter, eligibility activation, K-328 invocation, K-325 migration, K-326 cutover, cleanup, or network behavior.

The next implementation boundary is a dormant writer-registry and admission foundation. It must remain disabled and must not yet instrument existing writers or invoke K-328.

## Production dormancy audit

`K329_IS_DOCUMENTATION_AND_DETERMINISTIC_EVIDENCE_ONLY`

- The model file is imported only by its test.
- There is no startup, store, UI, worker, service-worker, timer, migration, restore, sync, or network caller.
- It does not import K-328 and cannot start capture.
- Current Notes writers and recovery policy are unchanged.
- K-326G production eligibility remains fail-closed.

## Rejected alternatives and residual blockers

Rejected: Web Locks alone, messages/heartbeats, localStorage leases, workers as authority, in-memory leaders/counters, fixed sleeps, lifecycle flush, and maintenance restart assumptions.

Residual blockers are implementation work, not uncertainty in the selected architecture:

1. every production/developer writer in the inventory still lacks durable admission;
2. authoritative localStorage fallback/direct payload and metadata writers remain;
3. source records/revision/authority/operation are not in one atomic production transaction;
4. no durable registry/epoch/ack storage exists;
5. no production K-328 adapter or eligibility consumer exists;
6. no real production writer drain, cross-browser, crash, quota, eviction, or mobile evidence exists;
7. no maintenance UX or operator protocol exists.

Therefore no current production source can be eligible, no K-328 capture may begin, and K-326G must not be weakened.

## Next action

`K-329 — Focused Architecture Review`
