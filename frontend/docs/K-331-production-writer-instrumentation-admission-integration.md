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
the genuinely new bindings listed below may extend the canonical codec. K-331A does not implement
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
The selected later drift guard is `CENTRAL_MANIFEST`: a versioned semantic mutation manifest will bind
every semantic writer kind to its source entry point, capability, sink class, and reviewed source
implementation. Tests will require uniqueness and full manifest coverage before a production path can
be admitted. K-331A does not add production markers or imports.

`WRITER_TOPOLOGY_DRIFT_GUARD_STRATEGY_SELECTED: CENTRAL_MANIFEST`

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
or success UI changes. It binds exact session/generation/epoch/source revision/authority digest and is
invalid after drain closure or epoch transition. Exact same identity and canonical input is idempotent;
same ID with any different field fails. Attempts do not change operation identity. A retry either
reconciles the exact admitted record or creates a new causally linked operation after a proven abort.

The existing K-329 operation states remain `admitted`, `committed`, `aborted`, and `failed`; K-331A
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
| `source_authority` | `[namespaceKey, generationId]` | one canonical source revision and implementation/protocol binding | read/write once per mutation | new additive store; revision and aggregate authority digest |
| `source_mutation_receipts` | `[namespaceKey, generationId, operationId]` | immutable proof of exact local source commit | read/add | new additive store; receipt digest and exact-retry authority |
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

The namespace/generation source revision is a canonical nonnegative decimal string with at most 16
digits. It is compared and incremented with exact decimal-string/BigInt logic, never converted to a
JavaScript `number`. Revision exhaustion fails closed before writes. One successful source transaction,
including a bounded bulk mutation, increments it exactly once. Abort, validation failure, and exact
receipt retry do not increment it. The previous and committed values are stored in the source receipt,
every outbox record for the operation, and the later K-330 terminal projection. Restart reads the same
`source_authority` record; timestamps do not affect ordering.

`SOURCE_REVISION_IS_MONOTONIC_TRANSACTION_BOUND_AND_RESTART_STABLE`

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

`SOURCE_TRANSACTION_RECEIPT_PROVES_LOCAL_COMMIT_WITHOUT_EXPOSING_USER_CONTENT`

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

After source commit, a short coordination transition reads the immutable source receipt, verifies its
digest and exact relation to the admitted operation, and projects `committed` plus the committed source
revision/receipt digest into K-330. A crash between those transactions is safe: restart performs only
that projection. It never replays the entity/outbox transaction. Terminal success without the exact
receipt, or a receipt without an admitted operation, is corruption and blocks drain/eligibility.

`ADMISSION_RECEIPT_IS_SINGLE_OPERATION_BOUND_AND_SOURCE_TRANSACTION_VERIFIABLE`

`TERMINAL_EVIDENCE_ARCHITECTURE_SELECTED: SOURCE_RECEIPT_RECONCILIATION`

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

| Concept | Existing field/authority | Reusable | Change needed |
|---|---|---:|---|
| writer type | `writerTypeId`, reviewed manifest | yes | semantic manifest entries must preserve finer K-331 writer distinctions |
| context type | `contextType`, manifest `contextTypes` | yes | no duplicate field |
| capabilities | registration `capabilities`, manifest `requiredCapabilities` | yes | add only reviewed fine-grained values if source transaction enforcement needs them |
| mutation type | operation `mutationType` | yes as physical class | add a finer semantic mutation discriminator, bound to manifest and receipt |
| identities | `writerId`, `sessionId`, `operationId`, `idempotencyKey` | yes | add explicit `contextId` only for multi-writer context binding |
| epoch/admission | `coordinationEpoch`, `admissionTransitionRevision` | yes | include in admission/receipt digests |
| source revision | `expectedSourceRevision`, `committedSourceRevision` | yes | canonical decimal validation/increment belongs to source authority |
| physical source | `physicalSourceDigest` | yes | bind to source implementation/protocol identity |
| manifest/protocol | `manifestVersion`, schema/byte format, authority digest | partially | add an explicit coordination/source protocol version and source implementation ID |
| terminal state | operation `state`, `terminalResult` | yes | add source receipt digest; no new ambiguous-success terminal |
| drain | authority state, `admissionOpen`, drain revision | yes | terminology correction only |
| checkpoints/source evidence | checkpoint chain, source evidence/digests | yes | checkpoint 5 remains atomic with source evidence |
| maintenance exclusivity | derivable today only from manifest policy/graph | no | add one durable bounded maintenance owner identity/operation binding if required by the reviewed reducer |

Genuinely new persisted fields are limited to `contextId`, semantic mutation discriminator,
coordination/source protocol version, source implementation ID, admission receipt digest, source
transaction receipt digest, committed source revision binding, and a maintenance owner binding if the
future reducer cannot derive it uniquely. Web Lock state, pending promises, UI state, browser
visibility, and in-flight callbacks remain transient.

Each new authority field requires fixed canonical order, strict decode validation, inclusion in the
relevant registration/operation/admission/receipt/authority digest, a reviewed manifest/protocol
version, and a K-330 envelope version upgrade. Old records receive no permissive default: they remain
valid only for the frozen old protocol and cannot join a new epoch. Mixed-version contexts fail
`UNSUPPORTED_PROTOCOL_VERSION`. Additive source stores require an IndexedDB format upgrade with
populated-version preservation tests; K-331A makes no schema change.

`K329_K330_PROTOCOL_EXTENSION_REQUIREMENTS_ARE_EXACT_MINIMAL_AND_NON_DUPLICATIVE`

`PROTOCOL_EVOLUTION_REQUIRED_BUT_NOT_IMPLEMENTED_IN_K331A`

## Deterministic evidence and production non-reachability

`frontend/src/lib/localDatabase/productionWriterAdmissionDefinition.test.ts` is test-only. It composes
the existing K-329 pure reducer/canonical codec rather than adding a runtime client. Evidence classes
are deliberately separated:

- **behavioral K-329 evidence**: registration/capability validation, exact/conflicting operation IDs,
  admitted completion, `REQUEST_DRAIN` closure, durable restart, stale epoch, canonical round-trip,
  and checkpoint-5/source-evidence atomicity;
- **architecture fixtures**: source receipt exact retry/conflict and the complete receipt/terminal
  reconciliation classification. They prove internal consistency of the selected contract, not a
  production repository implementation;
- **policy snapshots**: unsupported Web Locks, protocol mismatch, maintenance exclusivity, sync pause,
  atomic first-write selection, and existing/new/transient field separation;
- **source topology snapshot**: reachable clear versus dormant delete facade, manually grounded in the
  reviewed exact-base call graph. It is not an automated future topology audit.

No test claims that the source transaction repository, production client, Web Locks adapter, or writer
instrumentation exists. The harness has no sleep, timing threshold, storage, network,
`navigator.locks`, K-328, or production import.

`K331A_EVIDENCE_DISTINGUISHES_BEHAVIORAL_PROOF_FROM_POLICY_SNAPSHOT`

The K-331 change contains only this test and this document. It adds no production module or import,
does not alter any writer, and does not make the test helper reachable from an application bundle.

`K331A_HAS_NO_PRODUCTION_RUNTIME_EFFECT`

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

1. **K-332 — Define Canonical Local-First Source Transaction Authority**: finalize the additive
   database/store layout, revision/receipt codec, transaction ownership, and migration plan; dormant.
2. **K-333 — Implement Dormant Source Transaction Repository**: atomic
   entity/tombstone/outbox/revision/receipt writes and exact restart/idempotency tests; no callers.
3. **K-334 — Extend K-329/K-330 Protocol for Source Receipts**: minimal fields, canonical codec,
   digests, schema/version evolution, and atomic first register/admit; no activation.
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

## Validation on the K-331A precommit working tree

| Check | Result |
|---|---|
| K-331/K-331A focused definition harness | 21 passed; 1 file; 1.49 s |
| K-330 dormant repository | 51 passed; 1 file; 9.07 s |
| K-329 eligibility model | 122 passed; 1 file; 8.81 s |
| K-328 cross-context handoff | 73 passed; 2 files; 0.914 s |
| K-327 source-handoff spike | 391 passed; 1 file; 2.26 s |
| K-326 local-first cutover | 78 passed; 1 file; 4.03 s |
| K-325 legacy Notes migration | 164 passed; 1 file; 3.66 s |
| all `localDatabase` | 1,188 passed; 14 files; 11.55 s |
| recovery | 70 passed; 2 files; 13.47 s |
| typecheck | passed; 21.7 s |
| build | passed; 2,480 modules; Vite 10.64 s; existing mixed-import/chunk-size warnings only |
| `git diff --check` | passed; line-ending notices only |
| full frontend | 5,466 passed / 7 skipped; 583 passed / 1 skipped files; 196.97 s |

All final commands passed. The focused harness and typecheck were also run during editing before the
final validation sequence; no run failed. The full suite ran once. No flakes or failure-driven reruns
occurred. Exact-head CI is reported on PR #589 after push and is not claimed by this precommit table.

## Non-goals

K-331A does not implement K-332 or later work, production coordination, Web Locks, source migration,
outbox delivery, sync changes, restore/migration execution, source eligibility, cutover, K-328
consumption, UI, startup hooks, network behavior, service workers, or recovery-policy bypasses.
