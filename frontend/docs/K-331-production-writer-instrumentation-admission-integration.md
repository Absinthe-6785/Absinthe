# K-331 Production writer instrumentation and admission integration

## Executive verdict

**Confirmed source facts**

- The production Notes runtime updates Zustand memory first and then writes either the legacy
  `absinthe-notes-v1/notes` IndexedDB store or the `notes-v2` localStorage fallback.
- IndexedDB persistence is a full-store `clear()` plus `put()` transaction. The revision marker is a
  later localStorage write. The localStorage fallback is one synchronous full-array replacement.
- K-330 persists its complete coordination envelope in `absinthe-local-v2/writer_coordination_state`.
  That database is not the current Notes authority.
- Interactive actions, startup rescue/migration, hydration, restore, cross-tab merge, reset, and
  attachment conversion can all reach a Notes mutation. Several calls intentionally discard the
  persistence promise. Remote pushes/deletes are separate network effects.
- No production path imports the K-330 repository, invokes K-328, or calls `navigator.locks`.

**Selected architecture**

`PRODUCTION_WRITER_INSTRUMENTATION_AND_ADMISSION_CONTRACT_SELECTED`

`PRODUCTION_ADMISSION_REQUIRES_SOURCE_TRANSACTION_REARCHITECTURE`

`PRODUCTION_MUTATION_ATOMICITY_ARCHITECTURE_SELECTED: SOURCE_MIGRATION_PREREQUISITE`

`WRITER_REGISTRATION_TIMING_SELECTED: HYBRID`

`WEB_LOCKS_SERIALIZE_TRANSITIONS_BUT_DURABLE_REGISTRY_REMAINS_AUTHORITY`

`PRODUCTION_NOTES_WRITER_TOPOLOGY_IS_COMPLETE`

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

The future flow is:

```text
detached mutation request
  -> context compatibility check and lazy writer-session registration
  -> short exclusive coordination Web Lock
  -> K-330 durable admission CAS
  -> one authoritative IndexedDB transaction:
       revalidate admission + entity/tombstone mutation + outbox + source revision + terminal result
  -> K-330 checkpoint/evidence transition under fresh CAS
```

The current mixed source cannot safely execute that flow. K-330 admission in one database followed
by a legacy source write in another database or localStorage leaves an irreducibly ambiguous crash
window. Awaiting promises in order does not close it. Production admission therefore remains dormant
until the Notes authority and outbox/terminal evidence share one IndexedDB transaction domain. A
generic durable-intent reconciliation protocol is rejected because a missing terminal record cannot
prove whether a full-array localStorage or legacy IndexedDB replacement committed.

**Inferred requirement**: the K-329 reviewed manifest must receive a separately reviewed protocol
revision before production integration. Its physical writer types are useful audit categories, but
K-331 needs semantic operation kinds, context identity, protocol version, maintenance exclusivity,
and the startup D-day migration trigger. K-331 does not modify that frozen manifest.

**Unresolved owner decisions**: none for this architecture definition. Product behavior for a future
user-visible `COORDINATION_UNAVAILABLE` failure and operator UX for abandoned operations remain later
rollout decisions.

## Current production writer topology

The base contains 20 semantic production mutation paths and three physical source sinks. A semantic
writer owns user/maintenance intent; a sink must require an unforgeable admitted-operation token but
must not create a nested writer session. This avoids treating a shared persistence helper as authority
for the caller's semantics. The `K-329 type` column records the closest frozen predecessor entry; a
later reviewed manifest revision must preserve the distinctions below.

| Writer ID | Category | Entry point and caller/trigger | Source and storage | Transaction / async / cross-context | Registration | Admission and drain behavior | K-329 type |
|---|---|---|---|---|---|---|---|
| `notes.window.open_touch` | USER_INTERACTIVE_WRITER | `useNotesStore.setActiveNoteId`; note navigation | memory then full Notes persistence (`lastOpenedAt`) | memory + IDB/localStorage; IDB promise discarded | hybrid/lazy window session | `NOTE_TOUCH`; reject after closure; admitted work may finish | `legacy.notes.store_actions` |
| `notes.window.create_import_duplicate` | USER_INTERACTIVE_WRITER | `createNote`, `importNote`, `duplicateNote`; UI/import callers | memory, source snapshot, current direct remote POST | memory + local; network separate | hybrid/lazy | `NOTE_CREATE`/`NOTE_IMPORT`; premutation admission | `legacy.notes.store_actions` |
| `notes.window.update` | USER_INTERACTIVE_WRITER | `updateNote`, `toggleStar`, `deleteFolder` note moves; editor/planner/health/recipe/navigation helpers | memory, source snapshot, current remote POST | memory + local; body remote effect debounced | hybrid/lazy | `NOTE_UPDATE`; immutable operation ID per detached patch | `legacy.notes.store_actions` |
| `notes.window.tombstone_resurrect` | USER_INTERACTIVE_WRITER | `moveNoteToTrash`, `restoreNote` | memory, source snapshot, remote upsert | multi-boundary | hybrid/lazy | `NOTE_TOMBSTONE`/`NOTE_RESURRECT`; never exempt | `legacy.notes.store_actions` |
| `notes.window.physical_delete` | MAINTENANCE_WRITER | `deleteNotePermanently`, `emptyTrash`; explicit UI | memory/filter, source replacement, remote DELETE | local and network commits separate | lazy exclusive-capable session | `NOTE_PHYSICAL_DELETE`/`NOTE_BULK_DELETE`; disabled during drain/eligibility | `legacy.notes.idb_delete` / `store_actions` |
| `notes.window.retry_snapshot` | BACKGROUND_AUTOSAVE_WRITER | `retrySync`; user retry | rewrites current full local snapshot then remote retry | IDB promise awaited by callback chain; remote later | lazy window session | `SNAPSHOT_REPLACE_RETRY`; no blind replay after restart | `legacy.notes.persistence_facade` |
| `notes.window.body_remote_flush` | BACKGROUND_AUTOSAVE_WRITER | `scheduleBodySync`, `flushPendingSync`; timer/pagehide/beforeunload | remote replica only; local mutation already occurred in `updateNote` | in-memory map/timer; best-effort network | future remote-delivery session | no local-source admission exemption; future outbox delivery only; pause on drain | `legacy.notes.lifecycle_remote_flush` |
| `notes.window.cross_tab_idb_apply` | SYNC_APPLY_WRITER | `applyStorageMerge` for revision key; `storage` event | reloads IDB then replaces runtime memory | async stale-epoch check; no physical source write in this branch | lazy cross-context session | `CROSS_CONTEXT_APPLY`; must not seed a later unadmitted snapshot | `legacy.notes.cross_tab_merge` |
| `notes.window.cross_tab_local_merge` | SYNC_APPLY_WRITER | `applyStorageMerge` for `NOTES_KEY`; `storage` event | merged memory then full source replacement | synchronous localStorage or discarded IDB promise | lazy cross-context session | `CROSS_CONTEXT_MERGE`; pause/reject after drain | `legacy.notes.cross_tab_merge` |
| `notes.sync.remote_apply` | SYNC_APPLY_WRITER | `hydrateFromDB`; `AppContent` startup and recovery mode | remote delta merged into memory/source; may remote-delete expired tombstones and push dirty local rows | network + memory + local + more network | dedicated sync-hydration session | `REMOTE_APPLY`; pause before fetch/apply, discard stale response, never exempt | `legacy.notes.remote_hydration_merge` |
| `notes.restore.vault_apply` | RESTORE_IMPORT_WRITER | `importVaultRestore`; `useVaultRestoreFlow` | Notes/folders memory and full persistence, then remote fan-out | source and network not atomic | dedicated restore session | `RESTORE_APPLY`; exclusive maintenance epoch, ordinary writers drained | `legacy.notes.restore_import` |
| `notes.restore.vault_undo` | RECOVERY_WRITER | `undoLastVaultRestore`; explicit undo | snapshot to memory/source then remote fan-out | source, snapshot cleanup, remote separate | dedicated recovery session | `RESTORE_UNDO`; exclusive maintenance admission | `legacy.notes.restore_import` |
| `notes.migration.legacy_storage` | MIGRATION_WRITER | `migrateLegacyStorageIfNeeded`; `loadNotes/loadFolders/loadActiveNoteId` startup | historical localStorage keys -> `notes-v2`, folders, active ID, marker | several localStorage commits | dedicated migration session | `LEGACY_STORAGE_MIGRATE`; exclusive, resumable only from exact evidence | `legacy.notes.storage_migration` |
| `notes.migration.localstorage_to_idb` | MIGRATION_WRITER | `migrateLocalStorageNotesToIndexedDb`; `initNotesPersistence` | `notes-v2` + IDB -> IDB snapshot, then marker/key cleanup | IDB transaction plus later localStorage writes | dedicated migration session | `PERSISTENCE_MIGRATE`; exclusive; interruption remains blocking evidence | `legacy.notes.persistence_migration` |
| `notes.migration.dday` | MIGRATION_WRITER | `migrateLegacyDdays`; `AppContent` after hydrate | remote schedule rows -> `createNote`/`updateNote`, then remote schedule DELETE | repeated local snapshots and network calls | dedicated migration session | `DDAY_MIGRATE`; exclusive operation set; current frozen manifest needs revision | closest: `legacy.notes.store_actions` |
| `notes.startup.init_rescue_seed` | MIGRATION_WRITER | `initNotesStorage` -> `initNotesPersistence`; `AppContent` startup | rescue/seed/merge into IDB or localStorage and runtime memory | IDB/localStorage and memory; conditional full rewrite | startup migration session | `SOURCE_INIT_RESCUE`; first writer demand during startup | `legacy.notes.init_rescue_seed` |
| `notes.maintenance.reset` | MAINTENANCE_WRITER | `resetAllNotes`; Settings | removes/clears both stores, creates welcome Note, changes memory | multiple localStorage and IDB transactions; async clear not awaited | exclusive maintenance session | `SOURCE_RESET`; disabled for eligibility and recovery mode | `legacy.notes.reset_cleanup` |
| `notes.maintenance.cleanup` | MAINTENANCE_WRITER | `runPersistenceCleanup`; startup persistence init | may remove `notes-v2`/legacy keys after migration marker | localStorage removals outside IDB | exclusive maintenance session | `LEGACY_CLEANUP`; cannot overlap source verification | `legacy.notes.reset_cleanup` |
| `notes.maintenance.attachment_convert` | MAINTENANCE_WRITER | `migrateEmbeddedDataUrlsToAttachments`; explicit review panel | attachment stores then `updateNote` body/content | attachment DB + Notes source; awaited callback but cross-database | dedicated maintenance session | `ATTACHMENT_REFERENCE_MIGRATE`; exclusive; exact per-note admission | `legacy.notes.embedded_attachment_migration` |
| `notes.recovery.attachment_restore` | RECOVERY_WRITER | `restoreEmbeddedAttachmentMigrationBackup`; explicit confirmed restore | backup read/hash then `updateNote` | backup/local attachment evidence + Notes source | dedicated recovery session | `ATTACHMENT_REFERENCE_RESTORE`; exclusive; exact backup binding | `legacy.notes.embedded_attachment_restore` |
| `notes.sink.idb_snapshot` | physical sink, not a semantic session | `saveNotesToIndexedDb`; persistence facade | `absinthe-notes-v1/notes` | one clear-and-put IDB transaction; revision localStorage later | caller's session only | require admitted token inside transaction | `legacy.notes.idb_snapshot` |
| `notes.sink.local_snapshot` | physical sink, not a semantic session | `saveNotesToLocalStorageResult` / `saveNotes` fallback | `notes-v2` | one `setItem`; cannot join K-330 IDB | caller's session only | forbidden after future source migration | `legacy.notes.local_snapshot` |
| `notes.sink.idb_delete_clear` | physical sink, not a semantic session | `deleteNoteFromIndexedDb`, `clearIndexedDbNotes` | `absinthe-notes-v1/notes` | separate delete/clear transactions; revision later | caller's session only | require exclusive admitted token; disabled for eligibility | `legacy.notes.idb_delete` / `idb_clear` |

### Confirmed exclusions and non-writers

- `knowledgeIndexService`, active-note/folder scalar keys, onboarding/sync/revision markers, snapshots,
  and durability backups are derived/metadata/auxiliary stores, not the Notes authority. They do not
  authorize a source mutation.
- Current outbound POST/DELETE and the page-lifecycle flush mutate the remote replica, not local
  authority. Future delivery must consume a transactional outbox; it must not become proof of local
  commit.
- K-321 through K-326 local-first repositories, K-328 handoff, and K-330 coordination are dormant and
  have no production callers.
- `k96b`, `k96d`, and `k97f` audit surfaces resemble writers but are test/dev-only.
- No production dedicated/shared/service worker, service-worker Notes mutation, production K-322
  outbox enqueue/replay, logout/account-change Notes clear, conflict-resolution writer, or local-first
  generation initialization caller was found at this base. Their absence is part of the reviewed
  topology, not permission to add one without a manifest review.

## Writer classification contract

| Category | Register/session | Admission | Drain/restart | Evidence/eligibility |
|---|---|---|---|---|
| USER_INTERACTIVE_WRITER | context capability + lazy nontransferable session | every operation | no new operation after closure; admitted transaction may finish | cannot capture source evidence; participates only after full instrumentation |
| BACKGROUND_AUTOSAVE_WRITER | persistent for owning page lifecycle | timer/queue item must already have immutable admission | cancel unadmitted timer; terminalize admitted work; no timer replay | never inferred from timer disappearance |
| SYNC_APPLY_WRITER | dedicated sync session | each detached remote batch/tombstone | pause fetch/apply; stale response rejected; exact batch may resume only with durable evidence | cannot verify its own source |
| RESTORE_IMPORT_WRITER | dedicated exclusive maintenance session | exact plan/package operation set | ordinary/sync writers drained first; exact-session resume only | active/ambiguous restore blocks eligibility |
| MIGRATION_WRITER | dedicated exclusive session | each exact source/target step | resumable only from canonical progress evidence | active/ambiguous migration blocks eligibility |
| RECOVERY_WRITER | owner-authorized exclusive session | exact recovery plan | cannot silently normalize or compensate | cannot create eligibility evidence |
| MAINTENANCE_WRITER | exclusive session | every delete/reset/cleanup/convert | no coexistence with ordinary/sync; bounded abort | disabled during verification unless expressly reviewed |
| TEST_ONLY_WRITER | test context only | test capability | never production | excluded with proof |
| NON_WRITER_READER | none | none | read-only | cannot mutate or produce authority evidence |

## Writer identity, protocol, and capability contract

Writer coordination protocol `k331-writer-admission-v1` is separate from IndexedDB schema version.
Its canonical identity fields are:

```text
writerId                 writer-v2:<contextType>:<writerKind>:<random-128-bit>
writerSessionId          writer-session-v2:<random-128-bit>
writerKind               one reviewed semantic topology ID
contextId                context-v1:<random-128-bit>
contextType              WINDOW_FOREGROUND | WINDOW_BACKGROUND | DEDICATED_WORKER |
                         SHARED_WORKER | SERVICE_WORKER | MIGRATION_CONTEXT |
                         RECOVERY_CONTEXT | TEST_CONTEXT
namespaceFingerprint     canonical K-321 namespace digest; no raw user/project values
generationId             exact active/staged generation
coordinationEpoch        exact durable authority epoch
creationSequence         authority-issued safe integer (timestamps are diagnostic only)
applicationBuildId       reviewed bounded build identifier
protocolVersion          k331-writer-admission-v1
capabilities             sorted immutable reviewed set
sourceImplementationId   reviewed source adapter/version, never a display name
```

IDs are cryptographically random, generated by trusted coordination code, bounded, and persisted in
registration evidence. `contextId`, `writerId`, and `writerSessionId` are fresh after reload/crash;
they are not kept in sessionStorage, cloned, transferred, or reused across tab, namespace, generation,
epoch, build incompatibility, or browser restore. A restarted context creates a new identity and must
resolve or leave the old durable session as abandoned evidence. Display names and caller strings do
not contribute to any fingerprint.

Capabilities are immutable and admission-checked:

```text
CAN_CREATE, CAN_UPDATE, CAN_TOMBSTONE, CAN_PHYSICAL_DELETE, CAN_RESURRECT,
CAN_APPLY_REMOTE, CAN_RESTORE, CAN_MIGRATE, CAN_RECOVER, CAN_BULK_REPLACE,
CAN_WRITE_OUTBOX, CAN_CAPTURE_SOURCE_REVISION
```

Only capabilities enforceable at the semantic wrapper are retained. Callers cannot add capabilities;
the reviewed writer-kind table supplies them. Changing kind/capability/protocol creates a new session.
Mixed protocol versions cannot share an epoch. An older/newer build fails closed and requires a
reviewed protocol migration/new epoch.

`WRITER_IDENTITY_IS_CONTEXT_BOUND_GENERATION_BOUND_AND_NONTRANSFERABLE`

## Registration timing and lifecycle

`WRITER_REGISTRATION_TIMING_SELECTED: HYBRID`

A lightweight context compatibility record is established when the Notes runtime initializes so a
startup writer cannot mutate before compatibility is known. A durable semantic writer session is
created lazily at its first operation. An idle tab that never initializes Notes has no writer session;
startup init/hydration naturally demand their sessions immediately. This avoids pre-registering every
UI capability while closing the first-operation race under the same coordination lock/CAS.

| State | Initiator and durable transition | Mutation permission | Restart/invalid transition |
|---|---|---|---|
| `UNREGISTERED` | fresh context | none | register or fail `WRITER_NOT_REGISTERED` |
| `REGISTERING` | client acquires coordination lock; no durable state yet | none | crash leaves no registration |
| `REGISTERED_IDLE` | K-330 registration CAS | may seek admission | restart does not reuse session |
| `OPERATION_ADMITTED` | K-330 admission CAS | only exact operation may enter source tx | missing terminal remains unresolved |
| `OPERATION_IN_FLIGHT` | runtime-only view of admitted source transaction | exact operation only | durable state remains admitted until terminal evidence |
| `DRAIN_REQUESTED` | coordinator durable revision | no fresh semantic work should start; already admitted may resolve | exact drain revision required |
| `DRAINING` | all required acknowledgement/closure evidence | only terminalization/reconciliation | unknown operation blocks |
| `QUIESCENT` | zero unresolved operations plus exact acknowledgements; epoch fence | no mutation | source verification may begin |
| `CLOSED` | explicit clean session close before drain, if no operation | none | unload request is advisory; durable close CAS is authority |
| `ABANDONED` | owner/recovery classification from exact persisted evidence | none | never time-inferred into success |
| `REVOKED` | owner-authorized bounded administrative transition | none | cannot terminalize another session's operation |
| `STALE_EPOCH` | observed epoch mismatch | none | create a fresh session in the new epoch |

`beforeunload`, `pagehide`, visibility, heartbeat loss, and Web Lock release are never authoritative
deregistration. Time-only leases are rejected. Heartbeats may aid diagnosis, but only explicit close,
exact durable terminal evidence, or owner-authorized revocation changes lifecycle authority.

## Operation identity and admission boundary

Canonical operations contain:

```text
operationId, idempotencyKey, writerId, writerSessionId, writerKind,
operationKind, namespaceFingerprint, generationId, coordinationEpoch,
expectedSourceRevision, expectedAuthorityDigest, admissionRevision,
attemptNumber, causalPredecessorOperationId|null, protocolVersion
```

Operation kinds are `NOTE_TOUCH`, `NOTE_CREATE`, `NOTE_IMPORT`, `NOTE_UPDATE`, `NOTE_TOMBSTONE`,
`NOTE_RESURRECT`, `NOTE_PHYSICAL_DELETE`, `NOTE_BULK_DELETE`, `SNAPSHOT_REPLACE_RETRY`,
`CROSS_CONTEXT_APPLY`, `CROSS_CONTEXT_MERGE`, `REMOTE_APPLY`, `RESTORE_APPLY`, `RESTORE_UNDO`,
`LEGACY_STORAGE_MIGRATE`, `PERSISTENCE_MIGRATE`, `DDAY_MIGRATE`, `SOURCE_INIT_RESCUE`,
`SOURCE_RESET`, `LEGACY_CLEANUP`, `ATTACHMENT_REFERENCE_MIGRATE`, and
`ATTACHMENT_REFERENCE_RESTORE`.

Inputs are cloned, schema-validated, bounded, normalized only according to the Note schema, and hashed
before lock acquisition. Admission happens before memory state, source, outbox, marker, remote request,
or success UI changes. It binds exact session/generation/epoch/source revision/authority digest and is
invalid after drain closure or epoch transition. Exact same identity and canonical input is idempotent;
same ID with any different field fails. Attempts do not change operation identity. A retry either
reconciles the exact admitted record or creates a new causally linked operation after a proven abort.

Terminal states are `COMMITTED`, `ABORTED_BEFORE_SOURCE`, `FAILED_BEFORE_SOURCE`, and `AMBIGUOUS`.
Only the source-owning transaction may write `COMMITTED` with its new source revision. No caller may
claim commit from memory state, network status, or promise ordering.

`ALL_PRODUCTION_SOURCE_MUTATIONS_REQUIRE_PREMUTATION_OPERATION_ADMISSION`

## Source transaction and atomicity map

| Writer/path | Admission store | Source store | Outbox | Terminal evidence | Current atomicity | Gap |
|---|---|---|---|---|---|---|
| interactive/open/update/tombstone/delete | `absinthe-local-v2` | memory + `absinthe-notes-v1` or `notes-v2` | none in production | K-330 separate envelope | MEMORY_PLUS_INDEXEDDB / INDEXEDDB_PLUS_LOCALSTORAGE | admission, memory, source, remote effect cannot commit together |
| IDB full snapshot/delete/clear | `absinthe-local-v2` | `absinthe-notes-v1/notes` | none | different DB | CROSS_DATABASE | two independent IDB transactions; revision marker later |
| localStorage fallback | IndexedDB | `notes-v2` | none | IndexedDB | INDEXEDDB_PLUS_LOCALSTORAGE | no shared transaction or durable source revision |
| startup rescue/storage/IDB migration | IndexedDB | IDB + several localStorage keys | none | IndexedDB | INDEXEDDB_PLUS_LOCALSTORAGE | markers/removals and source commit can diverge |
| cross-tab merge | IndexedDB | memory + IDB/localStorage | none | IndexedDB | MEMORY_PLUS_INDEXEDDB | stale full-array snapshot and discarded promise |
| remote hydration/retry | IndexedDB | network + memory + IDB/localStorage | none | IndexedDB | NETWORK_PLUS_LOCAL | response/apply/push/delete are separate commits |
| restore/undo/reset | IndexedDB | memory + IDB/localStorage + snapshots/folders | none | IndexedDB | INDEXEDDB_PLUS_LOCALSTORAGE | destructive multi-store/multi-DB fan-out |
| attachment conversion/restore | IndexedDB | attachment DB/metadata + legacy Notes source | none | IndexedDB | CROSS_DATABASE | blob/reference and Note cannot commit together |
| D-day migration | IndexedDB | remote schedules + repeated legacy Notes snapshots | none | IndexedDB | NETWORK_PLUS_LOCAL | per-row create/update/delete has no atomic bundle |
| future local-first entity mutation | same `absinthe-local-v2` transaction | `entities`/tombstone | `outbox` | `writer_coordination_state` or transaction-bound receipt | ATOMIC_IN_ONE_INDEXEDDB_TRANSACTION | requires a new transaction-owning API; current repositories open private transactions |

The required future boundary owns one IndexedDB transaction over the active-generation entity store,
outbox, source-revision metadata, and transaction-bindable terminal receipt. It rereads the current
coordination envelope/admission or an immutable admission receipt inside that transaction. K-330's
current repository opens a private one-store transaction, so a later reviewed API must expose a safe
transaction-owning integration; merely calling it before and after the source repository is not atomic.

## Web Locks and durable registry responsibilities

Conceptual single lock name:

```text
absinthe:writer-coordination:v1:<namespaceFingerprint>:<generationId>
```

One exclusive lock serializes registration/admission CAS, drain/epoch transitions, and source
transaction entry validation. No per-writer/drain lock hierarchy is selected, avoiding ordering and
deadlock. Hold it only for the bounded authority transition and source transaction entry/commit—not
for network, user input, timers, remote fetches, or source verification scans. On acquisition, reread
K-330 and validate CAS; queued callers use bounded cancellation and never steal a lock.

Web Locks do not prove durability, liveness, source commit, tab closure, or writer disappearance.
Release/crash has no semantic effect on persisted evidence. K-330 remains authority across restart.
Unsupported/disabled/throwing Web Locks yields `WEB_LOCKS_UNAVAILABLE` and
`FAIL_CLOSED_NO_PRODUCTION_ADMISSION`; there is no local mutex fallback. A future single-context
fallback would require separately reviewed, durable proof that no second context can exist.

`NO_UNPROVEN_IN_MEMORY_LOCK_FALLBACK`

## Drain and in-flight policy

| Phase | Durable meaning | New operations | Existing operations / restart |
|---|---|---|---|
| `DRAIN_NOT_REQUESTED` | admission open at revision R | allowed under CAS | normal exact terminalization |
| `DRAIN_REQUESTED` | request revision D persisted | clients stop new intent; coordinator proceeds to closure | admitted operations may finish/abort |
| `NEW_ADMISSIONS_CLOSED` | admission-open=false at exact closure revision C | none; CAS makes this global | restart observes closed state |
| `IN_FLIGHT_OPERATIONS_RESOLVING` | unresolved set digest/count persisted | none | terminalize exact records or mark ambiguous |
| `ALL_OPERATIONS_TERMINAL` | unresolved count/digest exactly zero | none | canonical full graph round-trips |
| `WRITERS_QUIESCENT` | all required sessions acknowledge D and epoch advances | none | old epoch is permanently stale |
| `CHECKPOINT_CAPTURED` | immutable checkpoint chain binds graph | none | mutation invalidates verification |
| `SOURCE_EVIDENCE_COMMITTED` | stable source evidence and final checkpoint committed | none | only eligibility evaluation may follow |

`NO_NEW_OPERATION_CAN_BE_ADMITTED_AFTER_DRAIN_CLOSURE_REVISION`

An operation admitted before closure may complete only through its exact source transaction. It may
abort only with proof that source mutation never began. Compensation is not a terminal proof and is
not selected. Retry in a new epoch requires an exact prior abort; otherwise the operation is
`AMBIGUOUS`, remains durable, and blocks quiescence, source evidence, and eligibility. Drain
cancellation is allowed only before closure and with zero admitted operations; it aborts the authority
session and starts a new epoch rather than reopening the same revision. After closure, owner action is
required; evidence is never deleted.

`AMBIGUOUS_IN_FLIGHT_OPERATION_BLOCKS_DRAIN_COMPLETION_AND_ELIGIBILITY`

## Crash and restart matrix

| Crash point | Durable/source state | Restart classification | Automatic action | Owner action / eligibility |
|---|---|---|---|---|
| before registration commit | no session / unchanged | unregistered | create fresh session | none; not eligible until inventory complete |
| after registration commit | idle session / unchanged | abandoned candidate after new context appears | preserve old registration | close/revoke with evidence; blocks exact coverage meanwhile |
| before admission | no operation / unchanged | safe retry | reread CAS and retry | none |
| after admission, before source read | admitted / unchanged but not transaction-proven | unresolved | no replay | reconcile; blocks drain |
| after source read, before mutation | admitted / unchanged if transaction never wrote | unresolved | transaction aborts if open | prove abort or mark ambiguous |
| during one source transaction | admitted / old-or-new atomic source | unresolved terminal | inspect transaction-bound receipt | without receipt, ambiguous and blocking |
| after source commit, before terminal update in current mixed design | admitted / changed | ambiguous | none | source rearchitecture required; blocks eligibility |
| after atomic terminal/source commit | committed / changed | terminal | reread exact record | may checkpoint |
| after terminal, before checkpoint | terminal / stable | resumable | recapture next checkpoint under CAS | none |
| during drain | phase persisted / unchanged or exact terminals | resume phase | reread envelope | stale/ambiguous sessions block |
| after checkpoint 4 (before source capture) | chain through pre-verification | resumable verifier stage | repeat stable source observation | no eligibility yet |
| after source evidence/checkpoint 5, before checkpoint 6 | evidence + checkpoint 5 | resumable | validate graph/source then append checkpoint 6 | mismatch aborts |
| during eligibility attempt | old envelope or atomic eligible envelope | deterministic old/new | reread one envelope | no partial success |
| during epoch transition | old or new complete envelope | deterministic epoch | reread | old contexts stale if new won |
| stale tab resumes after epoch | old session/operation identity | `WRITER_STALE_EPOCH` | reject | fresh identity only; no inherited operation |

No unknown state is normalized to success. Current cross-database/localStorage paths specifically lack
the transaction-bound receipt needed to distinguish the source-commit crash, which is why activation
is blocked.

## Stale contexts, debounce, sync, and maintenance

- Reload, browser/process/OS crash, restored or cloned tabs, bfcache return, and duplicate tabs get a
  fresh context/session. They cannot claim the old session. A bfcache `pageshow` must reread protocol,
  epoch, generation, and admission state before any callback.
- Frozen/background/offline contexts retain no time-based authority. Epoch mismatch rejects their
  timers, queued closures, fetch responses, and persistence attempts when they resume.
- Old builds, service-worker updates, and mixed versions fail `UNSUPPORTED_PROTOCOL_VERSION`. No
  worker/service worker is admitted unless its exact context kind appears in the reviewed manifest.
- `pendingBodySync` owns only remote delivery data; the local `NOTE_UPDATE` must already be terminal.
  Future delivery uses immutable outbox IDs. Drain cancels unadmitted timers and pauses claiming;
  admitted local work resolves before acknowledgement. Timer firing cannot create admission.
- Remote apply uses a dedicated session/batch operation. Drain pauses fetch and apply. A response
  already in flight is detached and rejected if closure/epoch changed. Remote tombstones use the same
  operation. Remote delivery does not advance local source revision and cannot bypass the outbox.
- Restore, migration, recovery, reset, cleanup, and attachment conversion require exclusive
  maintenance admission, a dedicated epoch/session, ordinary and sync writers already drained, and
  exact plan/progress evidence. Partial progress resumes only when every committed step is
  unambiguous. Abort never deletes evidence.

`NO_DEBOUNCED_OR_DELAYED_CALLBACK_CAN_MUTATE_SOURCE_WITHOUT_A_CURRENT_ADMISSION`

`REMOTE_APPLY_IS_NOT_EXEMPT_FROM_WRITER_REGISTRATION_OR_OPERATION_ADMISSION`

`RESTORE_MIGRATION_AND_RECOVERY_REQUIRE_EXCLUSIVE_MAINTENANCE_ADMISSION`

## Stable error contract

| Error | Retryable | Exposure/action |
|---|---:|---|
| `WRITER_NOT_REGISTERED` | yes after registration | internal; register exact writer |
| `WRITER_SESSION_MISMATCH` | no for that session | internal; create fresh session |
| `WRITER_CAPABILITY_MISMATCH` | no | internal/security; source review required |
| `WRITER_STALE_EPOCH` | yes as fresh session | bounded user retry state |
| `DRAIN_IN_PROGRESS` | yes later | bounded user-visible read-only/retry state |
| `NEW_ADMISSIONS_CLOSED` | yes in later epoch | bounded user-visible retry state |
| `OPERATION_ALREADY_EXISTS` | exact retry only | internal idempotent result |
| `OPERATION_IDENTITY_MISMATCH` | no | internal/security stop |
| `OPERATION_NOT_ADMITTED` | no | internal defect; no mutation |
| `OPERATION_ALREADY_TERMINAL` | exact terminal retry only | internal idempotent result |
| `SOURCE_REVISION_MISMATCH` | yes after reread | bounded conflict UI |
| `AUTHORITY_DIGEST_MISMATCH` | yes after reread | internal CAS retry |
| `AMBIGUOUS_OPERATION_STATE` | no automatic retry | owner/recovery review; blocks eligibility |
| `COORDINATION_UNAVAILABLE` | bounded retry | user-visible unavailable state |
| `WEB_LOCKS_UNAVAILABLE` | no unsafe fallback | platform unsupported for admission/cutover |
| `UNSUPPORTED_PROTOCOL_VERSION` | no | reload/upgrade or reviewed migration |
| `MAINTENANCE_ADMISSION_EXCLUSIVE` | yes after maintenance | bounded busy state |
| `SYNC_APPLY_PAUSED` | yes after drain | internal sync pause |
| `SOURCE_TRANSACTION_REARCHITECTURE_REQUIRED` | no | implementation blocker |

Errors are stable codes plus bounded context enums only. No Note content, raw namespace/user values,
storage dumps, tokens, stack/cause, or browser exception messages are exposed.

## Future API and integration placement

The minimal future interface is explicit rather than a generic callback wrapper:

```ts
interface WriterCoordinationClient {
  establishContext(input: DetachedContextInput): Promise<CompatibleContext>;
  registerWriter(input: RegisterWriterInput): Promise<RegisteredWriterSession>;
  admitOperation(input: AdmitOperationInput): Promise<AdmittedOperation>;
  commitSourceMutation(input: TransactionBoundMutationInput): Promise<CommittedOperation>;
  abortBeforeSource(input: AbortOperationInput): Promise<TerminalOperation>;
  observeDrainState(input: BoundSessionInput): Promise<DrainState>;
  acknowledgeDrain(input: DrainAcknowledgementInput): Promise<void>;
  closeWriter(input: CloseWriterInput): Promise<void>;
}
```

Every input is detached/canonical/bounded. Registration/admission/drain/close acquire the one
coordination lock and use exact K-330 CAS. `commitSourceMutation` must own the entity/outbox/source
revision/terminal transaction; callers cannot supply a callback that escapes the transaction.
Registration, admission, completion, abort, and close are exact-idempotent. Caller obligations are to
stop on any error, retain the immutable operation ID, and never fall back to a direct source helper.

| Writer | Current function | Future wrapper location | Registration / admission | Source / terminal | Drain |
|---|---|---|---|---|---|
| interactive variants | `store/useNotesStore.ts` actions | new Notes mutation facade immediately before Zustand `set` | window session; semantic operation | local-first transaction API; terminal in same tx | reject new; finish exact admitted |
| body flush/retry | `useNotesStore.ts` timer/flush/retry | future outbox delivery facade | remote-delivery session; claim not source admission | outbox claim/ack only | pause claims; no timer flush |
| cross-tab | `useNotesStore.ts/applyStorageMerge` | cross-context apply facade | cross-context window session | local-first revision-aware tx | discard stale event/closure |
| remote apply | `useNotesStore.ts/hydrateFromDB` | sync apply facade after detached response validation | sync session; `REMOTE_APPLY` batch | local-first entity/outbox/source tx | pause/discard stale response |
| restore/undo | store restore functions and `useVaultRestoreFlow.ts` | exclusive maintenance facade | restore/recovery session | staged transactional restore APIs | requires prior drain |
| startup/init | `notePersistence.ts`, `noteUtils.ts`, `AppContent.tsx` | migration coordinator before any write | startup/migration session | reviewed source-migration tx | exclusive epoch |
| D-day migration | `lib/migrateLegacyDdays.ts` | migration facade around exact row set | migration session; one plan with child ops | local-first tx; remote deletion later via outbox/API | exclusive; resumable evidence |
| reset/cleanup | store reset and `persistenceCleanup.ts` | maintenance facade | maintenance session | reviewed destructive tx only | disabled for verification |
| attachment mutate/restore | attachment migration modules/review panel | attachment maintenance facade | maintenance/recovery session | transactionally bind Note reference or retain ambiguity | exclusive |
| physical sinks | `noteIndexedDb.ts`, `notePersistence.ts`, `noteUtils.ts` | replace with token-requiring source adapter; later remove fallback writes | never self-register | refuse without transaction-bound admission | no direct mutation |

## Deterministic evidence and production non-reachability

`frontend/src/lib/localDatabase/productionWriterAdmissionDefinition.test.ts` is test-only. It composes
the existing K-329 pure reducer/canonical codec rather than duplicating K-329 persistence or adding a
runtime client. It proves: two tab sessions, capability rejection, exact/conflicting duplicate
operation IDs, pre-drain completion, post-request admission rejection, durable unresolved restart,
ambiguous crash blocking, stale epoch rejection, Web Locks fail-closed, protocol mismatch,
maintenance exclusivity, and sync pause. It has no sleep, timing threshold, storage, network,
`navigator.locks`, K-328, or production import.

`K331_DETERMINISTIC_HARNESS_PROVES_ADMISSION_AND_DRAIN_CONTRACT`

The K-331 change contains only this test and this document. It adds no production module or import,
does not alter any writer, and does not make the test helper reachable from an application bundle.

`K331_HAS_NO_PRODUCTION_COORDINATION_CALLER_OR_RUNTIME_EFFECT`

- no production K-330 caller or writer registration;
- no production Web Locks call;
- no operation gating or user-write block;
- no source mutation/source-of-truth/startup/UI/sync/restore/migration/network change;
- no production K-328 invocation;
- no K-326 cutover activation and no K-326G change.

## Residual blockers and phased implementation

**Architecture blockers**

- The frozen K-329 manifest and protocol do not yet encode K-331 semantic writer kinds, context ID,
  protocol/build/source implementation, fine-grained capabilities, maintenance exclusivity, or the
  D-day migration trigger. A reviewed versioned extension is required; no in-place mutation.
- K-330 does not expose a transaction-owning source/outbox/terminal integration API.

**Source transaction blockers**

- Current authority is memory + a separate legacy IDB or localStorage fallback.
- Full-array replacement, marker/revision writes, remote effects, restore, attachment writes, and
  cleanup span transaction domains.
- The crash after source commit/before K-330 terminalization is not deterministically reconcilable.

**Production implementation blockers**

- No production client, Web Locks adapter, semantic writer facade, transactional source adapter,
  drain runtime, remote-apply pause, outbox delivery integration, or instrumentation coverage exists.
- Existing direct helpers accept no admitted-operation token.

**Browser/platform blockers**

- No real-browser evidence for Web Locks across tabs, crashes, bfcache, suspension, private mode,
  quota/eviction, workers, mobile, or mixed-version deployment.

**UX/operational blockers**

- No user/operator unavailable, drain, abandoned-operation, owner-revocation, maintenance, or
  protocol-upgrade workflow is approved.

Recommended sequence:

1. **K-332 — Dormant Writer Coordination Client Interface**: reviewed protocol/manifest v2, typed
   detached API, K-330 adapter, no callers or Web Locks.
2. **K-333 — Web Locks Coordination Adapter**: dormant capability-gated adapter, one lock name,
   ordering/error/platform tests, no Notes writers.
3. **K-334 — First Production Writer Instrumentation Slice**: one interactive path behind an
   unavailable-by-default capability; no source-of-truth switch.
4. **K-335 — Remaining Writer Instrumentation**: cross-tab, debounce, sync, restore, migration,
   recovery, maintenance, D-day, and attachment paths.
5. **K-336 — Drain and Quiescence Runtime**: observe real writers and prove closure, without
   eligibility activation.
6. **K-337 — Admission-to-Source Transaction Integration**: migrate authority into one transaction
   domain and prove crash/restart atomicity.
7. **K-338 — K-328 Consumer and Eligibility Evaluation**: only after complete instrumentation and
   browser evidence; K-326G remains fail-closed until exact prerequisites pass.

## Validation at the K-331 working head

| Check | Result |
|---|---|
| K-331 focused definition harness | 14 passed; 1 file; 1.05 s |
| K-330 dormant repository | 51 passed; 1 file; 8.58 s |
| K-329 eligibility model | 122 passed; 1 file; 8.78 s |
| K-328 cross-context handoff | 73 passed; 2 files; 1.29 s |
| K-327 source-handoff spike | 391 passed; 1 file; 2.27 s |
| K-326 local-first cutover | 78 passed; 1 file; 3.50 s |
| K-325 legacy Notes migration | 164 passed; 1 file; 2.64 s |
| all `localDatabase` | 1,181 passed; 14 files; 12.12 s |
| recovery | 70 passed; 2 files; 15.82 s |
| typecheck | passed |
| build | passed; 2,480 modules; 16.25 s; existing mixed-import/chunk-size warnings only |
| full frontend | 5,459 passed / 7 skipped; 583 passed / 1 skipped files; 206.99 s |

All final commands passed on their first final-sequence run. The focused K-331 test was also run once
before its final deterministic-encoding assertion was refined; neither run failed. No flakes or
failure-driven reruns occurred. `git diff --check` and final scope statistics are recorded at commit
time so the document does not claim a pre-staging result for untracked files.

## Non-goals

K-331 does not implement K-332 or later work, production coordination, Web Locks, source migration,
outbox delivery, sync changes, restore/migration execution, source eligibility, cutover, K-328
consumption, UI, startup hooks, network behavior, service workers, or recovery-policy bypasses.
