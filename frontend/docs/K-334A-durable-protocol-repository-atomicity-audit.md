# K-334A: Durable Protocol Repository and Atomicity Source-Facts Audit

## 1. Executive verdict

**`K334A_NEEDS_PRECURSOR_OWNER_DECISIONS`**

`CONFIRMED_SOURCE_FACT`: K-332 assigns additive persistent stores and indexes, schema migration, strict repository boundary reads, and native IndexedDB transaction implementation to K-334. It does not select a target database, topology, concrete version, or policy-dependent write semantics.

`OWNER_DECISION_REQUIRED`: issuer, rollback, generation lifecycle, history topology and retention, fork/conflict resolution, compatibility, retrospective invalidation, external-boundary mapping, and implementation-gate policy remain unapproved K-333F decisions.

`PROHIBITED_ASSUMPTION`: durable bytes, an IndexedDB commit, a derived index or head, migration completion, or backup availability is not accepted-history authority, admission, eligibility, or activation.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Scope and non-goals

`CONFIRMED_SOURCE_FACT`: this audit documents existing source facts only. It changes no database version, store, index, migration, codec, protocol record, runtime caller, recovery policy, writer registration, synchronization, admission, eligibility, or activation.

`DEFERRED`: K-334B is owner-decision proposal and approval-evidence work only. K-334C may define a schema and migration contract only after sufficient explicit owner decisions are recorded.

## 3. Merged protocol baseline

| Classification | Source fact / consequence |
|---|---|
| CONFIRMED_SOURCE_FACT | `main` contains K-333F at `e3354bafbb56851d44362d6f394dbf085f0b7386`; K-333 currently provides pure strict codecs and supplied-record graph validation, not a database, repository, durable lookup, transaction, or runtime caller. |
| CONFIRMED_SOURCE_FACT | K-332 assigns canonical representation, decoders, proofs, compatibility, and stable errors to K-333; it assigns persistent stores, migration, repositories, and atomic persistence to K-334. |
| CONFIRMED_SOURCE_FACT | K-330 is a dormant single-envelope coordination repository within `absinthe-local-v2`; K-328 is a separate dormant read-only handoff database. |
| PROHIBITED_ASSUMPTION | Neither dormant foundation is a K-334 authority repository or evidence that a production writer may run. |

## 4. Current persistent-storage inventory and legacy Notes boundary

| Path | Current shape / caller | Classification |
|---|---|---|
| `absinthe-notes-v1` | v1 `notes` store keyed by note `id`; current `notePersistence.ts` IndexedDB path | CURRENT_PRODUCTION_SOURCE / LEGACY |
| `notes-v2` localStorage | direct current Notes reader/writer when IndexedDB is unavailable or fails: `initNotesPersistence()` and `saveNotesAsync()` | CURRENT_PRODUCTION_SOURCE / LEGACY_FALLBACK |
| other Notes localStorage keys | folders, migration and revision markers, UI/session/draft/recovery support keys in `storageInventory.ts` | CURRENT_SUPPORTING_STORAGE or NON_AUTHORITATIVE_CACHE / LEGACY as their role requires |
| `absinthe-local-v2` | v4 dormant local-first foundation; capability-gated calls and no production Notes wiring | DORMANT_PRODUCTION_FOUNDATION |
| K-330 envelope | `writer_coordination_state` in `absinthe-local-v2`; explicit developer/test capability | DORMANT_PRODUCTION_FOUNDATION |
| `absinthe-cross-context-handoff-v1` | separate K-328 handoff authority/candidate stores; no production caller | DORMANT_PRODUCTION_FOUNDATION |
| attachment metadata/blob databases | current attachment support stores | CURRENT_SUPPORTING_STORAGE |
| recovery exports and backups | explicit export/import inputs | DOCUMENTATION_ONLY / NON_AUTHORITATIVE_CACHE |
| Supabase tables and auth state | existing remote application state | EXTERNAL_REMOTE_STATE |

`CONFIRMED_SOURCE_FACT`: production Notes persistence is mixed: `absinthe-notes-v1` is the current primary path, and `notes-v2` is a direct legacy fallback reader/writer. They are separate browser-storage mechanisms and not one native transaction. `absinthe-local-v2` is not the current production Notes source.

`PROHIBITED_ASSUMPTION`: no current Notes path establishes K-333 authority merely by persisting a value.

## 5. Exact current `absinthe-local-v2` schema inventory

`CONFIRMED_SOURCE_FACT`: `LOCAL_DATABASE_NAME = 'absinthe-local-v2'`, `LOCAL_DATABASE_VERSION = 4`, and `LOCAL_SCHEMA_VERSION = 1`. There are nine stores and 22 indexes. Every listed store has `autoIncrement: false`; every listed index has `multiEntry: false`.

| Store (introduced) | Key path | Exact indexes: name -> key path; unique |
|---|---|---|
| `database_meta` (v1) | `namespaceKey` | `by_schema_version` -> `schemaVersion`; false |
| `generations` (v1) | `[namespaceKey, generationId]` | `by_namespace_status` -> `[namespaceKey, status]`; false. `by_namespace_created` -> `[namespaceKey, createdAt]`; false. `one_active_per_namespace` -> `activeNamespaceKey`; true |
| `entities` (v1) | `[namespaceKey, generationId, domain, entityId]` | `by_namespace_generation_domain` -> `[namespaceKey, generationId, domain]`; false. `by_namespace_generation_owner` -> `[namespaceKey, generationId, ownerId]`; false. `by_namespace_generation_deleted` -> `[namespaceKey, generationId, deletionState]`; false. `by_namespace_generation_updated` -> `[namespaceKey, generationId, updatedAt]`; false |
| `outbox` (v1; three added v2) | `[namespaceKey, generationId, mutationId]` | `by_namespace_generation_status` -> `[namespaceKey, generationId, status]`; false. `by_namespace_generation_entity` -> `[namespaceKey, generationId, domain, entityId]`; false. `by_idempotency_key` -> `[namespaceKey, generationId, idempotencyKey]`; true. `by_namespace_generation_status_available` -> `[namespaceKey, generationId, status, availableAt]`; false. `by_namespace_generation_status_lease` -> `[namespaceKey, generationId, status, leaseExpiresAt]`; false. `by_namespace_generation_entity_revision` -> `[namespaceKey, generationId, domain, entityId, localRevision]`; true |
| `sync_checkpoints` (v1) | `[namespaceKey, generationId, provider, stream]` | `by_namespace_generation_provider` -> `[namespaceKey, generationId, provider]`; false |
| `restore_sessions` (v1; three added v3) | `[namespaceKey, sessionId]` | `by_namespace_status` -> `[namespaceKey, status]`; false. `by_namespace_package_id` -> `[namespaceKey, packageId]`; true. `by_namespace_package_digest` -> `[namespaceKey, packageDigest]`; true. `by_namespace_staging_generation` -> `[namespaceKey, stagingGenerationId]`; true |
| `migration_state` (v1) | `[namespaceKey, migrationId]` | `by_namespace_phase` -> `[namespaceKey, phase]`; false |
| `attachment_state` (v1) | `[namespaceKey, generationId, attachmentId]` | `by_namespace_generation_sync` -> `[namespaceKey, generationId, syncState]`; false. `by_namespace_generation_updated` -> `[namespaceKey, generationId, updatedAt]`; false |
| `writer_coordination_state` (v4) | out-of-line key | none |

`CONFIRMED_SOURCE_FACT`: `createLocalDatabaseSchema()` accepts only historical versions 0, 1, 2, and 3. Version 2 adds the three outbox indexes; version 3 adds the three restore-session indexes; version 4 adds only `writer_coordination_state`. Upgrades from v1, v2, or v3 update existing `database_meta.databaseFormatVersion` rows to v4.

`CONFIRMED_SOURCE_FACT`: `openLocalDatabase()` uses `OPEN_BLOCKED`, verifies the opened schema/version strictly, and closes stale connections on `versionchange`.

`OWNER_DECISION_REQUIRED`: these exact current facts do not select the K-334 database topology, co-location boundary, or next version.

## 6. K-333 record-family persistence inventory

| Family | Current source fact | Future persistence consequence |
|---|---|---|
| `WriterIdentityRecord` / `WriterSessionRecord` | strict canonical K-333 values with no durable repository/caller | no durable adoption/context/capability policy exists |
| `OperationRecord`, `AdmissionRecord`, `ImmutableOutboxIntentRecord` | K-333B pure canonical values bound to exact operation commitment | immutable evidence candidates for an initial authority commit |
| `TerminalStateRecord` | pure canonical value bound to exact operation commitment | later immutable terminal evidence; its runtime creation timing is not defined today |
| `SourceAuthorityRecord` | strict value binding source revision and operation/terminal/outbox roots | immutable authority snapshot only when its cited evidence exists and validates |
| `SourceTransactionReferenceRecord` | strict value binding authority, operation, admission, writer/session, terminal/outbox, MMR/checkpoint roots | current graph validates supplied complete records; it does not define an initial-versus-final runtime staging family |
| selection / compatibility material | K-329 owns canonical manifest bytes/digest; K-333 owns protocol tuples | no durable resolver or selected-history repository exists |

`CONFIRMED_SOURCE_FACT`: current K-333 validators validate supplied graph values; they do not persist or stage them. `OWNER_DECISION_REQUIRED`: no document currently fixes whether an initial immutable reference, a later finalized reference, or both are required. No new record family is inferred.

## 7. K-333F accepted-event rules and durable consequences

| Action / state | Potential durable form and binding | Acceptance constraint | Effective-selection result | Unresolved-policy / prohibited inference |
|---|---|---|---|---|
| `SELECT` | immutable accepted event for the exact subject; predecessor absent; genesis sequence | genesis only and no accepted predecessor/history; never reactivates after revocation | establishes one active selection | issuer authorization is owner-governed; a later row, timestamp, or cache cannot make it accepted |
| `SUPERSEDE` | immutable accepted exact-subject successor | exact current predecessor and next sequence; target digest absent from complete accepted lineage | establishes active selection | generic issuer and effective-boundary policy remain owner decisions; historical target cannot be relabeled as supersede |
| `ROLLBACK_DECISION` | immutable accepted exact-subject successor | exact current predecessor and next sequence; target present in complete accepted lineage; rollback-specific authorization in addition to generic authorization | establishes active selection using historical digest | novel target cannot be relabeled as rollback; no database rollback is implied |
| `REVOKE` | immutable accepted exact-subject successor | exact current predecessor, next sequence, and authorization | `NO_EFFECTIVE_SELECTION`; no manifest target | later reactivation uses supersede or rollback from lineage membership, never a new select |
| `RESTORE_REFERENCE` | non-authoritative metadata, if retained | exact reference validation only; no lifecycle sequence | none | cannot select a manifest, advance a head, or issue lifecycle authority |
| unknown lineage membership | no event | incomplete, forked, unavailable, unsupported, corrupt, or otherwise unknown history fails closed | none | never default to supersede or rollback |

`CONTRACT_INFERENCE`: an accepted event would be immutable authority evidence; a materialized head is only a bound projection; indexes are reconstructible; diagnostics are non-authoritative. No timestamp/latest-row authority is permitted.

## 8. Persistence topology options

| Option | Fact or inference | Verdict |
|---|---|---|
| A. Additive stores in `absinthe-local-v2` | Potential future same-database transaction with dormant local-first entity/outbox stores. It cannot atomically include current `absinthe-notes-v1` mutations, current `notes-v2` localStorage fallback writes, K-328's separate DB, attachment DBs, or remote Supabase state. | `CONTRACT_INFERENCE`: not selected. It does not solve current Notes atomicity; it becomes relevant only after separately reviewed source migration/integration. |
| B. Dedicated protocol authority DB | Isolates records/upgrades but cannot atomically include current Notes or K-330. | Not selected; explicit durable-intent/reconciliation would be required. |
| C. Extend K-330 envelope | K-330 is one bounded whole-envelope coordination model. K-333 history is append-only and unbounded by that envelope's model. | `CONTRACT_INFERENCE`: not selected because whole-envelope rewrite, contention, authority duplication, and responsibility confusion would require a new reviewed contract. This is not a permanent owner prohibition. |
| D. Event log plus derived views | Separates immutable accepted history from rebuildable views; native atomicity remains database-local. | Candidate only after decisions. |
| E. No implementation | Preserves boundaries. | Selected K-334A outcome. |

`CONFIRMED_SOURCE_FACT`: IndexedDB has no native cross-database transaction, and localStorage is not in an IndexedDB transaction. Any contrary claim is `CROSS_DATABASE_ATOMICITY_IMPOSSIBLE`.

## 9. Exact-operation lifecycle staging and SourceTransactionReference timing

| Stage | Required boundary | Status |
|---|---|---|
| A. Initial linear authority commit | K-332 requires one future linearizable boundary for generic admission, current scope/session/epoch, expected source revision, source mutation, immutable outbox intent, next source revision, and immutable receipt. Immutable operation/admission/outbox evidence available at that stage must agree with that commit. | CONFIRMED_SOURCE_FACT for the K-332 requirement; concrete stores/topology remain deferred. Terminal outcome is not assumed known. |
| B. Later terminal transition / reconciliation | terminal evidence may follow completion, failure, cancellation, delivery, or reconciliation. It must bind `exactOperationDigest`, independently verify immutable initial authority, never rewrite initial operation, and use its own reviewed transaction/reconciliation boundary. Restart must distinguish missing terminal evidence from false terminal state. | CONTRACT_INFERENCE from K-332's reconciliation restriction and K-333B record graph; no implementation exists. |
| C. Cross-database durable intent | separately committed facts are permitted only under an explicit durable-intent and reconciliation contract. | OWNER_DECISION_REQUIRED; best-effort separate commits are not atomic. |

`OWNER_DECISION_REQUIRED`: the current supplied-record graph does not select a runtime instant for `SourceTransactionReferenceRecord`. An initial immutable reference and/or a later finalized reference must be specified by a future approved staging contract; no timing is invented here.

## 10. Lifecycle-aware atomic transaction matrix

| Facts / crash window | Classification | Exact condition |
|---|---|---|
| current legacy Notes IndexedDB write | NOT_REQUIRED | existing legacy path is outside a K-334 authority contract; it does not establish K-333 authority |
| current `notes-v2` fallback write | NOT_REQUIRED | localStorage is a separate legacy fallback path, not a native transaction participant |
| dormant local-first entity + local outbox | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION | existing `commitLocalMutation()` joins its participating local-v2 stores |
| initial source operation authority commit | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION | when K-332's source mutation, revision, admission, immutable outbox intent, receipt, and stage-A evidence share one selected future database boundary |
| later terminal reconciliation | MAY_COMMIT_SEPARATELY_WITH_DURABLE_INTENT | only after independently verifying initial immutable authority and binding terminal evidence to `exactOperationDigest` |
| accepted selection event + predecessor/head comparison | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION | when issuing an accepted successor: exact subject, current predecessor, next sequence, and event must linearize together |
| optional materialized head update | MUST_COMMIT_IN_ONE_NATIVE_TRANSACTION | if retained, write it with its accepted event; history remains authority and view must be revalidated |
| history-derived indexes | DERIVED_AFTER_COMMIT | indexes rebuild from validated immutable history and never become authority |
| K-330 coordination envelope | READ_ONLY_REFERENCE | unless a later approved topology makes it a participant; K-330 cannot silently become K-333 authority |
| K-328 handoff authority | READ_ONLY_REFERENCE | strict revalidation only; it is not selection authority |
| attachment metadata/blob state | CROSS_DATABASE_ATOMICITY_IMPOSSIBLE | attachment stores are separate from a prospective authority database; references only are in scope |
| restore/bootstrap markers | MAY_COMMIT_SEPARATELY_WITH_DURABLE_INTENT | only under later reviewed binding/reconciliation; neither may issue selection history |
| cross-database relationships | CROSS_DATABASE_ATOMICITY_IMPOSSIBLE | a native all-or-nothing commit is unavailable; require approved durable intent or do not proceed |
| owner policy / unresolved lifecycle choices | OWNER_DECISION_REQUIRED | absence blocks accepted-event issuance; it does not select a default |

## 11. Migration authority and version status

`CONFIRMED_SOURCE_FACT`: K-334 is the confirmed migration authority for additive persistent stores/indexes, schema migration, persistent version storage, strict repository boundary reads, and native IndexedDB transaction implementation.

`OWNER_DECISION_REQUIRED`: target database/topology, source co-location, concrete next database version, exact stores/indexes, upgrade sequencing, lifecycle/retention schema needs, cross-database durable intent, and implementation-gate approval remain unresolved.

`MIGRATION_VERSION_OWNER_DECISION_REQUIRED` means no concrete next version is selectable before the owner-selected database/topology and schema shape are approved; it does not mean K-334's responsibility is unknown.

## 12. Owner-decision matrix

Every entry below has independent status, owner, persistence, planning, issuance, implementation, safe-default, and prohibited-assumption fields. `Absinthe Protocol Owner` is an external approval authority; no row records an approval.

### 1. Generic issuer authorization

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner, and the future Manifest Selection and History Authority is only proposed.
- **Persistence consequence:** determines whether a proposed lifecycle event may enter immutable accepted history; storage must not encode a default issuer policy.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; a non-accepting append-only envelope may be discussed, but no accepted-event write contract is final.
- **Issuance effect:** `BLOCKS_ACCEPTED_EVENT_ISSUANCE`.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION`.
- **Safe unresolved behavior:** issue no accepted lifecycle event; preserve supplied evidence/diagnostics without selecting a default issuer.
- **Prohibited assumption:** possession of a valid digest, sequence, predecessor, or persisted record implies issuer authority.

### 2. Rollback-specific authorization

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner, and the future Manifest Selection and History Authority is only proposed.
- **Persistence consequence:** determines whether a lineage-present historical target may be accepted as `ROLLBACK_DECISION`; generic issuer authorization alone is insufficient.
- **Planning effect:** `DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`.
- **Issuance effect:** `BLOCKS_ONLY_ROLLBACK_DECISION_ISSUANCE`.
- **Implementation effect:** `BLOCKS_ONLY_SPECIFIC_FEATURE_IMPLEMENTATION` for rollback acceptance.
- **Safe unresolved behavior:** reject rollback; preserve evidence; do not relabel it as `SUPERSEDE`.
- **Prohibited assumption:** generic issuer authorization automatically grants rollback authority.

### 3. Generation termination

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner.
- **Persistence consequence:** determines whether terminal generation evidence may be retained as lifecycle authority and how it affects accepted history.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; lifecycle-specific terminal shape cannot be finalized.
- **Issuance effect:** `BLOCKS_ONLY_GENERATION_LIFECYCLE_ISSUANCE`.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for termination handling.
- **Safe unresolved behavior:** infer no termination and do not rewrite or end an existing lineage.
- **Prohibited assumption:** a closed or missing runtime session automatically terminates a generation.

### 4. Generation inheritance

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner.
- **Persistence consequence:** determines whether any source/selection evidence may carry across generations and what exact binding is required.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; inheritance-specific links cannot be finalized.
- **Issuance effect:** `BLOCKS_ONLY_GENERATION_LIFECYCLE_ISSUANCE`.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for cross-generation carry-forward.
- **Safe unresolved behavior:** retain each generation as an exact independent subject; do not carry forward authority.
- **Prohibited assumption:** a successor generation inherits manifest selection or issuer authority by default.

### 5. History topology

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner, while future selection/history ownership is proposed only.
- **Persistence consequence:** determines accepted lineage shape, predecessor cardinality, and whether topology beyond the current linear contract may be represented.
- **Planning effect:** `BLOCKS_NEUTRAL_SCHEMA_PLANNING` for policy-dependent lineage keys, predecessor constraints, and indexes.
- **Issuance effect:** `BLOCKS_ACCEPTED_EVENT_ISSUANCE` until accepted-history shape is owner-approved.
- **Implementation effect:** `BLOCKS_SCHEMA_AND_REPOSITORY_IMPLEMENTATION` for accepted history.
- **Safe unresolved behavior:** retain no authoritative topology/head beyond existing pure-contract evidence; derive no selection.
- **Prohibited assumption:** latest timestamp, insertion order, or database key order defines authoritative lineage.

### 6. History retention

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner.
- **Persistence consequence:** determines whether accepted events may be compacted, archived, or deleted; no deletion/compaction policy may be inferred.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; an append-only form may be described, but compaction/deletion shape cannot be finalized.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY`.
- **Implementation effect:** `BLOCKS_COMPACTION_AND_DELETION_IMPLEMENTATION`.
- **Safe unresolved behavior:** retain referenced accepted evidence; do not compact, archive destructively, or delete.
- **Prohibited assumption:** old accepted events may be deleted because a current head exists.

### 7. Fork resolution

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner.
- **Persistence consequence:** determines whether a fork remains permanently blocked or can later be resolved by explicit event/policy.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; conflict evidence can be described, but a resolution representation cannot be finalized.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY`; unresolved forked history itself derives no valid selection.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for fork resolution.
- **Safe unresolved behavior:** preserve every branch and diagnostic, derive no winner, and issue no authority from the fork.
- **Prohibited assumption:** last write, latest timestamp, or lexicographically smallest digest resolves a fork.

### 8. Concurrent-successor conflict resolution

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner.
- **Persistence consequence:** determines the final policy for competing successors that share a predecessor after preserving evidence.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; transaction-time conflict detection can be described, but a winner policy cannot be finalized.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY`; competing successors must fail closed rather than choose a winner.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for conflict resolution.
- **Safe unresolved behavior:** reject or hold competing successors, preserve both proposals/evidence, and select no winner.
- **Prohibited assumption:** IndexedDB commit order or first observed successor is the authoritative winner.

### 9. Compatibility combinations

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner, and the future Cross-Protocol Compatibility Authority is proposed only.
- **Persistence consequence:** determines which version tuples may be accepted and which historical decoders/metadata must remain available.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; version fields may be discussed, but supported combinations cannot be finalized.
- **Issuance effect:** `BLOCKS_ACCEPTED_EVENT_ISSUANCE` for unsupported or unapproved combinations.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for compatibility enforcement.
- **Safe unresolved behavior:** reject unknown or mixed combinations; preserve evidence without inferring a compatibility edge.
- **Prohibited assumption:** successful decoding or matching version numbers imply compatibility.

### 10. Retrospective invalidation

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; external approval authority is the Absinthe Protocol Owner.
- **Persistence consequence:** determines whether later policy can affect prior accepted evidence while preserving immutable history.
- **Planning effect:** `LIMITS_BUT_DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING`; invalidation-specific representation cannot be finalized.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY`.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for invalidation processing.
- **Safe unresolved behavior:** do not delete, rewrite, or retroactively alter accepted authority.
- **Prohibited assumption:** a newly approved policy silently invalidates historical accepted events.

### 11. External-boundary mapping

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** `OWNER_DECISION_REQUIRED`; the Absinthe Protocol Owner is the external approval authority named by K-333F.
- **Persistence consequence:** determines how a selection event/sequence may bind to external session, operation, transaction, or effective boundary evidence.
- **Planning effect:** `DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING` for isolated evidence bytes; it blocks mapping-specific contract finalization.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY` for downstream use.
- **Implementation effect:** `BLOCKS_POLICY_DEPENDENT_IMPLEMENTATION` for external integration.
- **Safe unresolved behavior:** retain no inferred mapping and reject downstream authority use that lacks an explicit binding.
- **Prohibited assumption:** remote user, account, or session identity is automatically equivalent to a local protocol subject or issuer.

### 12. Implementation-gate approval

- **Status:** `OWNER_DECISION_REQUIRED`.
- **Owner:** Absinthe Protocol Owner, acting only as external approval authority; no approval evidence is present.
- **Persistence consequence:** determines whether an approved contract can move from documentation to production repository work; it creates no runtime record by itself.
- **Planning effect:** `DOES_NOT_BLOCK_NEUTRAL_SCHEMA_PLANNING` or proposal work.
- **Issuance effect:** `BLOCKS_ALL_PRODUCTION_ISSUANCE`.
- **Implementation effect:** `BLOCKS_ALL_PRODUCTION_IMPLEMENTATION`.
- **Safe unresolved behavior:** preserve documentation-only scope and do not implement production writes.
- **Prohibited assumption:** merged documentation, passing CI, or a review pass authorizes production implementation.

`OWNER_DECISION_REQUIRED`: the matrix is an approval gate, not approval evidence. The planning fields distinguish neutral analysis from policy-dependent schema selection; all accepted-event and production-write claims remain fail closed.

## 13. History, restore, concurrency, and failure boundaries

`CONTRACT_INFERENCE`: immutable accepted history is potential authority evidence; materialized heads are bound projections; indexes are reconstructible; diagnostics and `RESTORE_REFERENCE` are non-authoritative. Backup, migration, restore, hydration, or persistence success grants no authority.

`CONFIRMED_SOURCE_FACT`: K-330 uses a one-store CAS envelope and K-328 uses strict atomic handoff writes, but neither selects a K-333 concurrency mechanism. A Web Lock cannot replace transaction-time comparison or provide durability.

`CONTRACT_INFERENCE`: stage-A restart must validate whether the initial commit exists. Stage-B restart must treat missing terminal evidence as missing, not terminal false; terminal reconciliation must revalidate initial authority. No resource ceiling, retention period, compaction model, or browser-crash mechanism is added here.

## 14. Corrected K-334 sequence

1. **K-334B - Owner-Decision Proposal and Explicit Approval Evidence.** Prepare alternatives and recommendations, then record explicit Absinthe Protocol Owner approval or unresolved status. No schema implementation.
2. **K-334C - Durable Schema and Migration Contract.** After sufficient K-334B approval, select topology/database, candidate stores/indexes/keys, concrete migration/version and transaction groups. No production repository implementation unless separately authorized.
3. **K-334D - Append-Only Protocol Evidence Repository.**
4. **K-334E - Atomic Initial Operation Authority Repository.**
5. **K-334F - Terminal Reconciliation and Final Reference Repository.**
6. **K-334G - Selection-History and Head Projection Repository.**
7. **K-334H - Bootstrap, Restore-Reference, and Recovery Contract.**
8. **K-334I - Concurrency, Crash, Quota, and Real-Browser Evidence.**

`DEFERRED`: later integration remains K-331 writer instrumentation, K-328/K-329 adapters, shadow-mode consumer, eligibility, and activation. Owner approval and schema work are deliberately separate.

## 15. Production integration blockers

`CONFIRMED_SOURCE_FACT`: K-333 has no production persistence caller; K-328/K-330 remain dormant; K-331 instrumentation is architecture-only.

`OWNER_DECISION_REQUIRED`: no production integration is permitted before explicit policy approval, selected topology/intent contract, repository implementation, real-browser evidence, later writer integration, admission, shadow verification, eligibility, and activation reviews.

## 16. Validation evidence

`CONFIRMED_SOURCE_FACT`: this source-facts document is grounded in the bounded files cited above. Focused K-328/K-325/recovery, K-329/K-330/K-332/K-333, protocol-bundle, typecheck, build, and diff validation are required before publication. A CRLF/LF-sensitive K-333 mutation-anchor failure remains non-blocking only if its source/test blobs are unchanged from the base; no test/source change is justified by this audit.

## 17. Final invariant

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
