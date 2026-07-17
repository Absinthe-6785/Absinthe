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

`CANONICAL_LOCAL_FIRST_SOURCE_TRANSACTION_AUTHORITY_SELECTED`

`CANONICAL_SOURCE_DATABASE_SELECTED: ABSINTHE_LOCAL_V2`

`INDEXEDDB_IS_AUTHORITY_AND_ZUSTAND_IS_A_DERIVED_PROJECTION`

`TERMINAL_EVIDENCE_ARCHITECTURE_SELECTED: SOURCE_RECEIPT_RECONCILIATION`

`REPOSITORY_OWNED_RECEIPT_RECONCILIATION_SELECTED`

`EXISTING_GENERATION_SOURCE_AUTHORITY_BOOTSTRAP_SELECTED`

`SOURCE_REVISION_LINEAGE_ARCHITECTURE_SELECTED: APPEND_ONLY_RECEIPT_HASH_CHAIN`

`PER_ENTITY_SOURCE_REVISION_BINDING_REQUIRED`

`DELAYED_RECONCILIATION_USES_REVISION_AWARE_IMMUTABLE_EVIDENCE`

`CHUNKED_RESTORE_HAS_ORDERED_RECEIPTS_RESTART_CURSOR_AND_FINALIZATION_FENCE`

`PROTOCOL_EVOLUTION_PRECEDES_SOURCE_REPOSITORY_IMPLEMENTATION`

`CENTRAL_MUTATION_MANIFEST_IS_AUDIT_ONLY_AUTHORITY`

`WRITER_REGISTRATION_TIMING_SELECTED: HYBRID`

`WEB_LOCKS_SERIALIZE_TRANSITIONS_BUT_DURABLE_REGISTRY_REMAINS_AUTHORITY`

`PRODUCTION_NOTES_WRITER_TOPOLOGY_IS_COMPLETE`

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

The future flow is:

```text
detached mutation request
  -> transient context compatibility check
  -> short exclusive coordination Web Lock
  -> atomic K-330 first-writer registration + operation admission CAS
  -> one authoritative absinthe-local-v2 IndexedDB transaction:
       reread admission + validate revision + entity/tombstone mutation + outbox
       + source revision + immutable source transaction receipt
  -> idempotently reconcile the K-330 operation terminal projection from the receipt
  -> K-330 checkpoint/evidence transition under fresh CAS
```

The current mixed source cannot safely execute that flow. K-330 admission in one database followed
by a legacy source write in another database or localStorage leaves an irreducibly ambiguous crash
window. Awaiting promises in order does not close it. Production admission therefore remains dormant
until the Notes authority, outbox, revision, and source receipt share one IndexedDB transaction domain. A
generic durable-intent reconciliation protocol is rejected because a missing terminal record cannot
prove whether a full-array localStorage or legacy IndexedDB replacement committed.

**Selected future source architecture**: extend `absinthe-local-v2`, which already owns `entities`,
`outbox`, generations, and `writer_coordination_state`. Add source-authority metadata and immutable
source mutation receipts in a reviewed additive schema upgrade. The source transaction reads the
admitted operation from the coordination envelope in the same IndexedDB transaction, but writes the
receipt rather than rewriting the large K-330 envelope. If a crash occurs before terminalization,
the exact receipt deterministically reconciles the terminal projection without replaying the source.

**Inferred requirement**: source transaction authority and receipt semantics must be reviewed before
the K-329/K-330 protocol revision. That revision reuses existing writer type, context type,
capabilities, mutation type, identities, epoch, admission revision, expected source revision,
physical-source binding, manifest/digest fields, terminal state, drain state, and checkpoints. Only
the genuinely new bindings listed below may extend the canonical codec. K-331C does not implement
that schema or protocol revision.

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
| `notes.sink.idb_delete_clear` | physical sink category, not a semantic session | `clearIndexedDbNotes` is production-reachable through reset; `deleteNoteFromIndexedDb` is only behind the unreferenced `deleteNoteFromPersistence` facade | `absinthe-notes-v1/notes` | separate destructive transactions; revision later | reset caller's exclusive session; no production delete caller today | clear requires future exclusive maintenance admission; delete remains dormant/unreferenced | `legacy.notes.idb_clear`; `legacy.notes.idb_delete` remains disabled |

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

The 20-writer topology is an exact-base reviewed snapshot, not an automatically future-proof list.
The selected later drift guard is `CENTRAL_MANIFEST`: a versioned, reviewed static audit and admission
inventory. Each entry binds one stable manifest entry ID to a semantic writer kind, exact production
entry-point symbol/path, allowed mutation kinds, capabilities, physical sinks, maintenance/exclusive
classification, source implementation version, expected source transaction wrapper, and bounded
owner/review metadata. A production wrapper references exactly one entry ID; admission checks that the
registered writer capabilities permit it. The manifest never invokes functions, routes mutations,
selects source state, or overrides K-330/source authority. Static tests reject duplicate IDs, unknown
entry points, unmanifested instrumented wrappers, and capability/mutation mismatches. Manual source
audit remains required for a newly introduced bypass until stronger tooling exists. K-331B does not
add production markers, imports, dispatch, or routing.

`WRITER_TOPOLOGY_DRIFT_GUARD_STRATEGY_SELECTED: CENTRAL_MANIFEST`

`CENTRAL_MUTATION_MANIFEST_IS_AUDIT_ONLY_AUTHORITY_NOT_A_RUNTIME_ROUTER`

`IDB_CLEAR_IS_PRODUCTION_REACHABLE_WHILE_IDB_DELETE_FACADE_IS_CURRENTLY_DORMANT`

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

A transient context compatibility descriptor is computed when a future Notes runtime initializes. It
contains protocol version, build/source implementation ID, context type, supported writer kinds and
capabilities, and namespace/generation binding. It has no object-store record or durable key and is not
authority. The runtime-only lookup identity is the tuple
`[namespaceFingerprint, generationId, contextId]`; every authority-bearing field is copied into and
validated from the durable writer registration and operation instead.

The first mutation uses a future `REGISTER_AND_ADMIT_FIRST_OPERATION` K-330 action. One CAS transition
under the coordination lock validates the reviewed manifest and compatibility input, creates the fresh
writer/session registration, and admits the exact first operation in the same durable envelope. There
is no durable registered-idle boundary for the first write. A crash before commit leaves neither
record; a crash after commit leaves one admitted operation that can enter or exactly retry the source
transaction. Repeating the same registration/operation tuple returns the existing admitted result;
any changed identity, capability, digest, revision, or operation fails closed. No source or memory
mutation may begin until that transition commits.

Later operations reuse the exact live session and require an ordinary admission CAS. Reload, browser
restore, or process restart never reuses the transient descriptor, context ID, writer ID, or session.
An idle context has no durable registration. One context may host several semantic writer kinds, but
each kind has a separate immutable writer/session identity.

`FIRST_WRITE_PROTOCOL_SELECTED: ATOMIC_REGISTER_AND_ADMIT`

| State | Initiator and durable transition | Mutation permission | Restart/invalid transition |
|---|---|---|---|
| `UNREGISTERED` | fresh context | none | register or fail `WRITER_NOT_REGISTERED` |
| `REGISTERING` | future combined register/admit action is being prepared; no durable state yet | none | crash leaves no registration or admission |
| `REGISTERED_IDLE` | only after a previously admitted operation terminalizes; never the first-write commit boundary | may seek later admission | restart does not reuse session |
| `OPERATION_ADMITTED` | first write: combined registration/admission CAS; later writes: admission CAS | only exact operation may enter source tx | receipt absence means source-uncommitted; receipt presence is reconciled without replay |
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
or success UI changes. It binds exact session/generation/epoch/source revision/authority digest.
`REQUEST_DRAIN` closes only new admissions: an exact operation admitted before closure remains valid
for source commit or receipt reconciliation in the same generation and epoch. Only a committed epoch
transition normally invalidates the old admission, and that transition is prohibited while any
admitted operation remains unresolved. Exact same identity and canonical input is idempotent; same ID
with any different field fails. Attempts do not change operation identity. A retry either
reconciles the exact admitted record or creates a new causally linked operation after a proven abort.

The existing K-329 operation states remain `admitted`, `committed`, `aborted`, and `failed`; K-331B
does not add an `AMBIGUOUS` terminal state. An admitted record remains unresolved until exact source
evidence exists. The future source transaction writes an immutable committed receipt; the coordination
repository may then project `committed` only after verifying that receipt. Proven pre-source abort or
failure may use the existing terminal states. Any contradictory durable graph is corruption, not a
normal terminal state. No caller may claim commit from memory, network status, or promise ordering.

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

## K-331A canonical source transaction architecture

### Canonical database decision

| Option | Decision | Reason |
|---|---|---|
| extend `absinthe-local-v2` | selected | `entities`, tombstones, outbox, generations, and K-330 coordination already share one IndexedDB transaction domain; an additive upgrade can add revision/receipt stores without moving authority |
| separate canonical Notes database | rejected | admission validation and source receipt would cross database boundaries and recreate the crash ambiguity |
| move or mirror K-330 authority | rejected | creates dual-authority/migration risk without an atomicity benefit because the coordination store is already in `absinthe-local-v2` |

`CANONICAL_SOURCE_DATABASE_SELECTED: ABSINTHE_LOCAL_V2`

The additive schema is future work. It must preserve every K-321 through K-330 record and must not
open, migrate, or delete the legacy Notes source until a separately reviewed migration task.

### Minimal source store map

| Store | Key | Authority | Mutation transaction | Migration source / digest role |
|---|---|---|---|---|
| `database_meta` | `namespaceKey` | active generation and schema compatibility | read/validate | existing K-321; active-generation fence |
| `generations` | `[namespaceKey, generationId]` | generation status | read/validate | existing K-321; rejects stale/inactive generation |
| `entities` | `[namespaceKey, generationId, domain, entityId]` | canonical Note/folder envelope, including active/tombstone fields | read/write | existing K-321/K-325 staged data; entity/result digest input |
| `outbox` | `[namespaceKey, generationId, mutationId]` | durable remote-delivery intent | write exactly once | existing K-322; mutation ID/digest bound into receipt |
| `source_authority` | `[namespaceKey, generationId]` | current canonical source revision, complete authority digest, receipt-chain head digest, bootstrap digest, and implementation/protocol binding | read/write once per mutation | new additive store; current-state authority plus append-only lineage head |
| `source_mutation_receipts` | `[namespaceKey, generationId, operationId]` | immutable proof of exact local source commit and one hash-chain link | read/add | new additive store; previous/committed revision, previous/new chain digest, committed authority digest, receipt digest, and exact-retry authority |
| `writer_coordination_state` | existing K-330 physical-source/generation key | admitted operation and later terminal projection | read during source tx; later K-330 CAS writes terminal | existing K-330; admission and authority digest validation |
| `attachment_state` | `[namespaceKey, generationId, attachmentId]` | attachment metadata only | only when a reviewed Note metadata mutation requires it | existing K-321; never proves blob existence |

No new `notes` or `note_tombstones` store is selected: `entities` with `domain='notes'` already stores
the payload envelope and explicit tombstone fields. Folders use `domain='folders'`; a note move and any
folder mutation that must be invariant together are one bulk source transaction with one revision and
receipt. Attachment blobs remain outside this database. A Note may commit a bounded attachment
reference/metadata intent, but the receipt must declare `attachmentBlobAtomicity='not_claimed'` and
must never assert that a separate blob write committed.

### Transaction owner and memory authority

The future `LocalFirstSourceTransactionAuthority.commitMutation` is the only boundary allowed to own
canonical mutation. It opens one strict read-write transaction across metadata, generations, entities,
outbox, source authority, source receipts, and the coordination state needed for admission validation.
It controls this sequence:

1. read and validate active namespace/generation and source implementation;
2. decode the current K-330 envelope and verify the immutable admission receipt/operation;
3. read the global source revision and affected entity envelopes;
4. validate expected source/entity revisions, capability, mutation kind, input digest, and no prior
   conflicting receipt;
5. apply active entity/tombstone/folder changes;
6. add exactly one outbox record for each canonical remote mutation in the bounded operation;
7. increment the global source revision once;
8. add one immutable source mutation receipt binding the entire write set and outbox-set digest;
9. commit or abort every write together.

The source receipt is the terminal local outcome. K-330's `committed` operation is a later idempotent
coordination projection of that outcome. Callers cannot separately write entities/outbox/revision,
claim success, bypass revision validation, or reuse an admission for another digest. On any validation,
request, quota, abort, or commit error, the transaction aborts and Zustand is not updated.

IndexedDB becomes authority and Zustand becomes a post-commit projection. A later UI task may add an
optimistic visual overlay, but it must be tagged with the exact operation and prior revision, cannot be
read as authority, and must disappear/reconcile from the committed IndexedDB result. Restart always
reconstructs from IndexedDB.

`SOURCE_TRANSACTION_OWNER_EXCLUSIVELY_CONTROLS_ENTITY_OUTBOX_REVISION_AND_RECEIPT`

`INDEXEDDB_IS_AUTHORITY_AND_ZUSTAND_IS_A_DERIVED_PROJECTION`

### Source revision contract

The namespace/generation source revision is a canonical nonnegative ASCII decimal string with at most
16 digits: exactly `0` or a nonzero digit followed only by ASCII digits. A strict decoder rejects an
empty value, whitespace, signs, leading zeroes, decimals, exponent notation, non-ASCII digits,
non-string values, and out-of-range length **before** calling `BigInt`. It is compared and incremented
with exact decimal-string/BigInt logic, never converted to a JavaScript `number`. Decoder failures map
to a bounded persisted-corruption code without preserving the rejected value. Revision exhaustion
fails closed before writes. One successful source transaction,
including a bounded bulk mutation, increments it exactly once. Abort, validation failure, and exact
receipt retry do not increment it. The previous and committed values are stored in the source receipt,
every outbox record for the operation, and the later K-330 terminal projection. Restart reads the same
`source_authority` record; timestamps do not affect ordering.

An existing populated generation has no implicit revision. Before its first source-authority mutation,
an exclusive maintenance/bootstrap transaction must verify the exact active namespace and generation,
complete canonical entity set, generation manifest/schema, aggregate entity-state digest, and bounded
outbox/checkpoint baseline. It then creates revision `"0"`, bound to that verified snapshot and source
implementation/protocol. Revision zero is evidence of the preexisting snapshot, not a semantic
mutation; the first ordinary transaction advances it to `"1"`.

`SOURCE_REVISION_IS_MONOTONIC_TRANSACTION_BOUND_AND_RESTART_STABLE`

`SOURCE_REVISION_IS_STRICTLY_DECODED_BEFORE_BIGINT_CONVERSION`

`MALFORMED_SOURCE_REVISION_DECODES_TO_BOUNDED_CORRUPTION`

`SOURCE_AUTHORITY_REVISION_ZERO_BINDS_TO_A_VERIFIED_EXISTING_GENERATION_SNAPSHOT`

### Source transaction receipt

The immutable receipt contains only bounded identity/evidence metadata:

```text
receiptVersion, namespaceFingerprint, generationId, coordinationEpoch,
operationId, writerTypeId, writerId, writerSessionId, semanticMutationKind,
previousSourceRevision, committedSourceRevision, affectedEntitySetDigest,
affectedEntityCount, outboxMutationSetDigest, outboxMutationCount,
canonicalMutationInputDigest, committedResultDigest, admissionReceiptDigest,
protocolVersion, sourceImplementationId, commitSequence,
attachmentBlobAtomicity='not_claimed', receiptDigest
```

`receiptDigest` hashes a fixed-order canonical encoding of all preceding fields. Entity/outbox set
digests hash sorted bounded identities and per-record digests, not Note bodies, titles, attachment
content, raw user/project identifiers, or auth data. `commitSequence` is the committed source revision;
wall-clock time may be diagnostic outside the authority digest but is not commit proof.

Each receipt also forms one immutable source-revision lineage link. The link binds
`previousSourceRevision`, `committedSourceRevision`, `previousChainDigest`, `receiptDigest`,
`committedAuthorityDigest`, and the resulting `chainDigest`. The `source_authority` row advances the
current revision, current complete-authority digest, and chain-head digest in the same source
transaction. No later transaction rewrites or deletes an earlier receipt. A chain from a historical
receipt to the current authority must contain every consecutive revision exactly once; a gap,
duplicate, fork, broken digest link, decreasing revision, or receipt/authority mismatch is corruption.

The receipt binds the immutable outbox delivery **intent**: mutation identity, semantic operation,
entity identity, payload/result digest, base/local revision, and idempotency identity. Later delivery
status, attempt count, lease, retry time, and remote acknowledgement are mutable delivery state and are
not re-hashed as if they were the original source commit. Reconciliation verifies the immutable intent
projection and may observe any valid later delivery status.

`SOURCE_TRANSACTION_RECEIPT_PROVES_LOCAL_COMMIT_WITHOUT_EXPOSING_USER_CONTENT`

`SOURCE_REVISION_LINEAGE_IS_APPEND_ONLY_AND_RECEIPT_VERIFIABLE`

`RECONCILIATION_VERIFIES_IMMUTABLE_OUTBOX_INTENT_NOT_LATEST_DELIVERY_STATUS`

### Admission handoff and terminal reconciliation

The admission receipt is an immutable canonical view of the admitted K-330 operation:

```text
namespaceFingerprint, generationId, coordinationEpoch,
writerTypeId, writerId, writerSessionId, operationId, semanticMutationKind,
expectedSourceRevision, admissionTransitionRevision, authorityDigest,
capabilityDigest, canonicalMutationInputDigest, protocolVersion,
sourceImplementationId, admissionReceiptDigest
```

The source transaction rereads `writer_coordination_state` and rejects a stale epoch, generation,
operation, writer/session, mutation kind, expected revision, capability/input digest, protocol, source
implementation, terminal operation, or previously consumed admission with a conflicting receipt.

After source commit, the future repository-owned action
`RECONCILE_COMMITTED_SOURCE_RECEIPT` projects the exact receipt into K-330. It is not ordinary
`TERMINALIZE_OPERATION`, does not run as the original browser writer/session, and cannot weaken or
transfer that identity. A caller supplies only bounded lookup identity:

```ts
interface ReconcileCommittedSourceReceiptInput {
  namespaceFingerprint: string;
  generationId: string;
  operationId: string;
}
```

The durable coordination/source repository opens one `absinthe-local-v2` transaction and rereads
`writer_coordination_state`, `source_mutation_receipts`, `source_authority`, active generation
metadata, the bounded affected entity rows/digest source, and relevant outbox rows/digest source. It
derives every receipt/action field from these reads. It verifies the original admitted operation,
namespace, generation, epoch, writer/session identity, admission digest, receipt digest, committed
revision, source authority, entity/outbox evidence, and current terminal state. No caller-supplied
receipt, result, revision, digest, writer/session identity, or terminal truth is accepted.

Revision verification proves that the receipt's previous-to-committed transition is exactly one and
belongs to the persisted append-only source-authority/receipt hash chain. The current global revision
may be greater when a later independent transaction committed before reconciliation; it must never be
lower than the receipt revision. The repository walks or verifies a bounded indexed chain proof from
the target receipt to the current chain head. It therefore does not incorrectly reject an older valid
receipt merely because source authority advanced through later immutable receipts.

Per-entity evidence is revision-scoped. Every canonical entity envelope must bind
`createdSourceRevision`, `lastMutatedSourceRevision`, and, for a tombstone, `deletedSourceRevision`.
Reconciliation directly compares the entity/result digest from receipt revision R only if the entity's
current `lastMutatedSourceRevision` is R. If it is later than R, the later state is valid only when the
receipt chain proves each intervening source transaction and its committed authority digest. It is not
compared to R as though no later mutation occurred. A lower entity revision, missing chain link, or
unexplained state remains corruption.

Concretely, operation O5 may commit receipt R5 while changing entity A at revision 5, and operation O6
may later commit R6 while changing A again at revision 6. If R5's K-330 terminal projection is still
missing, R5 remains reconcilable: the repository proves R5, the immutable outbox intent, and the
R5-to-R6 chain. It does not require A's revision-6 row to equal R5's revision-5 result digest. The same
rule covers a later tombstone or explicit resurrection when its later receipt lineage is valid.

The action is repository-recovery authority with a distinct discriminator; its canonical codec and
K-330 envelope version are future K-333 work. The reducer precondition is one exact admitted operation
plus one valid immutable success receipt in the same generation/epoch. It may write only the K-330
envelope, changing that operation from admitted to committed and binding the committed revision and
receipt digest. Source authority, receipt, entities, outbox, and checkpoint remain read-only; receipt
deletion and source replay are impossible. Exact committed state with the same digest/revision returns
idempotent success. A different terminal, missing receipt, unknown operation, stale epoch, malformed
record, or mismatched evidence fails closed without normalization.

A committed success receipt permanently forbids later failure or abort terminalization. Before the
receipt exists, the original writer/session may terminalize failure only from proven source noncommit.
After it exists, only exact repository-owned success reconciliation is legal. A racing failure action
must reread the receipt in its K-330 transaction: whichever transaction commits first is observed by
the other; receipt plus failure is corruption, never last-write-wins. Timeout, context loss, and remote
delivery failure do not prove local source failure.

`ADMISSION_RECEIPT_IS_SINGLE_OPERATION_BOUND_AND_SOURCE_TRANSACTION_VERIFIABLE`

`TERMINAL_EVIDENCE_ARCHITECTURE_SELECTED: SOURCE_RECEIPT_RECONCILIATION`

`REPOSITORY_OWNED_RECEIPT_RECONCILIATION_SELECTED`

`RECONCILIATION_AUTHORITY_IS_REPOSITORY_OWNED_NOT_WRITER_SESSION_OWNED`

`RECONCILIATION_REREADS_ALL_AUTHORITY_AND_ACCEPTS_NO_CALLER_SUPPLIED_TRUTH`

`RECEIPT_BACKED_RECONCILIATION_HAS_ONE_SUCCESS_AUTHORITY_AND_FAILS_CLOSED`

`RECONCILIATION_ACTION_DOES_NOT_WEAKEN_NONTRANSFERABLE_WRITER_IDENTITY`

`COMMITTED_SOURCE_RECEIPT_PREVENTS_FAILURE_OR_ABORT_TERMINALIZATION`

`RECONCILIATION_IS_A_READ_AUTHORITY_AND_K330_PROJECTION_TRANSACTION_ONLY`

`A_VALID_OLD_RECEIPT_REMAINS_RECONCILABLE_AFTER_LATER_VALID_SOURCE_TRANSACTIONS`

`DELAYED_RECONCILIATION_VERIFIES_RECEIPT_LINEAGE_NOT_LATEST_ENTITY_EQUALITY`

`ENTITY_EVIDENCE_COMPARISON_IS_REVISION_SCOPED_NOT_LATEST_STATE_SCOPED`

`PER_ENTITY_SOURCE_REVISION_BINDING_REQUIRED`

`SOURCE_AUTHORITY_BINDS_CURRENT_STATE_AND_APPEND_ONLY_RECEIPT_LINEAGE`

`RECONCILIATION_DISTINGUISHES_VALID_LATER_MUTATION_FROM_LINEAGE_CORRUPTION`

### Retry and crash/restart matrix

| Admission | Source receipt | Entity revision | Outbox | K-330 terminal | Classification | Automatic action |
|---|---|---|---|---|---|---|
| absent | absent | unchanged | absent | absent | no operation | none |
| present | absent | unchanged | absent | absent | admitted, source-uncommitted | retry the exact source transaction or prove pre-source abort; never create a new identity blindly |
| present | present | advanced exactly | complete matching set | absent | committed, terminal projection pending | verify receipt and idempotently terminalize K-330; no source replay |
| present | present | advanced exactly | complete matching set | exact committed | committed | return the existing receipt |
| present | absent | unchanged | absent | committed | corrupt persisted graph | fail closed; block drain and eligibility |
| absent/unknown | present | advanced or unknown | present/unknown | any | receipt for unknown/unadmitted operation | fail closed; no adoption |
| present | present | advanced | missing/mismatched | any | corrupt source transaction graph | fail closed; no repair |
| present | absent | advanced | absent/present | any | bypass/corruption | fail closed; legacy writer evidence required |
| present | absent | unchanged | present | any | corrupt source transaction graph | fail closed; no remote delivery |

The same operation ID plus identical writer/session, expected revision, mutation kind, canonical input,
admission digest, and source implementation returns the existing receipt without writes. Any mismatch
returns `OPERATION_IDENTITY_MISMATCH` or an exact equivalent. Exact retry never increments revision or
adds outbox records. A new operation after an unknown network outcome is permitted only after the local
receipt/terminal state of the prior operation is known; remote retry keeps the original outbox identity.

`EXACT_RETRY_RETURNS_THE_EXISTING_RECEIPT_WITHOUT_REAPPLYING_SOURCE_MUTATION`

`SOURCE_RECEIPT_RECONCILIATION_HAS_NO_AMBIGUOUS_SUCCESS_STATE`

### K-331B receipt reconciliation cases and stable errors

| Case | Authoritative graph | Repository action |
|---|---|---|
| A | receipt present; exact operation admitted; terminal absent | verify the complete read set and project exact terminal success; never replay source |
| B | exact terminal success already binds the same receipt/revision | return idempotent success; do not rewrite unrelated state |
| C | failure/abort terminal plus committed success receipt | `RECONCILIATION_TERMINAL_CONFLICT`; corruption; block drain and eligibility |
| D | receipt absent | `RECONCILIATION_RECEIPT_NOT_FOUND`; success projection forbidden |
| E | receipt belongs to unknown/unadmitted operation | `RECONCILIATION_OPERATION_NOT_ADMITTED`; corruption; no adoption |
| F | malformed receipt or K-330 state | `RECONCILIATION_CORRUPT_PERSISTED_STATE`; no repair or normalization |

| Stable error | Retry / classification | Exposure/action |
|---|---|---|
| `RECONCILIATION_RECEIPT_NOT_FOUND` | non-retryable success request; source retry only after separate proof | internal; never terminalize success |
| `RECONCILIATION_OPERATION_NOT_ADMITTED` | non-retryable corruption | owner intervention; no adoption |
| `RECONCILIATION_RECEIPT_DIGEST_MISMATCH` | non-retryable corruption | owner intervention; block eligibility |
| `RECONCILIATION_SOURCE_REVISION_MISMATCH` | reread once; mismatch remains corruption | internal/owner review |
| `RECONCILIATION_TERMINAL_CONFLICT` | non-retryable corruption | owner intervention; block drain/eligibility |
| `RECONCILIATION_ALREADY_APPLIED` | exact retry only | internal idempotent result |
| `RECONCILIATION_STALE_EPOCH` | no retry in old epoch | bounded stale-context result |
| `RECONCILIATION_CORRUPT_PERSISTED_STATE` | non-retryable corruption | bounded code; no raw payload |
| `SOURCE_AUTHORITY_NOT_BOOTSTRAPPED` | retry after exclusive bootstrap | internal implementation blocker |
| `SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT` | non-retryable corruption | owner intervention; no overwrite |
| `SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT` | retry only after a newly proven closed/quiescent boundary | bounded internal blocker; no bootstrap write |
| `SOURCE_AUTHORITY_BOOTSTRAP_SESSION_CONFLICT` | retry only after conflicting owner/session resolves | bounded internal blocker; no authority adoption |
| `SOURCE_AUTHORITY_BOOTSTRAP_CORRUPT_PERSISTED_STATE` | non-retryable corruption | bounded decoder/record reason only; block eligibility |
| `SOURCE_REVISION_NOT_STRING` / `NON_CANONICAL` / `OUT_OF_RANGE` | internal total-decoder result | mapped to boundary corruption; rejected value never exposed |

All contexts are bounded enums/identities already represented by digests. No error contains raw user
content, storage payload, auth data, stack/cause, or browser exception text.

### K-331B drain-aware admission validity

The source transaction selection remains `BOTH`: it receives an immutable bounded admission handle
and rereads the authoritative K-330 envelope. The handle binds namespace, generation, epoch,
writer/session, operation ID, semantic mutation kind, expected source revision, admission revision,
and capability/input digest. The envelope reread proves that the exact operation remains admitted,
nonterminal, same-generation, same-epoch, and identity/digest compatible. It does **not** require
global `admissionOpen=true` for an operation admitted before drain closure.

| Admission timing | Drain state | Epoch state | Operation/receipt | Source action |
|---|---|---|---|---|
| before drain | open | same epoch | unresolved; no receipt | commit exact source transaction allowed |
| before drain | requested/closed | same epoch | unresolved; no receipt | commit exact source transaction allowed |
| after closure | requested/closed | same epoch | no admission | reject `NEW_ADMISSIONS_CLOSED` |
| before drain | quiescent | same epoch | terminal | no further mutation; `OPERATION_ALREADY_TERMINAL` |
| before drain | any | epoch advanced | unresolved/stale | reject `WRITER_STALE_EPOCH` |
| exact retry | requested/closed | same epoch | receipt exists | return receipt or reconcile only; no source replay |
| stale tab | any | epoch mismatch | any | reject `WRITER_STALE_EPOCH` |

Unresolved admitted operations block quiescence and therefore prevent epoch transition. Once the epoch
transition commits, every prior-epoch handle is stale. Closure alone never revokes an existing exact
admission. The reconciliation action follows the same epoch rule and cannot revive stale work.

`SOURCE_TRANSACTION_ADMISSION_VALIDATION_SELECTED: BOTH`

`SOURCE_COMMIT_VALIDATES_EXACT_ADMITTED_OPERATION_NOT_GLOBAL_ADMISSION_OPENNESS`

`DRAIN_CLOSURE_BLOCKS_NEW_ADMISSIONS_BUT_DOES_NOT_REVOKE_EXISTING_ADMISSIONS`

`PRE_DRAIN_ADMITTED_OPERATIONS_REMAIN_VALID_UNTIL_TERMINAL_OR_EPOCH_TRANSITION`

`EPOCH_TRANSITION_IS_THE_ONLY_NORMAL_FENCE_FOR_PREVIOUS_EPOCH_ADMISSIONS`

### K-331C complete revision-zero source-authority bootstrap

Bootstrap runs before the first ordinary source-authority mutation and only while an exclusive
maintenance/migration owner blocks ordinary writers. Inside one `absinthe-local-v2` transaction it:

1. rereads and validates the namespace, exact active generation, existing `source_authority` row (if
   any), source implementation, database and schema versions, generation manifest, and exclusive
   maintenance owner;
2. proves the coordination boundary is quiescent with `admissionOpen=false`, every writer terminal or
   quiescent, `admittedOperationCount=0`, `unresolvedOperationCount=0`, no in-flight source commit, no
   pending receipt reconciliation, no epoch transition in progress, and the exact coordination
   epoch/state digest; admission stays closed for the entire transaction;
3. rejects any active/conflicting restore, migration, recovery, cleanup, cutover, or other maintenance
   session rather than guessing which actor is authoritative;
4. reads the complete active-generation entity authority: Notes/entities, folders, tombstones, and
   normalized relation evidence, with fixed-order counts and aggregate digests;
5. reads all generation-scoped `attachment_state` metadata and binds its count/digest. The inspected
   `AttachmentStateRecord` authority fields are namespace/generation, attachment ID, `referencedBy`,
   local/remote availability, checksum state, sync state, storage-locator reference, and created/updated
   timestamps. The current type has no size, MIME, provider, or recoverability fields, so the contract
   does not invent them. Blob bytes, cache bytes, and provider payloads remain external and the evidence
   states `attachmentBlobAtomicity='not_claimed'`;
6. reads and binds the complete existing outbox count/immutable-intent digest, checkpoint digest,
   active-generation record, generation manifest, and source protocol/implementation identifiers;
7. builds one fixed-order revision-zero evidence value containing authority-record version, physical
   database name, namespace fingerprint/key digest (the physical row key remains the canonical
   namespace key), generation, active status, schema/protocol/implementation versions, explicit
   Note/folder/tombstone/relation counts and relationship digest, aggregate entity evidence,
   attachment/outbox counts and digests, checkpoint count/version/digest, coordination
   epoch/quiescence proof, session-conflict booleans, bootstrap method version, and the final bootstrap
   evidence digest;
8. adds exactly one `source_authority` record or aborts the whole transaction.

Revision `"0"` represents the verified preexisting snapshot. Bootstrap creates no ordinary operation
receipt, writer/session/operation identity, upload outbox entry, remote mutation, or user-visible
mutation. Its canonical bootstrap evidence digest lives in `source_authority`; it is evidence, not a
semantic source change. The first ordinary committed mutation advances `"0"` to `"1"`.

Crash before transaction commit leaves no authority row and retry rereads the complete snapshot.
Crash after commit finds the exact row and returns idempotent success. An existing row with the exact
bootstrap evidence digest is an exact retry; any mismatch is `SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT`.
The retry compares the complete canonical evidence, not only its claimed digest. A different entity,
folder, tombstone, relation, attachment metadata record, outbox intent, checkpoint, manifest,
generation, namespace, protocol, implementation, coordination epoch/state, or bootstrap method cannot
rebind revision zero. Exclusive ownership, zero admitted/unresolved operations, and all-source rereads
prevent concurrent source change; any changed evidence aborts. A later bypass that changes authority
without the required revision/receipt progression causes graph verification to fail and blocks
eligibility.

`EXISTING_GENERATION_SOURCE_AUTHORITY_BOOTSTRAP_SELECTED`

`SOURCE_AUTHORITY_REVISION_ZERO_BINDS_TO_A_VERIFIED_EXISTING_GENERATION_SNAPSHOT`

`SOURCE_AUTHORITY_BOOTSTRAP_IS_EVIDENCE_NOT_AN_ORDINARY_MUTATION`

`SOURCE_AUTHORITY_BOOTSTRAP_IS_ATOMIC_IDEMPOTENT_AND_EXCLUSIVE`

`REVISION_ZERO_BINDS_COMPLETE_GENERATION_AUTHORITY_AND_QUIESCENCE`

`BOOTSTRAP_REQUIRES_ZERO_ADMITTED_ZERO_UNRESOLVED_AND_QUIESCENT_COORDINATION`

`ATTACHMENT_METADATA_IS_SOURCE_AUTHORITY_WHILE_BLOB_BYTES_REMAIN_EXTERNAL`

`BOOTSTRAP_READS_COMPLETE_AUTHORITY_AND_WRITES_ONLY_REVISION_ZERO_EVIDENCE`

`SOURCE_AUTHORITY_REVISION_ZERO_PROVES_COMPLETE_CONTENT_FREE_BOOTSTRAP_EVIDENCE`

`REVISION_ZERO_CANNOT_BE_REBOUND_TO_A_DIFFERENT_GENERATION_SNAPSHOT`

`REVISION_ZERO_BINDS_NOTES_FOLDERS_TOMBSTONES_ATTACHMENTS_OUTBOX_AND_CHECKPOINTS`

The current K-321 repository can write `attachment_state` in a standalone active-generation
transaction and does not advance a source revision because the K-331 source authority is not
implemented. Under the selected future contract, any canonical metadata change affecting ownership,
references, availability, integrity, recoverability, remote locator identity, or sync intent must go
through the source transaction owner and advance the global revision, whether or not a Note entity also
changes. Attachment conversion/restore must use the same authority boundary; its current split legacy
transactions are not admissible proof. Timestamp changes are authority-bearing only when the canonical
metadata record truly changes, never as a touch-only side effect.

### K-331C chunked restore revision lineage

A restore too large for one bounded transaction is an exclusive maintenance sequence, never an
implicit multi-transaction success. Its immutable plan binds the restore session, namespace,
generation, base source revision, ordered chunk count, and ordered input digests. Admission remains
closed and eligibility remains false until exact finalization.

Each chunk is one ordinary source-authority transaction and therefore advances the global source
revision exactly once. Its immutable receipt additionally binds restore session, zero-based chunk
index, preceding chunk-receipt digest, previous/committed source revisions, chunk input/result digest,
affected entity-set digest, attachment-metadata digest, and immutable outbox-intent digest. Chunk N is
legal only after receipt N-1, with consecutive revision and digest links. Exact same-input retry returns
the existing receipt without a write or revision increment; conflicting retry, skipped index, chain
fork, or changed plan is corruption.

The durable restart cursor is derived from the longest verified contiguous receipt prefix, not trusted
as a free-standing mutable integer. Restart revalidates the ordered chain from the plan/base revision
before admitting the next chunk. Cancellation or failure after a partial prefix retains those receipts
as committed source history; it never normalizes the generation to complete, rewinds source revision,
or makes it eligible.

After all planned chunks commit, a final read-only verification computes the complete authority digest
and exact ordered chain head. The final restore manifest records session, base/final committed
revisions, ordered chain digest, complete entity count/digest, attachment metadata count/digest,
outbox immutable-intent count/digest, checkpoint digest, protocol version, completion state, and
complete authority digest. It is evidence-only: creating it does not mutate an
entity/outbox/checkpoint and does not increment source revision. Missing chunks, digest mismatch, an
active conflicting session, or changed authority prevents finalization and therefore eligibility.
Planned, in-progress, interrupted, verifying, finalization-pending, cancelled-after-partial, and
corrupt sessions are all ineligible. Eligibility may proceed only after the final manifest commits,
the complete digest still matches current authority, coordination is quiescent with no unresolved
operation, and the session is terminal complete.

`RESTORE_CHUNKS_FORM_AN_ORDERED_HASH_CHAIN_WITH_EXACT_RETRY`

`RESTORE_RESTART_CURSOR_IS_DERIVED_FROM_DURABLE_CHUNK_RECEIPTS`

`RESTORE_FINAL_MANIFEST_IS_EVIDENCE_ONLY_AND_DOES_NOT_INCREMENT_SOURCE_REVISION`

`ELIGIBILITY_REMAINS_BLOCKED_UNTIL_EXACT_RESTORE_FINALIZATION`

`PARTIAL_RESTORE_NEVER_NORMALIZES_TO_COMPLETE_OR_ELIGIBLE`

### Global revision rules

| Change class | Revision behavior | Outbox/receipt behavior |
|---|---|---|
| ordinary local mutation | increment once per atomic transaction | exact upload outbox set plus one source receipt |
| remote apply | increment once per atomic apply transaction | no upload echo for the same remote mutation; checkpoint may commit atomically; one source receipt |
| bounded bulk mutation | increment once for the whole atomic bounded affected set | affected-set digest binds all changes; one receipt |
| restore | one increment for a proven bounded atomic restore; otherwise exactly one increment per committed ordered chunk | immutable chunk receipts form a source-revision hash chain; final manifest is evidence-only and does not increment |
| later migration | each explicit source-changing transaction increments once and has reviewed receipt semantics | no implicit multi-transaction success |
| bootstrap | revision `"0"`; no increment because it records a verified existing snapshot | bootstrap evidence only; no ordinary receipt/outbox |

`ALL_CANONICAL_SOURCE_CHANGES_ADVANCE_ONE_GLOBAL_GENERATION_REVISION_BY_TRANSACTION`

### Local and remote terminality

The local transaction commits source state and outbox only. Remote delivery is asynchronous and uses
the immutable outbox/idempotency identity. Remote success/failure cannot change whether the local
mutation committed. Delayed responses revalidate generation and epoch before any separate local
follow-up. Writer drain requires local admitted operations to have receipts and terminal projections;
it does not require every outbox record to be remotely acknowledged. Remote-delivery drain/quiescence
is a separate later policy and cannot be used as local source evidence.

`LOCAL_SOURCE_COMMIT_AND_REMOTE_DELIVERY_HAVE_SEPARATE_EXPLICIT_TERMINALITY`

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
| `REQUEST_DRAIN_AND_CLOSE_NEW_ADMISSIONS` | `REQUEST_DRAIN` atomically persists `DRAIN_REQUESTED`, `admissionOpen=false`, and request revision D | none after D; CAS makes this global | admitted operations may finish or reconcile; restart observes the closed state |
| `IN_FLIGHT_OPERATIONS_RESOLVING` | unresolved set digest/count persisted | none | terminalize exact records or mark ambiguous |
| `ALL_OPERATIONS_TERMINAL` | unresolved count/digest exactly zero | none | canonical full graph round-trips |
| `WRITERS_QUIESCENT` | all required sessions acknowledge D and epoch advances | none | old epoch is permanently stale |
| `CHECKPOINT_5_AND_SOURCE_EVIDENCE_COMMITTED` | one `CAPTURE_SOURCE_EVIDENCE` reducer transition stores source evidence and checkpoint 5 together | none | no durable checkpoint-5-without-evidence state exists |
| `ELIGIBILITY_EVIDENCE_PENDING` | checkpoint 6/eligibility commit has not yet completed | none | exact graph/evidence revalidation only |

`REQUEST_DRAIN_IS_THE_DURABLE_ADMISSION_CLOSURE_LINEARIZATION_POINT`

`CLOSE_ADMISSION` remains the later lifecycle transition after exact acknowledgements; it is not the
initial closure and must not be presented as creating a second admission boundary.

An operation admitted before closure may complete only through its exact source transaction. It may
abort only with proof that source mutation never began. Compensation is not a terminal proof and is
not selected. Retry in a new epoch requires an exact prior abort; otherwise the operation is
unresolved, remains durable, and blocks quiescence, source evidence, and eligibility. Drain
cancellation is allowed only before closure and with zero admitted operations; it aborts the authority
session and starts a new epoch rather than reopening the same revision. After closure, owner action is
required; evidence is never deleted.

`AMBIGUOUS_IN_FLIGHT_OPERATION_BLOCKS_DRAIN_COMPLETION_AND_ELIGIBILITY`

## Crash and restart matrix

| Crash point | Durable/source state | Restart classification | Automatic action | Owner action / eligibility |
|---|---|---|---|---|
| before atomic first register/admit commit | no session/operation; unchanged | unregistered | retry the exact combined transition | none; not eligible until inventory complete |
| after atomic first register/admit commit | registration plus admitted operation; source unchanged | admitted, source-uncommitted | exact source transaction may run/retry | blocks drain until receipt or proven abort |
| before later admission | existing idle session; no operation | safe retry | reread CAS and retry | none |
| after admission, before source read | admitted; receipt absent; source unchanged | admitted, source-uncommitted | exact source transaction may run/retry | blocks drain |
| after source read, before mutation commit | admitted; transaction aborts old or commits complete new state | source-uncommitted if receipt absent | exact retry only after reread | contradictory graph is corruption |
| during one source transaction | old graph or entity/outbox/revision/receipt all committed | deterministic old/new | receipt absence permits exact retry; receipt presence forbids replay | no ambiguous success |
| after source receipt commit, before K-330 terminal projection | receipt/entity/outbox committed; operation still admitted | committed, projection pending | verify receipt and terminalize K-330 | no source replay; blocks drain only until projection |
| after receipt and K-330 terminal | exact committed graph | terminal | return existing receipt | may checkpoint |
| after terminal, before checkpoint | terminal / stable | resumable | recapture next checkpoint under CAS | none |
| during drain | phase persisted / unchanged or exact terminals | resume phase | reread envelope | stale/ambiguous sessions block |
| after checkpoint 4 (before source capture) | chain through pre-verification | resumable verifier stage | repeat stable source observation | no eligibility yet |
| after source evidence/checkpoint 5, before checkpoint 6 | evidence + checkpoint 5 | resumable | validate graph/source then append checkpoint 6 | mismatch aborts |
| during eligibility attempt | old envelope or atomic eligible envelope | deterministic old/new | reread one envelope | no partial success |
| during epoch transition | old or new complete envelope | deterministic epoch | reread | old contexts stale if new won |
| stale tab resumes after epoch | old session/operation identity | `WRITER_STALE_EPOCH` | reject | fresh identity only; no inherited operation |

No unknown state is normalized to success. Checkpoint 5 cannot exist without source evidence because
`CAPTURE_SOURCE_EVIDENCE` writes both in one K-329 reducer transition. The selected receipt architecture
makes a receipt-present/terminal-absent restart deterministic, but current cross-database/localStorage
paths produce no such receipt and remain ineligible until separately migrated.

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

## Future source authority and integration placement

The source transaction authority is defined before, and separately from, any production-facing
coordination client. This is a conceptual responsibility boundary, not an implemented interface:

```ts
interface LocalFirstSourceTransactionAuthority {
  commitMutation(input: DetachedAdmittedMutationInput): Promise<CommittedMutationReceipt>;
}
```

Its input is detached/canonical/bounded. The authority owns the IndexedDB transaction described above;
callers cannot provide callbacks or handles that escape it. A later coordination client may establish
context, atomically register/admit, reconcile terminal evidence, observe/acknowledge drain, and close a
writer, but its types must be derived from the reviewed receipt/admission contracts rather than
inventing transaction semantics first.

| Writer | Current function | Future wrapper location | Registration / admission | Source / terminal | Drain |
|---|---|---|---|---|---|
| interactive variants | `store/useNotesStore.ts` actions | new Notes mutation facade before any authoritative mutation | window session; semantic operation | local-first source receipt, then memory projection and K-330 terminal reconciliation | reject new; finish exact admitted |
| body flush/retry | `useNotesStore.ts` timer/flush/retry | future outbox delivery facade | remote-delivery session; claim not source admission | outbox claim/ack only | pause claims; no timer flush |
| cross-tab | `useNotesStore.ts/applyStorageMerge` | cross-context apply facade | cross-context window session | local-first revision-aware tx | discard stale event/closure |
| remote apply | `useNotesStore.ts/hydrateFromDB` | sync apply facade after detached response validation | sync session; `REMOTE_APPLY` batch | local-first entity/outbox/source tx | pause/discard stale response |
| restore/undo | store restore functions and `useVaultRestoreFlow.ts` | exclusive maintenance facade | restore/recovery session | staged transactional restore APIs | requires prior drain |
| startup/init | `notePersistence.ts`, `noteUtils.ts`, `AppContent.tsx` | migration coordinator before any write | startup/migration session | reviewed source-migration tx | exclusive epoch |
| D-day migration | `lib/migrateLegacyDdays.ts` | migration facade around exact row set | migration session; one plan with child ops | local-first tx; remote deletion later via outbox/API | exclusive; resumable evidence |
| reset/cleanup | store reset and `persistenceCleanup.ts` | maintenance facade | maintenance session | reviewed destructive tx only | disabled for verification |
| attachment mutate/restore | attachment migration modules/review panel | attachment maintenance facade | maintenance/recovery session | transactionally bind Note reference or retain ambiguity | exclusive |
| physical sinks | `noteIndexedDb.ts`, `notePersistence.ts`, `noteUtils.ts` | replace with token-requiring source adapter; later remove fallback writes | never self-register | refuse without transaction-bound admission | no direct mutation |

## Exact K-329/K-330 protocol field audit

| Concept | Existing | New/changed | Persisted | Transient | Codec impact | Digest impact |
|---|---|---|---:|---:|---|---|
| writer/session/operation IDs and idempotency key | yes | no | yes | no | reuse strict decoders | admission/authority reuse |
| writer/context type and capabilities | yes | finer reviewed manifest mapping only | yes | compatibility descriptor only | version only if values change | registration/admission |
| physical mutation type | yes | semantic mutation kind | yes | no | add strict discriminator | admission/receipt/manifest |
| generation, epoch, admission revision | yes | explicit pre-drain validity rule | yes | no | reducer rule/version | admission/receipt |
| expected/committed source revision | yes | source-authority canonical validation | yes | no | canonical decimal decoder | admission/receipt/terminal |
| physical source/authority/manifest digests | yes | source implementation/protocol binding | yes | no | strict fields/version | all authority digests |
| atomic first registration | separate actions today | `REGISTER_AND_ADMIT_FIRST_OPERATION` | one envelope transition | compatibility input | new action codec | authority digest |
| admission handle | operation fields exist | canonical admission handle/digest | digest/bound fields | detached bounded handle | new strict structure | admission + receipt |
| source receipt | no | immutable receipt and receipt digest | new receipt store | no | new strict codec | terminal/source authority |
| source receipt lineage | no | previous/new chain digest plus committed authority digest | source receipt + authority chain head | bounded proof input only | new strict receipt/authority codec | receipt chain/head |
| per-entity source revision | no | created/last-mutated/deleted source revision | entity envelope | no | entity version evolution | entity/result/authority digest |
| outbox intent/delivery split | partial | immutable source intent projection separated from mutable delivery status | outbox | no | outbox version evolution | receipt hashes intent only |
| terminal success binding | committed revision exists | receipt digest binding; failure-after-receipt prohibition | operation/envelope | no | envelope/action version | authority digest |
| receipt reconciliation | no | repository-owned `RECONCILE_COMMITTED_RECEIPT` | K-330 result only | bounded lookup input | new action/error codec | envelope/terminal digest |
| drain state/checkpoint chain | yes | pre-drain operation remains valid until terminal/epoch | yes | no | reducer rule/version | authority/checkpoint |
| maintenance exclusivity | partially derivable | durable owner binding if not unique | conditional | lock runtime | codec only if added | authority digest |
| bootstrap evidence | no | complete entity/folder/tombstone/relation, attachment metadata, outbox/checkpoint, generation, quiescence, and session-conflict binding | source authority row | complete bounded scan | new authority codec | bootstrap evidence digest |
| chunked restore lineage | partial restore session model | immutable ordered chunk receipts, derived restart cursor, evidence-only final manifest | source receipt + restore session/manifest | bounded next-chunk input | restore/receipt codec evolution | chunk chain/final authority digest |
| context identity | session/context type exist | explicit `contextId` only if required | conditional | fresh runtime identity | codec only if added | registration/admission |
| Web Lock, promise, callbacks, visibility | no durable authority | none | no | yes | none | none |

K-331C narrows the future K-333/K-334 ownership as follows:

| K-331C concept | Persisted | Transient | Codec impact | Digest impact | Schema impact | Future owner |
|---|---|---|---|---|---|---|
| complete revision-zero evidence | complete counts/digests, quiescence and session flags in `source_authority` | bounded complete-store scan | strict versioned authority record; reject unknown/missing fields | bootstrap and current-authority digests | additive `source_authority` store/record only | K-333 protocol; K-334 repository |
| attachment metadata authority | full generation-scoped metadata digest/count; no blob | blob/provider/cache access remains outside proof | fixed-order metadata projection | bootstrap/current authority and affected-set digests | reuse `attachment_state`; source transaction must include it when affected | K-333 projection; K-334 transaction |
| coordination quiescence | epoch/state digest plus exact zero counts/false flags | exclusive lock/transaction lifetime | bounded bootstrap precondition/error values | bootstrap evidence digest | no duplicate coordination store | K-333 preconditions; K-334 transaction |
| receipt hash chain | previous/committed revisions, previous/new chain digests, receipt and committed-authority digest | bounded lookup/range proof | strict receipt/authority evolution | receipt, chain head and authority digest | additive receipt store plus authority fields | K-333 codec; K-334 append-only writes |
| per-entity source revision | created/last-mutated/deleted revision | none | strict entity-envelope evolution | entity and complete-authority digest | additive populated-record migration required | K-333 field contract; K-334 migration/repository |
| immutable outbox intent | identity/payload/base-local revision/idempotency projection | latest delivery observation | explicit intent-versus-delivery projection | receipt hashes immutable intent only | existing outbox record version may need additive fields | K-333 contract; K-334 verification |
| chunked restore sequence | session/plan, ordered chunk receipts, derived cursor projection, final manifest | next-chunk input | strict session/chunk/final codecs and stable errors | chunk chain and complete final authority digest | future versioned restore/receipt fields; no runtime added here | K-333 protocol; K-334 repository |
| strict revision decoding | canonical decimal strings only | parsed `bigint` after validation | shared total decoder and bounded error mapping | canonical string only | no store by itself; applies to all evolved records | K-333 codec; K-334 boundary use |

New stable reconciliation errors are the bounded codes listed above. Every new authority field/action
requires fixed canonical order, strict unknown-field rejection, canonical codec round-trip, relevant
digest inclusion, and a reviewed protocol/K-330 envelope version. `RECONCILE_COMMITTED_RECEIPT` derives
receipt/revision/writer fields from repository reads; its caller input is not included as independent
truth. Old records receive no permissive default and cannot join a new epoch.

Mixed-version contexts fail `UNSUPPORTED_PROTOCOL_VERSION`. Additive source stores require a future
IndexedDB format upgrade with populated-version preservation tests; K-331C makes no schema change.

`K329_K330_PROTOCOL_EXTENSION_REQUIREMENTS_ARE_EXACT_MINIMAL_AND_NON_DUPLICATIVE`

`K331C_PROTOCOL_REQUIREMENTS_CLOSE_BOOTSTRAP_LINEAGE_RESTORE_AND_DECODING_GAPS`

`PROTOCOL_EVOLUTION_REQUIRED_BUT_NOT_IMPLEMENTED_IN_K331C`

## Deterministic evidence and production non-reachability

`frontend/src/lib/localDatabase/productionWriterAdmissionDefinition.test.ts` is test-only. It composes
the existing K-329 pure reducer/canonical codec rather than adding a runtime client. Evidence classes
are deliberately separated:

- **behavioral K-329 evidence**: registration/capability validation, exact/conflicting operation IDs,
  admitted completion, `REQUEST_DRAIN` closure, durable restart, stale epoch, canonical round-trip,
  and checkpoint-5/source-evidence atomicity;
- **architecture fixtures**: source receipt exact retry/conflict, repository-owned reconciliation
  lookup/read-set/terminal cases, append-only delayed-reconciliation lineage, immutable outbox intent,
  strict revision decoding, drain-aware exact admission, complete revision-zero bootstrap
  idempotency/conflict/quiescence, attachment metadata authority, and ordered chunked-restore
  receipt/restart/finalization behavior. They prove internal consistency of the selected contract, not
  a production repository, reducer action, codec, store, migration, or restore implementation;
- **policy snapshots**: unsupported Web Locks, protocol mismatch, maintenance exclusivity, sync pause,
  atomic first-write selection, existing/new/transient field separation, protocol-before-repository
  task order, and audit-only manifest role;
- **source topology snapshot**: reachable clear versus dormant delete facade, manually grounded in the
  reviewed exact-base call graph. It is not an automated future topology audit.

No test claims that the source transaction repository, production client, Web Locks adapter, or writer
instrumentation exists. The harness has no sleep, timing threshold, storage, network,
`navigator.locks`, K-328, or production import.

`K331C_EVIDENCE_COVERS_COMPLETE_BOOTSTRAP_LINEAGE_RESTORE_AND_DECODING_CONTRACTS`

`K331C_EVIDENCE_LABELING_REMAINS_HONEST_AND_NON_IMPLEMENTATION_CLAIMING`

The K-331 change contains only this test and this document. It adds no production module or import,
does not alter any writer, and does not make the test helper reachable from an application bundle.

`K331C_HAS_NO_PRODUCTION_RUNTIME_EFFECT`

- no production K-330 caller or writer registration;
- no production Web Locks call;
- no operation gating or user-write block;
- no source mutation/source-of-truth/startup/UI/sync/restore/migration/network change;
- no production K-328 invocation;
- no K-326 cutover activation and no K-326G change.

## Residual blockers and phased implementation

**Architecture blockers**

- The selected `absinthe-local-v2` source authority and receipt model are architecture only; their
  additive stores, codecs, repository, and migration plan do not exist.
- The frozen K-329/K-330 protocol requires only the exact versioned additions identified above; no
  in-place mutation or permissive old-record default is allowed.

**Source transaction blockers**

- Current authority is memory + a separate legacy IDB or localStorage fallback.
- Full-array replacement, marker/revision writes, remote effects, restore, attachment writes, and
  cleanup span transaction domains.
- Current legacy source commits produce no immutable source receipt. Receipt reconciliation becomes
  safe only after source migration; it must not be retrofitted as proof for legacy full-array writes.

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

1. **K-332 — Define Cross-Module Source Authority and Protocol Contract**: finalize source authority,
   bootstrap, receipt, admission handle, repository reconciliation actor, and drain validity; no
   implementation.
2. **K-333 — Extend K-329/K-330 Protocol and Repository Model**: implement atomic register/admit,
   receipt and committed-revision bindings, repository-owned reconciliation action, canonical codec,
   stable errors, and envelope version evolution; no production activation.
3. **K-334 — Implement Dormant Source Transaction Repository**: add source stores, bootstrap, and
   atomic entity/tombstone/outbox/revision/receipt transaction against the exact K-333 protocol; no
   production callers. It must not define a duplicate admission/reconciliation protocol.
4. **K-335 — Dormant Coordination Client**: built against the reviewed source receipt authority; no
   production callers.
5. **K-336 — Web Locks Adapter**: dormant, bounded, and fail-closed when unsupported.
6. **K-337 — First Disabled Writer Instrumentation Slice**: one narrow path behind an unavailable-by-
   default capability; no cutover.
7. **K-338 — Remaining Writer Instrumentation**: cross-tab, debounce, sync, restore, migration,
   recovery, maintenance, D-day, and attachment paths.
8. **K-339 — Drain Runtime and Browser Evidence**: exact closure/quiescence and cross-context proof.
9. **K-340 — K-328 Consumer and Eligibility Evaluation**: only after source migration,
   instrumentation, and browser evidence; K-326G remains fail-closed.

`SOURCE_TRANSACTION_AUTHORITY_PRECEDES_COORDINATION_CLIENT_AND_WRITER_INSTRUMENTATION`

`PROTOCOL_EVOLUTION_PRECEDES_SOURCE_REPOSITORY_IMPLEMENTATION`

## Validation on the K-331C precommit working tree

| Check | Result |
|---|---|
| K-331/K-331A/K-331B/K-331C focused definition harness | 45 passed; 1 file; final 1.87 s; tests 566 ms |
| K-330 dormant repository | 51 passed; 1 file; 12.97 s; tests 11.52 s |
| K-329 eligibility model | 122 passed; 1 file; 12.16 s; tests 11.62 s |
| K-328 cross-context handoff | 73 passed; 2 files; 1.06 s; tests 992 ms |
| K-327 source-handoff spike | 391 passed; 1 file; 2.50 s; tests 1.99 s |
| K-326 local-first cutover | 78 passed; 1 file; 4.01 s; tests 2.02 s |
| K-325 legacy Notes migration | 164 passed; 1 file; 2.17 s; tests 1.07 s |
| all `localDatabase` | 1,212 passed; 14 files; final 10.78 s; aggregate tests 29.17 s |
| recovery | 70 passed; 2 files; 11.33 s; tests 10.68 s |
| typecheck | passed; final run 25.2 s |
| build | passed; 2,480 modules; Vite 16.90 s; wall 18.1 s; existing mixed-import/chunk-size warnings only |
| `git diff --check` | passed; line-ending notices only |
| full frontend | 5,490 passed / 7 skipped; 583 passed / 1 skipped files; final 195.20 s |

All final commands passed. The focused harness and typecheck ran during correction and all runs passed.
The predecessor suites were run in parallel, so their wall durations are evidence only, not a
performance comparison. The full suite ran twice: the first passed, then the receipt fixture was
strengthened to bind the current authority chain-head digest, and the exact final tree passed again.
This was not a failure-driven rerun; there were no flakes. The harness has
no `.only`, `.skip`, sleep, timer, timing threshold, browser storage, network, or production import.
Exact-head CI is reported on PR #589 after push and is not claimed by this precommit table.

## Non-goals

K-331C does not implement K-332 or later work, production coordination, Web Locks, source migration,
outbox delivery, sync changes, restore/migration execution, source eligibility, cutover, K-328
consumption, UI, startup hooks, network behavior, service workers, or recovery-policy bypasses.
