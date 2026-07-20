# K-334A: Durable Protocol Repository and Atomicity Source-Facts Audit

## 1. Executive verdict

**`K334A_NEEDS_PRECURSOR_OWNER_DECISIONS`**

`CONTRACT_INFERENCE`: K-334 is the owner of additive persistent stores, strict repository boundary reads, and native IndexedDB transaction implementation, as assigned by [K-332](K-332-cross-module-source-authority-protocol-contract.md). It is not yet safe to choose its store topology or migration version because the issuer, rollback, retention, fork-resolution, compatibility, and lifecycle policies that determine authoritative write semantics remain owner decisions in [K-333F](K-333F-manifest-selection-history-contract.md).

`CONFIRMED_SOURCE_FACT`: Current K-333 protocol modules are strict, pure codecs and graph validators only. They create no database, store, index, repository, durable lookup, transaction, or runtime caller: `frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts` and `transactionEvidenceProtocol.ts`.

`PROHIBITED_ASSUMPTION`: Durable bytes, a successfully committed IndexedDB transaction, an index entry, a current-head cache, backup availability, or a migration result is not accepted-history authority, conformity, admission, eligibility, or activation.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Scope and non-goals

`CONFIRMED_SOURCE_FACT`: This audit reads existing source and adds only this document. It changes no database version, store, index, migration, codec, protocol record, runtime caller, recovery policy, writer registration, synchronization path, admission, eligibility, or activation.

`DEFERRED`: K-334B and later may define a reviewed schema/migration and repositories only after the blockers in section 18 are resolved.

## 3. Merged protocol baseline

| Classification | Source fact / consequence |
|---|---|
| CONFIRMED_SOURCE_FACT | `main` contains K-333F merge commit `e3354bafbb56851d44362d6f394dbf085f0b7386` (`K-333F: Define manifest selection and history contract (#596)`). |
| CONFIRMED_SOURCE_FACT | K-332 assigns canonical representation, strict decoders, proofs, compatibility and stable errors to K-333; it assigns additive stores/indexes, schema migration, repositories, and atomic persistence to K-334. See `frontend/docs/K-332-cross-module-source-authority-protocol-contract.md`, sections 1 and 5. |
| CONFIRMED_SOURCE_FACT | K-330 is a dormant, single-envelope coordination repository on the K-321 database. It has no production caller: `frontend/src/lib/localDatabase/dormantWriterCoordinationRepository.ts:27-30,703-760`. |
| CONFIRMED_SOURCE_FACT | K-328 is a separate dormant read-only handoff persistence foundation: `frontend/src/lib/localDatabase/crossContextHandoff/database.ts:19-22`; its dormancy test permits no caller outside its isolated module. |
| PROHIBITED_ASSUMPTION | Neither dormant foundation is a K-334 authority repository or evidence that a production writer may run. |

## 4. Current persistent-storage inventory

| Path | Current shape / owner | Production caller status | Authority classification |
|---|---|---|---|
| `absinthe-notes-v1` | v1, `notes` store keyed by note `id`; `frontend/src/lib/noteIndexedDb.ts:16-40` | Current Notes persistence through `notePersistence.ts` | CURRENT_PRODUCTION_SOURCE / LEGACY |
| Notes localStorage | `notes-v2`, folders and migration/revision keys; inventory in `frontend/src/lib/storageInventory.ts` | Current fallback/supporting path | CURRENT_SUPPORTING_STORAGE / LEGACY |
| `absinthe-local-v2` | v4 local-first foundation, nine stores listed in section 5 | capability-gated dormant repository calls; no production wiring | DORMANT_PRODUCTION_FOUNDATION |
| K-330 envelope | `writer_coordination_state` within `absinthe-local-v2` | explicit developer/test capability only | DORMANT_PRODUCTION_FOUNDATION |
| `absinthe-cross-context-handoff-v1` | v1, `handoff_authority` and `handoff_candidates` | no active caller outside handoff module | DORMANT_PRODUCTION_FOUNDATION |
| `absinthe.attachments.metadata` | v1, `metadata` keyed by `id`, `noteId` index | attachment repository | CURRENT_SUPPORTING_STORAGE |
| `absinthe.attachments.blobs` | v1, `blobs` keyed by `key` | attachment blob adapter | CURRENT_SUPPORTING_STORAGE |
| local/session storage UI and draft keys | inventory / recovery adapters; not protocol records | current UI/supporting callers | NON_AUTHORITATIVE_CACHE or CURRENT_SUPPORTING_STORAGE |
| recovery export files / backup inputs | deterministic export package and supplied adapters | explicit export/import workflow only | DOCUMENTATION_ONLY / NON_AUTHORITATIVE_CACHE |
| Supabase tables and auth state | remote backend state, not K-333 authority persistence | existing domain-specific network callers | EXTERNAL_REMOTE_STATE |

`CONFIRMED_SOURCE_FACT`: `storageInventory.ts` itself labels browser storage for audit/recovery and includes localStorage, sessionStorage, Supabase, memory, and file-export layers. It does not define K-333 authority.

## 5. Current database/version/store map

`CONFIRMED_SOURCE_FACT`: `LOCAL_DATABASE_NAME = 'absinthe-local-v2'`, `LOCAL_DATABASE_VERSION = 4`, and `LOCAL_SCHEMA_VERSION = 1` in `frontend/src/lib/localDatabase/types.ts:1-3`.

| Store | Key / indexes | Existing responsibility |
|---|---|---|
| `database_meta` | `namespaceKey`; `by_schema_version` | namespace metadata and active generation pointer |
| `generations` | `[namespaceKey,generationId]`; status, created, one-active indexes | staged/active generation lifecycle |
| `entities` | `[namespaceKey,generationId,domain,entityId]`; domain/owner/deleted/updated indexes | local entity envelopes and tombstones |
| `outbox` | `[namespaceKey,generationId,mutationId]`; status/entity/idempotency/revision indexes | local transactional outbox |
| `sync_checkpoints` | `[namespaceKey,generationId,provider,stream]` | future sync checkpoints |
| `restore_sessions` | `[namespaceKey,sessionId]`; status/package/staging indexes | restore session evidence |
| `migration_state` | `[namespaceKey,migrationId]`; phase index | local migration evidence |
| `attachment_state` | `[namespaceKey,generationId,attachmentId]`; sync/updated indexes | local attachment state |
| `writer_coordination_state` | out-of-line key, no indexes | K-330 canonical coordination envelope |

`CONFIRMED_SOURCE_FACT`: `createLocalDatabaseSchema()` accepts only historical versions 0–3 and adds the coordination store at v4; it updates existing metadata rows on v1–v3 upgrade: `frontend/src/lib/localDatabase/schema.ts`.

`CONFIRMED_SOURCE_FACT`: `openLocalDatabase()` uses `onblocked` -> `OPEN_BLOCKED`, strict schema/version validation, and closes a stale connection on `onversionchange`: `frontend/src/lib/localDatabase/repository.ts:942-961`.

`OWNER_DECISION_REQUIRED`: A K-334 migration owner/database and next version cannot be selected merely because v4 has spare conceptual scope. K-334 must first choose whether source mutation and protocol evidence require one native database transaction.

## 6. K-333 record-family persistence inventory

| Family | Codec / identity | Natural key candidate | Current status and durable requirement |
|---|---|---|---|
| `WriterIdentityRecord` | K-333 strict codec; `writerDigest`; fields bind id, namespace, physical source, writer type, opaque manifest digest | exact `writerDigest` plus scoped identity | CONFIRMED_SOURCE_FACT: no durable repo/caller; persistence only after adoption policy exists |
| `WriterSessionRecord` | K-333 strict codec; `sessionDigest`; binds generation, writer digest, epoch, capability digest | exact `sessionDigest` plus scoped session | CONFIRMED_SOURCE_FACT: no durable repo/caller; context/capability semantics unresolved |
| `SourceAuthorityRecord` | K-333 strict codec; `authorityDigest`; source revision and operation/terminal/outbox roots | exact `authorityDigest` and source/namespace/generation | CONTRACT_INFERENCE: immutable accepted authority snapshots need append-only retention; a mutable latest row alone cannot be authority |
| `SourceTransactionReferenceRecord` | K-333 strict codec; `referenceDigest`; binds authority, operation, admission, writer/session, terminal/outbox, MMR/checkpoint | exact `referenceDigest`, operation id | CONTRACT_INFERENCE: must be durably bound to the transaction that creates its cited evidence |
| `OperationRecord` | K-333B codec; `operationDigest` and `exactOperationDigest` | `operationDigest` / exact operation commitment | CONFIRMED_SOURCE_FACT: pure value only; durable append-only candidate |
| `AdmissionRecord` | K-333B codec; `admissionDigest`, exact operation commitment | `admissionDigest` / operation id | CONTRACT_INFERENCE: immutable dependent evidence; cannot imply admission merely by persistence |
| `ImmutableOutboxIntentRecord` | K-333B codec; `outboxDigest`, exact operation commitment | `outboxDigest` / operation id | CONTRACT_INFERENCE: must be atomically consistent with source mutation if used as its delivery proof |
| `TerminalStateRecord` | K-333B codec; `terminalDigest`, exact operation commitment | `terminalDigest` / operation id | CONTRACT_INFERENCE: terminality cannot appear without the committed operation/mutation boundary |
| manifest/compatibility selectors | K-329 owns manifest canonical bytes/digest; K-333 owns protocol tuples | digest plus exact subject/version tuple | OWNER_DECISION_REQUIRED: selected manifest and compatibility history have no durable resolver yet |

`CONFIRMED_SOURCE_FACT`: record fields and graph edges are in `writerAuthorityProtocol.ts:26-103` and `transactionEvidenceProtocol.ts:39-99`; K-333B’s public validator only validates supplied records and has no persistence path.

## 7. K-333F selection/history durability requirements

| Concept | Required durable form | Authority boundary |
|---|---|---|
| Subject `{physicalSourceDigest,namespaceId,generationId}` | exact subject key and immutable event binding | CONFIRMED_SOURCE_FACT: K-333F section 4; no cross-subject reuse |
| `SELECT` / `SUPERSEDE` / `REVOKE` / `ROLLBACK_DECISION` | immutable event if future issuer accepts it | CONTRACT_INFERENCE: event log is authority evidence; no mutable replacement |
| `RESTORE_REFERENCE` | optional non-authoritative recovery metadata | CONFIRMED_SOURCE_FACT: may never select/change a head |
| Head / sequence | derived from accepted history; optional materialized view only | PROHIBITED_ASSUMPTION: a pointer or index is not authority without exact event binding and revalidation |
| predecessor and unique successor | event predecessor key plus transaction-time equality check | CONTRACT_INFERENCE: native transaction must reject stale or competing successor |
| fork/conflict/duplicate-effective state | preserved diagnostics / graph evidence, no winner cache | CONFIRMED_SOURCE_FACT: K-333F sections 7, 9, 11 |
| bytes resolution | content-addressed bytes or immutable resolution metadata while referenced | CONFIRMED_SOURCE_FACT: K-333F requires trusted bytes; possession is not authority |
| generic issuer / rollback authorization | owner-policy inputs, not defaults encoded by storage | OWNER_DECISION_REQUIRED |
| generation termination, inheritance, retention, compatibility | explicit owner policy records only if/when approved | OWNER_DECISION_REQUIRED |

## 8. Persistence topology options

| Option | Feasibility / atomicity | Risks and verdict |
|---|---|---|
| A. Additive stores in `absinthe-local-v2` | Can atomically join current local entity/outbox mutation with protocol stores in one native IndexedDB transaction | Best possible local atomicity, but couples dormant K-321 generation model to new K-333 authority; migration/version and policy semantics remain blocked. **Not selected yet.** |
| B. Dedicated protocol authority DB | Isolates records and upgrade lifecycle | Cannot atomically commit with Notes source mutation or K-330 envelope; durable-intent/reconciliation protocol would be required. **Not selected.** |
| C. Extend K-330 envelope | Atomic only for one bounded whole-envelope coordination model | Duplicates K-333 append-only/history responsibility, causes whole-envelope rewrite and contention, and violates K-330’s explicit bounded scope. **Rejected.** |
| D. Hybrid event log plus derived views | Can preserve immutable history and rebuild indexes; native atomicity only within one DB | Correct conceptual split, but placement and intent protocol are blocked by owner policies. **Candidate after decisions.** |
| E. No implementation yet | Preserves authority boundaries and avoids an accidental policy | **Selected outcome for K-334A.** |

`CONFIRMED_SOURCE_FACT`: IndexedDB cannot provide one native transaction across `absinthe-local-v2`, `absinthe-cross-context-handoff-v1`, the legacy Notes DB, attachment DBs, or localStorage. Any claim otherwise is `CROSS_DATABASE_ATOMICITY_IMPOSSIBLE`.

## 9. Selected outcome

`K334A_NEEDS_PRECURSOR_OWNER_DECISIONS`

`OWNER_DECISION_REQUIRED`: Before schema design, record the K-333F issuer, rollback, lifecycle, retention, fork-resolution, compatibility, and external-boundary policies. Then K-334B may choose whether its authoritative write set must co-reside with a local source mutation in `absinthe-local-v2` or use an explicitly reviewed durable-intent reconciliation protocol.

## 10. Atomic transaction matrix

| Facts / crash window | Classification | Required result |
|---|---|---|
| local entity mutation + local outbox | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION | Already demonstrated by `LocalDatabaseRepository.commitLocalMutation()` over metadata/generation/entities/outbox. |
| source revision + operation/admission/outbox/terminal/reference | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION if they assert one committed source operation | No source mutation or terminal proof may survive alone. |
| accepted event + predecessor/head compare + materialized head view | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION if a head view exists | Event without bound view is reconstructible; view without event is corruption. |
| event history -> indexes/current selection | DERIVED_AFTER_COMMIT | Rebuild/revalidate; never use an index as authority. |
| K-330 envelope + K-333 event/source mutation | CROSS_DATABASE_ATOMICITY_IMPOSSIBLE unless K-334 places all participating records in one DB | A separate intent/reconciliation design would require later review. |
| K-328 handoff evidence | READ_ONLY_REFERENCE | Must be revalidated; it cannot be rewritten or treated as K-333 acceptance. |
| restore/migration markers | MAY_COMMIT_SEPARATELY_WITH_DURABLE_INTENT | No restore/migration may issue selection history or advance head without future authority. |
| attachment blobs and metadata | CROSS_DATABASE_ATOMICITY_IMPOSSIBLE relative to protocol DB | References only; blob movement/deletion remains out of scope. |
| owner policy record | OWNER_DECISION_REQUIRED | Absence blocks authoritative issuance rather than selecting a default. |

## 11. Append-only history and current-view boundary

`CONTRACT_INFERENCE`: immutable accepted events and immutable K-333 operation/admission/outbox/terminal records are the only potential authority evidence. A head, subject lookup, digest lookup, predecessor lookup, conflict flag, and current selection are rebuildable projections.

`CONFIRMED_SOURCE_FACT`: K-333F rejects persistence-order and timestamp winners and requires append-only retained evidence (`K-333F`, sections 7, 9, 11, 14).

`PROHIBITED_ASSUMPTION`: corruption repair must not choose a branch, relabel an event, rebuild a missing authoritative event from a view, or infer selection from available bytes.

## 12. Candidate store/key requirements

| Conceptual candidate | Key / mutation rule | Ownership and blocker |
|---|---|---|
| canonical protocol event bytes | event self-digest; add-only | K-333 codec validates bytes; K-334 repository may retain only after issuer policy exists |
| subject event sequence / predecessor uniqueness | exact subject + sequence and predecessor uniqueness constraints | requires accepted-event and fork policy; no mutable overwrite |
| current-head projection | exact subject; replaceable only in same transaction as an accepted event | derived cache, revalidated against history |
| operation evidence | operation/admission/outbox/terminal self-digest, add-only | must share source-operation transaction or approved intent protocol |
| source authority / transaction reference | self-digest plus exact source subject/revision | must bind all cited records; no caller-supplied truth |
| bounded diagnostics/conflicts | diagnostic identity; append-only or retained per policy | retention/fork policy unresolved |
| policy decisions | approved decision identity/version | owner-governed; absent policy blocks issuance |

`OWNER_DECISION_REQUIRED`: byte ceilings, growth limits, retention/deletion, and index selection are not source-established. K-334B must not invent numeric production limits.

## 13. Database migration contract

`CONFIRMED_SOURCE_FACT`: `absinthe-local-v2` evolved 0 -> 4 additively; its v4 addition was only `writer_coordination_state`. K-330 explicitly preserves historical K-325 target database versions 3 and 4 without rewriting evidence (`K-330` document, Storage architecture).

`CONTRACT_INFERENCE`: a future migration must be additive, retain prior rows/bytes, reject unexpected schema, close stale tabs on `versionchange`, reject blocked opens, and validate the reopened schema. IndexedDB upgrades cannot be downgraded or rolled back after commit; an aborted upgrade transaction must leave the prior schema.

`OWNER_DECISION_REQUIRED`: `MIGRATION_VERSION_OWNER_DECISION_REQUIRED`. The next version and owning database depend on the unresolved co-location/atomicity decision.

## 14. Restore, bootstrap, and recovery contract

| Path | Allowed consequence | Forbidden consequence |
|---|---|---|
| startup/reopen | strict read validation and derived-index reconstruction | selection, head advancement, repair, or runtime eligibility |
| backup/export | preserve canonical bytes/provenance where supplied | treat backup possession as authority |
| restore import | retain non-authoritative `RESTORE_REFERENCE` only when later contract permits | issue lifecycle event or delete/rewrite history |
| migration resume | preserve source/target evidence and resume validated staging | infer authority from migration success |
| remote hydration | retain externally supplied data only after later validation | select newest remote bytes |
| recovery / empty state | fail closed and preserve diagnostics | silently normalize missing authority to empty/active |

`CONFIRMED_SOURCE_FACT`: recovery adapters sanitize provenance and report unavailable/parse-failed inputs; they are not a K-333 authority resolver: `frontend/src/lib/recoveryExportSourceAdapters.ts`.

## 15. Concurrency and multi-context audit

`CONFIRMED_SOURCE_FACT`: a single IndexedDB read/write transaction serializes participating stores; K-330 adds exact CAS checks inside its one-store transaction, and K-328 combines authority/candidate writes in one strict transaction with byte comparison/CAS (`dormantWriterCoordinationRepository.ts`, `crossContextHandoff/database.ts`).

`CONTRACT_INFERENCE`: future selection acceptance requires exact subject, action transition, generic authorization, predecessor/current-head compare, exact next sequence, and append in one native transaction. A Web Lock may coordinate contexts but cannot supply durability or authority; it cannot replace transaction-time comparison.

`OWNER_DECISION_REQUIRED`: stale-tab, mobile-webview, worker/service-worker, lock-loss/starvation, and cross-database recovery policy require a future concurrency contract. Until then, no source mutation may claim K-333 authority.

## 16. Failure/corruption taxonomy

| Conceptual failure | Detection / fail-closed behavior |
|---|---|
| `DATABASE_OPEN_FAILED`, `DATABASE_OPEN_BLOCKED`, `UNEXPECTED_DATABASE_VERSION`, `UNEXPECTED_STORE_SCHEMA`, `PERSISTENCE_UNAVAILABLE`, `QUOTA_EXCEEDED` | open/upgrade/write boundary; block mutation, preserve existing evidence, retry only when no commit occurred |
| `CORRUPT_PERSISTED_RECORD`, `CANONICAL_DECODE_FAILED`, `DIGEST_MISMATCH`, `SUBJECT_KEY_MISMATCH` | strict decode/binding read; return bounded error, no normalization or deletion |
| `PREDECESSOR_NOT_CURRENT_HEAD`, `SEQUENCE_NOT_NEXT`, `SUCCESSOR_ALREADY_EXISTS`, `CONCURRENT_SUCCESSOR_CONFLICT` | pre-acceptance transaction read; abort proposed event, preserve bounded diagnostic |
| `HISTORY_FORKED`, `DUPLICATE_EFFECTIVE_SELECTION` | graph/current-view validation; derive no selection and choose no winner |
| `TRANSACTION_ABORTED`, `TRANSACTION_COMMIT_UNCERTAIN` | completion boundary; do not expose success before completion; re-read only through strict restart validation |
| `RESTORE_REFERENCE_INVALID`, `OWNER_POLICY_UNAVAILABLE` | restore/policy boundary; retain non-authoritative evidence where safe and issue no authority event |

`PROHIBITED_ASSUMPTION`: this table is a future repository taxonomy, not a new production error enum.

## 17. Resource and retention audit

`CONFIRMED_SOURCE_FACT`: K-333 protocol canonical encoding applies a 32 KiB record ceiling and related canonical-value bounds; K-330 separately bounds its aggregate envelope. See `frontend/docs/K-333B-production-transaction-evidence-records.md`, Stable errors and resource bounds.

`OWNER_DECISION_REQUIRED`: event/diagnostic count ceilings, retention duration, compaction/checkpoint model, fork/abandoned-generation retention, quota response, account-deletion treatment, and export inclusion have no approved production values. No numeric production estimate is introduced here.

## 18. Owner-decision matrix

| Decision | Persistence consequence / safe unresolved behavior |
|---|---|
| generic issuer authorization | no event issuance and no policy-default record |
| rollback authorization | no rollback event or auto-relabel to supersede |
| generation termination/inheritance | no automatic carry-forward or terminal rewrite |
| history topology / fork resolution | retain conflict evidence, derive no winner |
| retention / compaction | no destructive pruning of referenced evidence |
| compatibility combinations | reject unsupported/mixed tuples; no inferred decoder edge |
| retrospective invalidation | no delete/rewrite/retroactive authority |
| external boundary mapping | no session/operation boundary inferred from sequence/time |
| implementation-gate approval | K-334B remains blocked until owner-approved implementation phase |

## 19. Production integration blockers

`CONFIRMED_SOURCE_FACT`: there is no K-333 production persistence caller; K-333B explicitly states its modules are pure dormant values. K-328 and K-330 are isolated/dormant. K-331 runtime instrumentation is architecture-only.

`OWNER_DECISION_REQUIRED`: no production integration is permitted until policy decisions, storage co-location/intent design, repository implementation, real browser durability evidence, later writer integration, admission, shadow verification, eligibility, and activation contracts have each been independently reviewed.

## 20. Recommended K-334 task decomposition

1. **K-334B — Owner-decision closure and durable schema/migration contract.** Define only approved policy inputs, co-location decision, exact additive upgrade owner, and populated-version upgrade tests.
2. **K-334C — Canonical append-only protocol evidence repository.** Strict byte boundary reads and restart validation; no runtime caller.
3. **K-334D — Atomic operation/admission/outbox/terminal repository.** One reviewed native transaction or an explicitly reviewed durable-intent protocol.
4. **K-334E — Selection-history event/head projection repository.** Event-first authority, derived head/index rebuild, conflict/fork handling.
5. **K-334F — Bootstrap/restore-reference/recovery integration contract.** No selection authority from import, backup, or hydration.
6. **K-334G — Concurrency, crash, quota, and real-browser evidence.** Multi-context evidence before any writer integration.

`DEFERRED`: K-331 writer instrumentation, K-328/K-329 adapters, shadow consumer, eligibility, and activation remain later integration work.

## 21. Validation evidence

`CONFIRMED_SOURCE_FACT`: This document is based on the bounded source inventory cited above. No test-only audit file is needed because database names, versions, stores, source callers, K-333 protocol ownership, and dormancy claims already have production-source constants and permanent focused tests.

`DEFERRED`: focused K-329/K-330/K-332/K-333/K-328/K-325/recovery suites, typecheck, build, and diff validation are required before PR publication.

## 22. Final invariant

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
