# REL-05G exact-original Health identity provenance feasibility

Task: `REL_05G_HEALTH_ID_EXACT_ORIGINAL_PROVENANCE_FEASIBILITY_CHARACTERIZATION_01`

Status: `PROVENANCE_FEASIBILITY_CHARACTERIZATION_COMPLETE_PENDING_INDEPENDENT_REVIEW`

Result: `NO_CURRENT_RETROACTIVE_TRUSTED_SOURCE_FOUND` in the repository-defined production contracts. Matching old values can corroborate a candidate; they do not establish `PROVEN_EXACT_ORIGINAL_ID`. Policy F's denial/escalation branch remains the only supported truth for an incident without independently proven original identity. This is a source/contract characterization, not an incident investigation, recovery procedure, implementation plan, or capability approval.

## 1. Exact merged baseline and evidence boundary

| Item | Verified baseline |
| --- | --- |
| Repository/workspace | `Absinthe-6785/Absinthe`; `C:\Users\이도현\GitRepos\Absinthe` |
| PR #766 | `MERGED / CLOSED`; reviewed approval head `2637f39c89c5f19c1aa30fc71319bac678ac7baf` |
| PR #766 merge / live main | `4db0c58ee97b324163e596a70d967f113069eb7b` |
| Post-merge push CI | [38037177324](https://github.com/Absinthe-6785/Absinthe/actions/runs/38037177324), exact main above; completed/success |
| Required jobs | `test`, `typecheck`, `build`, `backend-rel05g1`, `backend-recovery`: all completed/success |
| Observation date | 2026-10-10 |
| Publication scope | One new Markdown file on a dedicated branch, new Draft PR; independent review pending |

The [merged recovery contract](REL-05G-health-parent-established-identity-recovery-contract-and-product-decision.md) is authoritative. The following were also read in full: [parent identity characterization](REL-05G-health-parent-established-device-id-correction-characterization.md), [E3 feasibility](REL-05G-workout-device-lifetime-e3-controlled-platform-procedure-feasibility.md), [admission/writer-safe routing](REL-05G-workout-device-lifetime-admission-evidence-and-writer-safe-routing-characterization.md), [bootstrap prerequisite](REL-05G-workout-device-lifetime-bootstrap-admission-prerequisite.md), [device-lifetime authority contract](REL-05G-workout-device-lifetime-authority-contract-and-plan.md), and [human-assisted qualification protocol](REL-05G-workout-device-lifetime-human-assisted-physical-qualification-protocol.md). Their publication-time review/status text does not supersede PR #766's verified merged state or imply runtime closure.

No real localStorage, IndexedDB, Supabase user row, backup, browser profile, support record, or physical device was read. No synthetic probe was needed. Statements about persisted records describe schemas and supported code paths, not observed records in a user's installation. Current deployed database population and external operational archives are unobserved. A contract capable of retaining a value is not evidence that such a record exists for a particular incident.

## 2. Approved Policy F requirement, unchanged

`APPROVED_POLICY = POLICY_F_PROVEN_ORIGINAL_OPERATOR_CONDITIONAL_NO_NEW_TARGET`

| Approved decision | Preserved selection |
| --- | --- |
| HEALTH-ID-PD01-A | `B_PROVEN_EXACT_ORIGINAL_OR_DENY_ESCALATE` |
| HEALTH-ID-PD02-A | `NO_AUTOMATIC_REPLACEMENT` |
| HEALTH-ID-PD03-A | `NARROW_CURRENT_ACTIVE_GENERATION_WITH_PROVEN_EXACT_ID_AND_UNCHANGED_WRITERS` |
| HEALTH-ID-PD05-A | `A_NO_NEW_TARGET_RECOVERY_IN_THIS_WORKSTREAM` |
| HEALTH-ID-PD06-A | `CONDITIONAL_INTERNAL_OPERATOR_ONLY_NO_CURRENT_EXECUTION_END_USER_SELF_SERVICE_DEFERRED` |
| HEALTH-ID-PD07-A | `TYPED_LOCAL_RECOVERY_REQUIRED_UNAVAILABLE_CONDITIONAL_ASSISTED` |
| HEALTH-ID-PD08-A | `ONE_MANUAL_RETRY_PER_TRANSIENT_EPISODE_NONE_FOR_UNCHANGED_DETERMINISTIC_FAILURE_FRESH_READ_AFTER_AUTHORIZED_CORRECTION` |
| HEALTH-ID-PD09-A | `PROVENANCE_FEASIBILITY_FIRST_FOR_CONTROLLED_OPERATOR_PATH_REMAIN_UNSUPPORTED_UNTIL_QUALIFIED` |

None is reopened. Exact compatible safe non-UUID and mixed-case identity, no retroactive normalization/rekeying/rejection, and the admitted evidence episode envelope remain inherited constraints. Also retained: no fabrication/guessing/orphaning; malformed is not missing; role/creator firewall; read reachability and pending-request immutability; authentic procedures; unavailable is not empty and #763 partial truth is not a distrust waiver; finite retry; complete creator ownership rather than a lock/checkbox/timeout proof; and separate reviewed implementation/merge gates.

## 3. Proof standard

A sufficient single source, or independently justified combination, must prove all ten properties:

1. Exact device-ID bytes, using the same representation as the original supported identifier.
2. Exact case; case-folded UUID value equality is not exact namespace identity equality.
3. Historical precedence before the corruption/recovery event, not just before inspection.
4. Binding to the same user/account scope, including the account at historical issuance.
5. Binding to the same origin/storage installation, or a specifically justified equivalent scope. Project name, account, URL, device label, and browser version alone are insufficient.
6. Authenticity/integrity strong enough to exclude guessed or operator/user-fabricated candidates.
7. History/freshness semantics distinguishing original issuance, replacement, another device, another profile/container, and copied/rolled-back state.
8. No circular derivation from the corrupted or replacement state being repaired.
9. No post-incident self-issued record promoted to pre-incident proof.
10. A reviewable trust chain covering issuer, collection, custody, verification, scope, precedence, ambiguity, and incident applicability.

An authentic server's statement that an authenticated account submitted a device claim is narrower than a statement that it was the original ID of this storage installation. Content hashes, ordinary schema validation, transactional writes, and application-level immutability are useful consistency controls, not independent historical authenticity.

Synthetic example only: exact strings `AbCd0000-0000-4000-8000-000000000001` and `abcd0000-0000-4000-8000-000000000001` differ. A matching namespace hash for the first is evidence of tuple consistency; it does not prove which string was originally issued, or that this is the affected container.

## 4. Complete source inventory and tracing method

Repository-wide `rg` searches were repeated at this baseline, not inherited as a complete inventory. All requested terms were searched: `HEALTH_ROUTINE_DEVICE_ID_KEY`, `absinthe-health-routine-device-id:v1`, `deviceId`, `device_id`, `namespaceFingerprint`, `namespace_fingerprint`, `lifetimeId`, `authorityEpoch`, `generation`, `outbox`, `receipt`, `checkpoint`, `backup`, `snapshot`, `export`, `restore`, `vault`, `provenance`. Dependencies/build output/cache directories were excluded. Broad production-source matches were triaged by identity dataflow rather than treating every TypeScript `export` declaration as an identity export. Identity-specific matches in non-test `frontend/src` and `backend` covered 37 files. Backup/import/snapshot serializers, callers, and the standalone qualification boundary were additionally traced even where no identity term matched.

| Source family / inspected anchors | Identity/evidence path and ceiling |
| --- | --- |
| [workoutLocalReaderAuthority.ts](../src/lib/workoutLocalReaderAuthority.ts), L2-L22 | Mirror key; creator returns accepted exact bytes or creates a replacement UUID; established reader distinguishes invalid-present from absent but absent calls creator. No history issuer. |
| [healthRoutineSync.ts](../src/lib/healthRoutineSync.ts), L114, L135-L138, L769-L818, L824-L883 | Worker/context ID, account-cached session, routine state snapshot/recovery/export-adjacent persistence. No original-ID ledger. |
| [workoutRuntimeAuthority.ts](../src/lib/workoutRuntimeAuthority.ts), L84-L117, L144-L187 | Account/attempt/current-ID checks; creator/open/init/discovery. Control-plane currentness, not historic installation attestation. |
| [selected-day reader](../src/lib/workoutSelectedDayReader.ts), [range reader](../src/lib/workoutRangeReader.ts), [selected-day owner](../src/components/views/features/health/useHealthSelectedDayComposite.ts), [verified range snapshot](../src/components/views/features/health/verifiedWorkoutRangeSnapshot.ts) | Helper uses at selected-day L37; range L37/L75/L80; owner L139/L222; snapshot L225. Exact current-ID comparisons, owner tokens and published scopes, not durable history. |
| [workoutDeviceLifetimeAuthority.ts](../src/lib/workoutDeviceLifetimeAuthority.ts), L5-L8, L35-L43, L146-L378 | Dormant READY/prepared/adoption records and in-memory tokens. Production helper/runtime/reader callers do not route through this foundation. |
| [namespace.ts](../src/lib/localDatabase/namespace.ts), [schema.ts](../src/lib/localDatabase/schema.ts), [types.ts](../src/lib/localDatabase/types.ts), [validation.ts](../src/lib/localDatabase/validation.ts) | Exact tuple validation, SHA-256 fingerprint, v7 stores/keyPaths, record validation. No provenance-issuer store. |
| [repository.ts](../src/lib/localDatabase/repository.ts), L421-L489, L1116, L1255-L1272, L1694, L1836, L2476-L2503, L3353-L3405, L4502-L4524 | Frozen runtime namespace; writable local metadata, literal outbox/adoption/authority/reset scope; ACK/conflict/checkpoint metadata; normal open/init can create/upgrade evidence. |
| [outboxIdentity.ts](../src/lib/localDatabase/outboxIdentity.ts), [k323V2Transport.ts](../src/lib/localDatabase/k323V2Transport.ts) | Deterministic mutation/idempotency identities; literal device request/context; receipt lacks a device field, acknowledgement associates it with local outbox. |
| [workoutRemoteClient.ts](../src/lib/workoutRemoteClient.ts), [Push](../src/lib/workoutRemotePush.ts), [Pull](../src/lib/workoutRemotePull.ts), [Pull protocol](../src/lib/workoutRemotePullProtocol.ts), [Contract](../src/lib/workoutRemoteContract.ts), [Reset](../src/lib/workoutRemoteReset.ts) | Exact claimed device in discovery/binding/request/query/reset scope; digest/CAS/epoch/currentness and fixed-watermark safeguards. No original-creation assertion. |
| [workoutAdoption/types.ts](../src/lib/workoutAdoption/types.ts), L25-L50 | Session literal device/account/project/generation plus snapshot digests and local timestamps; source-content adoption is not original-device issuance. |
| [legacyNotesAuthority.ts](../src/lib/localDatabase/legacyNotesAuthority.ts), L20-L61/L136-L162/L287-L320; [localFirstCutover.ts](../src/lib/localDatabase/localFirstCutover.ts); [dormantWriterCoordinationRepository.ts](../src/lib/localDatabase/dormantWriterCoordinationRepository.ts); cross-context [identity](../src/lib/localDatabase/crossContextHandoff/identity.ts), [records](../src/lib/localDatabase/crossContextHandoff/records.ts), [types](../src/lib/localDatabase/crossContextHandoff/types.ts) | Separate Notes source-root/operator-binding and logical-scope records can retain device literals. Locally recomputable digests and supplied scope, not a historical issuer of the Health mirror. Notes migration ownership must not be promoted across domains. |
| [localDatabase/restore.ts](../src/lib/localDatabase/restore.ts), L28-L41/L155-L161/L191-L225 | Notes-only package: namespace/project fingerprints, export time, content digest; no literal original Health ID or signature. |
| [vaultRestorePipeline.ts](../src/lib/vaultRestorePipeline.ts), [exportVaultBackup.ts](../src/lib/exportVaultBackup.ts), [vaultPortableExtensions.ts](../src/lib/vaultPortableExtensions.ts), [vaultSnapshotBuild.ts](../src/lib/vaultSnapshotBuild.ts), [vaultSnapshotScope.ts](../src/lib/vaultSnapshotScope.ts), [vaultSnapshotFingerprint.ts](../src/lib/vaultSnapshotFingerprint.ts) | Actual portable Health fields/Notes content/cloud block; no dedicated Health device-mirror/history serialization. |
| [vaultCloudExport.ts](../src/lib/vaultCloudExport.ts), [vaultCloudRestore.ts](../src/lib/vaultCloudRestore.ts), [vaultExtensionApply.ts](../src/lib/vaultExtensionApply.ts), [vaultExportValidate.ts](../src/lib/vaultExportValidate.ts), [vaultSnapshotValidate.ts](../src/lib/vaultSnapshotValidate.ts), [storageInventory.ts](../src/lib/storageInventory.ts), [export diagnostic](../src/lib/localBackupManifestExportDiagnostic.ts) | Account data fetch/restore, checksum/shape checks, size inventory and diagnostics do not add an authenticated identity-history envelope. |
| [backend/main.py](../../backend/main.py), L125-L153/L617-L621/L893-L969/L1828-L1843; [backup_stream.py](../../backend/backup_stream.py) | JWT-authenticated owner, account-filtered legacy rows, ordinary JSON/ZIP exports. Backup table allowlist excludes remote receipt/generation-binding ledgers. |
| [remote_mutation.py](../../backend/remote_mutation.py), [remote_mutation_v2.py](../../backend/remote_mutation_v2.py), [workout_remote_authority.py](../../backend/workout_remote_authority.py) | Validated caller identity, authenticated owner, server request digest and RPC parameter mapping. No independent browser-installation issuer. |
| K323 [receipt schema](../../backend/migrations/202607120001_k323_idempotent_remote_mutation.sql), [v2 additions](../../backend/migrations/202609180001_k323_v2_multi_domain_transport.sql), [Health aggregate](../../backend/migrations/202609190001_rel05f_health_routine_aggregate.sql), [Workout foundation](../../backend/migrations/202609230001_rel05g1_workout_dormant_foundation.sql), [G4A](../../backend/migrations/202609240001_rel05g4a_workout_authority_transport.sql), [UUID correction](../../backend/migrations/202609270001_rel05g4b1_workout_tombstone_uuid_value.sql), [G4C reset](../../backend/migrations/202609280001_rel05g4c_workout_remote_reset.sql) | Server account/history and literal device claims in receipts/bindings/reset scopes; changes/current canonical records are not an original-installation registry. |
| [isolated qualification core](../qualification/rel05g-patha/core.mjs), L1-L9; protocol/evidence documentation | Synthetic namespace/tokens; production mirror/authority/adoption keys are denied. Track A artifacts do not contain a proven original production identity. |

This closes the repository-defined identity paths, not unknown private infrastructure. Arbitrary Notes text, generic payload properties, debug output, or copied browser files might incidentally contain an ID, but have no guaranteed original-identity field/issuance semantics. External logs are explicitly `UNKNOWN_EXTERNAL_OPERATIONAL_SOURCE`, not available provenance. No logging-retention or support access was assumed from a schema name or a platform's possible capabilities.

## 5. Current local sources

### A. Current mirror

The Health mirror stores a single exact string, no account, issuer, timestamp, version history, previous value or authenticated installation identifier. The existing creator's shape check is case-insensitive and returns accepted strings unchanged. It is not a historical UUID migration/normalization policy. Malformed bytes can classify a present-invalid failure; they cannot authenticate missing valid predecessor bytes. A valid-looking replacement or another profile's copied value can be indistinguishable from an original by shape alone.

`CURRENT_MIRROR_AS_HISTORICAL_ISSUER = CURRENT_STATE_ONLY`

### B. Database namespace metadata

[namespace.ts L32-L36](../src/lib/localDatabase/namespace.ts) hashes UTF-8 JSON of `[userId, projectRef, deviceId, schemaVersion]` with SHA-256; generation is not in that tuple. Metadata stores the fingerprint/key, active generation, local creation time and schema/compatibility fields, not a reversible device literal. There is no decoder. High-entropy unknown IDs are not practically recoverable by inverting this hash; supplied/enumerable candidates can be tested, including exact case variants. That is consistency checking, not authenticated original issuance, and not a claim of information-theoretic non-reversibility for low-entropy guesses.

One matching namespace does not rule out replacement, another installation with copied bytes, stale account metadata, or other namespaces that were deleted or never initialized. Many historical/device/account namespaces are legitimate. [Normal open/init](../src/lib/localDatabase/repository.ts) can create the database, upgrade v7 metadata, or initialize a candidate namespace; it is not a non-creating historical inspection procedure. This task did not execute it.

`NAMESPACE_METADATA_PROVENANCE = DERIVED_IDENTIFIER_ONLY`

### C. Outbox and local evidence adjuncts

[OutboxRecord](../src/lib/localDatabase/types.ts), L262-L305, has optional legacy `accountId`/`deviceId`; current [commitLocalMutation L1255-L1272](../src/lib/localDatabase/repository.ts) writes both literal values from the frozen namespace. Case is retained. The row also binds namespace/generation/mutation/entity/payload/hash/request/remote baseline/status/timestamps. Supported binding/push code preserves frozen request semantics; row status/lease/receipt fields change under repository operations. This is logical request immutability, not a signature or protection from same-origin code/DevTools/database tampering. Historical/generic restore outboxes can lack these optional literals; no mutation means no outbox; cleanup/loss can also remove evidence. Several account/device/generation lineages can exist. Never edit, rebase, replay or acknowledge pending work to create proof.

`OUTBOX_DEVICE_ID_PROVENANCE = UNAUTHENTICATED_CORROBORATION_ONLY`

Other literal-bearing local records include Workout adoption sessions, cached remote authority/discovery records and reset intents. Their local clock/digests/account fields establish claimed dataflow scope, not the mirror's original issuance. Remote entity-ID mappings and full-resync sessions primarily retain namespace/generation/account, epoch, snapshot/watermark/candidate evidence; these are synchronization evidence, not device history. A lease/`health-worker-${deviceId}` label can embed a claimed literal but is not an issuer. Notes legacy source authority and cutover plans copy the runtime namespace's device and use locally recomputable digests; `explicit_operator_binding`/`ownershipMode: authenticated` do not independently authenticate original Health bytes.

### D. Local ACK, checkpoint and conflict metadata

The v2 receipt response has mutation/idempotency/domain/entity/operation/payload hash, remote reference/revision/sequence/server commit time, outcome/error; no standalone device field ([k323V2Transport.ts L64-L81](../src/lib/localDatabase/k323V2Transport.ts)). ACK associates it with an exact local request/outbox. A locally persisted receipt association is not a signed transcript of original issuance; the distinct server ledger is assessed below.

[CheckpointRecord](../src/lib/localDatabase/types.ts), L306-L318, has namespace/generation and optional account plus provider/stream/value/sequence/epoch/update/invalidation, not a device literal. [ConflictRecord](../src/lib/localDatabase/types.ts), L322-L341, retains scoped candidates/remote metadata/local mutation identity/revision/hash; generic candidates may contain an incidental literal. Neither requires historical device-issuance evidence. Complete preservation of a remote candidate is necessary sync safety, not original-ID proof.

`CHECKPOINT_PROVENANCE = DERIVED_IDENTIFIER_ONLY`

`CONFLICT_PROVENANCE = UNAUTHENTICATED_CORROBORATION_ONLY`

### E. Dormant device-lifetime metadata

[Foundation L35-L43](../src/lib/workoutDeviceLifetimeAuthority.ts) stores READY `{format, phase, deviceId, lifetimeId}` or prepared/transitioning fields additionally describing kind, prior lifetime and prior mirror fingerprint. The adoption marker is only `{"format":1,"adoption":"started"}`. Exact ID/case is present in authority records; no account, creation timestamp, origin/container attestation, signed journal, or historical mirror chain is present. Prior mirror hash is not reversible history or an independently authenticated issuer.

First adoption can capture an accepted mirror; prepared recovery/fresh-create can choose a fresh UUID. These are not Policy F exact-original recovery. Records could precede a later incident only after adoption actually ran, with an independently established timeline; dormant source/tests do not establish current production issuance. No production helper/runtime/reader call was found routing through this factory. Local records remain page-writable, and the same storage clearing/copying/rollback risks apply. This foundation is at most an ingredient for separately reviewed prospective provenance, not enough by itself.

`DORMANT_LIFETIME_METADATA_PROVENANCE = PROSPECTIVE_FUTURE_PROVENANCE_ONLY`

### I. Browser-native history and J. cached session

The standard Storage interface exposes the current map. Storage mutation events carry old/new values to other applicable windows, but the API has no replayable persistent history query. Repository storage listeners update Notes/current UI, not a durable Health mirror audit. Therefore an unobserved past event cannot be recovered through a standard API after the fact. This is an inference from the specified interface/algorithms, not a universal claim about browser-internal forensic files. [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface), [StorageEvent](https://html.spec.whatwg.org/multipage/webstorage.html#the-storageevent-interface).

Storage keys/sheds separate storage scope; they do not provide an authenticated application installation-history identifier. Clearing/eviction can destroy records; persistence permission is not tamper-proof history. No physical profile inspection or persistence request was performed. [Storage Standard](https://storage.spec.whatwg.org/#storage-keys), [management](https://storage.spec.whatwg.org/#management).

`BROWSER_NATIVE_HISTORY_PROVENANCE = NOT_PRESENT` (standard persistent audit-history source).

[productionSessions L824-L850](../src/lib/healthRoutineSync.ts) caches a Promise per account. On creation it reads/creates the mirror before repository open, and the session holds the repository's exact frozen namespace. A surviving session might retain a value from before mirror corruption; its creation before an incident, originalness and container applicability are not independently authenticated. Success, rejection and in-flight promises can be cached; no explicit eviction occurs in this map. New document/module/browser lifetime loses this memory. Account A/B/A, competing tabs, same-byte ABA, cached failures and newer local scope can make apparent currentness misleading. No supported operator historical-export API exists; calling normal `snapshot()` can initialize and returns routine content, not a signed ID history. In-memory immutability is not an archival trust chain.

`CACHED_SESSION_PROVENANCE = CURRENT_STATE_ONLY`

## 6. Current remote/server sources

### F. Account authority versus original-device provenance

[backend/main.py L125-L153](../../backend/main.py) verifies the bearer JWT and uses its subject as owner; owner-scoped endpoints and RPC mapping restrict account operations. A validated token's `sub` identifies the represented user, not the original Health mirror or browser container. [Supabase JWT documentation](https://supabase.com/docs/guides/auth/jwts). This is account authority, not proof that the human owns a particular historic storage installation; token compromise is also a distinct risk.

Legacy `HealthRoutineCreate`/`WorkoutLogCreate` and account-filtered rows represent routine/day/content data. Their supported create models do not carry original creator-device/origin history. Routine preset/profile aggregates represent current account/domain state, not a mirror-issuance ledger. Arbitrary generic JSON or undeclared deployed columns are not guaranteed provenance fields. Schema inspection cannot attest production row existence.

There are nevertheless useful server-side literal claims:

- K323's [receipt ledger](../../backend/migrations/202607120001_k323_idempotent_remote_mutation.sql), L45-L94, stores authenticated owner/project/namespace/generation/request/mutation/result/server-time evidence and rejects ordinary update/delete. The [v2 addition](../../backend/migrations/202609180001_k323_v2_multi_domain_transport.sql), L7/L410-L420, stores caller `device_id` as text. [Health aggregate receipt insertion L461-L474](../../backend/migrations/202609190001_rel05f_health_routine_aggregate.sql) retains that exact claim. The generation table itself has namespace/generation/server creation time, not device literal; its registration response can echo the supplied device.
- [G4A generation bindings L29-L42/L140-L161/L319-L374](../../backend/migrations/202609240001_rel05g4a_workout_authority_transport.sql) retain exact text `device_id`, owner/project/domain/namespace/generation, binding UUID, epoch and server creation time. Registration validates a supplied tuple and immutably binds it under the contract; it does not observe initial browser mirror creation or authenticate origin/profile/storage installation. Ordinary role revocation/immutable triggers are stronger retention controls than local bytes, but privileged database custody is still a trust boundary.
- G4A receipt inserts (L606-L619) also retain the literal, bound epoch, server sequence/time, payload/request digests and result. Reset job/binding metadata concerns reset authority, not original local issuance. Workout data-plane remains unactivated; presence of schema/foundation does not prove any production record for an affected user.

A retrieved authenticated server ledger could establish that account A submitted exact D no later than server time T, subject to custody/integrity verification and incident precedence. That is valuable authenticated corroboration. It cannot distinguish an original D from a previously replaced D, a second device/profile, or a copied container presenting the same tuple. The server does not recompute a browser-installation trust binding from an independently issued container identity. An immutable log of an unverified client claim does not upgrade the claim's originalness. No privileged retrieval was attempted or authorized here.

`SUPABASE_ACCOUNT_AUTHORITY = AUTHENTICATED_CORROBORATION_ONLY` (authenticated account subject/ownership, not original device).

`SUPABASE_ORIGINAL_DEVICE_PROVENANCE = AUTHENTICATED_CORROBORATION_ONLY` (server receipt/binding claim when genuinely retained and authenticated; no sufficient original issuer found).

`RECEIPT_PROVENANCE = AUTHENTICATED_CORROBORATION_ONLY` for the authenticated server ledger; locally saved ACK/receipt association alone is `UNAUTHENTICATED_CORROBORATION_ONLY`.

### G. Requests, delivery binding, CAS and digests

[Remote client](../src/lib/workoutRemoteClient.ts) supplies exact repository device/account scope for registration/discovery. [Bound push L46-L75](../src/lib/workoutRemotePush.ts) uses the frozen outbox literal and binding; [pull query L42-L46](../src/lib/workoutRemotePull.ts) sends the claimed device/binding/epoch. CAS bases, request digests, idempotency/mutation IDs and own-echo evidence enforce remote request/sequence equivalence, not original installation identity. SHA-256-derived keys do not decode into a device; a literal-bearing request/receipt association can corroborate the candidate but was client-supplied. Several rows deriving from one client claim are not independent issuers.

The [server digest L600-L608](../../backend/remote_mutation_v2.py) includes authenticated owner and exact claimed device with namespace/generation and mutation semantics. Hashing binds request consistency, not browser origin attestation. HTTP/TLS/account authentication protects communication in context, not an unsigned transcript later supplied by a user. Epoch/generation change or valid replacement can produce legitimate newer claims; earliest server sighting is not necessarily first local issuance, particularly offline/local-only use.

`REMOTE_TRANSPORT_PROVENANCE = AUTHENTICATED_CORROBORATION_ONLY` for authenticated retained server association; local request/capture alone is unauthenticated corroboration, digest alone derived evidence. Unknown hosting/API/access logs remain `UNKNOWN_EXTERNAL_OPERATIONAL_SOURCE`. No unknown log contents, retention, privileges or availability are asserted.

## 7. Backup, export and support sources

### H. Actual portable formats

[VaultBackupManifest](../src/lib/exportVaultBackup.ts), L35-L72/L117-L160, contains Notes/folders, local `exportedAt`, app/schema/version, extensions/scope, optional cloud block and content fingerprint. [Portable Health fields](../src/lib/vaultPortableExtensions.ts), L16-L26/L82-L105, are routine preset state, split/planned sets/recovery log/protein preferences/drafts/memos. There is no dedicated mirror, authority/adoption history, IDB namespace/outbox/receipt ledger, or original-ID envelope. Incidental text containing an ID does not change that contract.

[Snapshots](../src/lib/vaultSnapshotBuild.ts) contain the same content/extensions plus random snapshot ID, slot and local creation time. [Fingerprint implementation](../src/lib/vaultSnapshotFingerprint.ts) is a recomputable 32-bit string hash for content dedupe/validation, not a signature, MAC, or trusted timestamp. JSON shape/checksum/restore-readiness validation is not issuer authentication. Files and local snapshots are writable/copied/re-timestamped; authentic in-transit cloud fetch does not authenticate an editable exported file as a historical artifact.

[Cloud export](../src/lib/vaultCloudExport.ts) carries account data and local `fetchedAt`/completeness/errors. Backend [JSON/ZIP backup allowlist](../../backend/backup_stream.py), L10-L22, includes legacy content tables, not remote mutation receipts or Workout generation bindings. Server-generated export time is an export timestamp, not device issuance, and the delivered file has no authenticated historical device envelope. Unknown extra deployed columns are not a promised source. Notes [RestorePackageV1](../src/lib/localDatabase/restore.ts) does carry namespace/project fingerprints and SHA-256 content digest, but not a literal original Health device or signed historical issuer. It is a separate Notes recovery package, not a Health mirror backup.

[Restore pipeline](../src/lib/vaultRestorePipeline.ts), L266-L277, restores routine content through `productionHealthRoutinePersistence.recover` under current account authority. This does not restore the Health mirror's old exact identity and can obtain/create a current cached session. Running restore to discover provenance would mutate state and is not authorized here.

`VAULT_BACKUP_PROVENANCE = UNUSABLE_FOR_ORIGINAL_ID_PROOF`

`EXPORT_PROVENANCE = UNUSABLE_FOR_ORIGINAL_ID_PROOF`

Formats exist; a dedicated authenticated original-Health-ID source does not. A copied value in content is at most unauthenticated corroboration. A separately authenticated historical archive would be a different source requiring its own chain; none is represented by the current formats.

### K. Human observation and operator/support systems

Memory or an operator-supplied candidate is `OPERATOR_SUPPLIED_UNTRUSTED_INPUT`. Screenshots, copied localStorage values, support transcripts and screen recordings are `UNAUTHENTICATED_CORROBORATION_ONLY` without independent authenticated custody/precedence/scope. They may preserve exact displayed/captured case, but can be edited, misattributed, post-incident, truncated, or copied from a different account/profile/origin. Operator attestation alone does not solve these ambiguities.

`HUMAN_ATTESTATION_PROVENANCE = OPERATOR_SUPPLIED_UNTRUSTED_INPUT` (media/transcript evidence has the narrower corroboration classification above).

A support tool displaying bytes, hashing a candidate, or reading an old outbox does not issue historical proof. No repository-defined independent support archive/issuer with pre-incident installation binding was found. Preexisting genuinely authenticated support records, if any, are unknown external sources, not permission to inspect them and not automatically sufficient. Operator privilege cannot manufacture a missing historical chain.

## 8. Source-by-source trust matrix

Classes below apply to exact-original proof, not to the usefulness of sync/recovery consistency checks. No current row is `AUTHORITATIVE_HISTORICAL_ISSUER`. A source could predate an incident without this source-only task proving that it did. Local account fields claim scope; a server-authenticated owner proves account submission, neither alone proves installation ownership. No row proves complete lifecycle/creator continuity.

| Candidate / primary class | Exact retained data / case | Account and origin/container binding | Timestamp/history; integrity/authenticity; mutation authority/controller |
| --- | --- | --- | --- |
| A mirror / `CURRENT_STATE_ONLY` | One exact string; invalid current bytes possible | No account field; present storage location only, no authenticated installation history | No timestamp/history; ordinary page/user tooling can replace/delete/copy; current value can be fabricated |
| B metadata / `DERIVED_IDENTIFIER_ONLY` | SHA-256 tuple key, active generation/schema/local time; no literal | Account/project/device claimed through tuple; no installation attestation | Local initialization time, not historical issuance; page/IDB controller can recreate metadata/digest |
| C outbox / `UNAUTHENTICATED_CORROBORATION_ONLY` | Optional literal exact device/account, scoped payload/request/digests/status/local time | Namespace/generation/account claim; no origin/container issuer | Logical frozen payload/request; operational status mutable; local controller can forge consistent rows/time |
| D local ACK / `UNAUTHENTICATED_CORROBORATION_ONLY` | Receipt result/ref/time associated with outbox, not standalone literal | Association through local request scope | Alleged server time in local row not signed chain; same local mutation authority |
| D server receipt / `AUTHENTICATED_CORROBORATION_ONLY` | v2 text device retains case; owner/ns/gen/request/result/server time | Authenticated owner + submitted tuple; no installation identifier | Ordinary append-only/immutable contract; backend/DB custody controls; client can submit a false originalness claim |
| D checkpoint / `DERIVED_IDENTIFIER_ONLY` | Namespace/gen/account/stream/sequence/epoch/local time; no literal | Claimed scoped checkpoint | Progress, not issuance history; locally writable |
| D conflict / `UNAUTHENTICATED_CORROBORATION_ONLY` | Scoped generic candidate/ref/hash/local mutation; incidental device possible | Candidate/local scope, not authenticated original issuer | Local conflict capture time and remote evidence, not original history; locally writable |
| E lifetime / `PROSPECTIVE_FUTURE_PROVENANCE_ONLY` | Authority exact device/lifetime/phase; prepared prior hash; marker no ID | No account or authenticated container binding | No issuance time/journal; dormant, page-writable; captures existing claim or creates target |
| F account/domain data / `AUTHENTICATED_CORROBORATION_ONLY` | Authenticated owner; legacy/canonical Health content lacks dedicated original ID | Account subject/row ownership, no original container | Content update/server activity; caller-editable domain content, not creation-identity provenance |
| F binding / `AUTHENTICATED_CORROBORATION_ONLY` | Exact text device, namespace/gen/domain/owner/epoch/binding/server time | Authenticated account and caller-supplied tuple | Ordinary immutable binding; backend/DB custody; no authenticated first local issuance |
| G transport / `AUTHENTICATED_CORROBORATION_ONLY` | Literal requests plus derived digests/keys/CAS/ref/epoch | Authenticated retained association only; no origin/container assertion | Receipt/binding server time if retained; local capture alone not authenticated; originalness self-claimed |
| H vault/export / `UNUSABLE_FOR_ORIGINAL_ID_PROOF` | Content/local timestamps/checksum; Notes package fingerprint; no original Health literal field | Account content or claimed namespace; no identity custody envelope | User/page/file editable, checksum recomputable; export time is not issuance; no signature |
| I persistent native audit / `NOT_PRESENT` | Current API value/event fields only | Storage scope, not authenticated history | No persistent audit query; no relevant repository logger |
| J cached session / `CURRENT_STATE_ONLY` | Frozen exact runtime device/account/namespace in memory | Claimed runtime scope/current fences; no historic container chain | Module lifetime, no trusted chronology; same page can create a new session under replacement bytes |
| K human candidate / `OPERATOR_SUPPLIED_UNTRUSTED_INPUT` | Recalled/copied/displayed text and claimed dates/scope | Human assertions; media may show URL/account, not installation authority | Human/media/support custody may be forged or incomplete; no issuer by attestation |
| L adoption/authority/reset/lease adjuncts / `UNAUTHENTICATED_CORROBORATION_ONLY` | Literal where schema requires it, hashes/namespace/current scope otherwise | Supplied local account/project/device/generation | Local capture/current verification times, mutable storage; authentic server discovery still not original issuance |
| M Notes root/cutover/handoff / `UNAUTHENTICATED_CORROBORATION_ONLY` | Exact supplied logical device, source-root/digests/local times | Notes migration/operator-bound scope, not Health mirror history | Local operator registration/recomputable digest; different domain authority, no independent Health issuer |
| N isolated qualification / `UNUSABLE_FOR_ORIGINAL_ID_PROOF` | Synthetic run/token/lifecycle observations; product keys denied | Test origin/run only | Reviewed fixture evidence may be genuine within bounded test, but cannot identify production original ID |
| O external operational/support archives / `UNKNOWN_EXTERNAL_OPERATIONAL_SOURCE` | Unknown; no promised schema/record | Unknown; must independently prove account/container | Unknown retention/custody/precedence/authenticity; not classified available |

| Candidate | Completeness / absence meaning | Pre-incident status, competing values and survival | Ownership / lifecycle / correlation ceiling |
| --- | --- | --- | --- |
| A | Single current value; absent could mean never issued, loss or deletion | Could be old or replacement; loses predecessor on overwrite; survives only while current bytes remain | Current string presence only; neither ownership nor continuity |
| B | Sparse initialized namespaces; absence not evidence of no original | Multiple accounts/devices/historical namespaces; survives mirror-only overwrite if IDB survives, not IDB loss/copy rollback | Tuple consistency only; no ownership/continuity |
| C | Only recorded mutations; literal optional in older/generic paths; absence normal | Could precede incident; several lineages/stale/foreign values; survives mirror-only failure if IDB survives; no independent chronology | Claimed mutation ownership/scope correlation, no original ownership/continuity |
| D local ACK | Only delivered retained rows; absent normal offline/no mutation | Local retention/loss, copied/forged association and stale generations possible | Local association only, no continuity |
| D server receipt | Only server-observed mutations, no guarantee full issuance history; absent normal local-only | Could prove server sighting before independently dated incident; multiple devices/replacements; may outlive local loss under unverified retention | Authenticated account submission, not installation ownership/originalness/continuity |
| D checkpoint | Only synced streams; absent normal | Several epochs/generations; overwrite records progress, not old ID; local loss destroys | Progress correlation only |
| D conflict | Only conflicts/candidates; absence normal | Multiple competitors; local preservation can survive mirror overwrite; local loss/tampering not covered | Candidate correlation only |
| E | Dormant; absence expected production, marker insufficient | No retroactive pre-adoption history; READY/prepared may be later target; overwrite/clear/copy risks | Logical current lifetime, not historical ownership or complete E3 |
| F account/data | Only existing account content; no data need ever be written | Multi-device/shared account, imports/replacements possible; server may survive local loss | Account authorization/content ownership only |
| F binding | Only registrations under server capability; absence expected for never registered/dormant scope | Multiple ns/gen/devices; may predate incident but first server registration can follow replacement | Authenticated tuple registration only |
| G transport | Only observed/retained requests; unknown local capture/log retention | Retries/replays/reset/new clients produce differing scopes; digests do not reconstruct lost claim | Request equivalence/account association only |
| H | Optional user-created file/snapshot, partial cloud data; absence normal | Could predate incident but timestamp editable; cross-account/profile imports; external file can survive storage loss, without original issuer field | Content recovery/correlation, not installation ownership/continuity |
| I | No standard persistent historical source; event observation partial | Missed events/restarts cannot be replayed; native forensic artifacts uninspected/unknown | No after-the-fact provenance/continuity |
| J | Only live created session; no session or rejected promise possible | Can survive mirror overwrite within same module; restart loss; cached account ABA/competing scopes possible | Runtime-scope corroboration at most; no historical ownership/continuity |
| K | Optional media/memory; absence meaningless | Could predate incident if custody independently proven; competing accounts/profiles/editing/post-incident claims | Observation/candidate only; operator privilege not authority |
| L | Only adoption/discovery/reset/lease operations; absent normal | Many generations/verification episodes; local loss and stale copies possible | Operation/current-scope correlation only |
| M | Only Notes migration/operator events; absent normal | Competing source instances/scopes; local persistence can outlive mirror, not necessarily same identity domain | Notes-specific binding, not Health original ownership/continuity |
| N | Bounded synthetic events; no production ID expected | Genuine fixture chronology cannot fill missing real incident history | Platform behavior within evidence scope only |
| O | Unknown, absence cannot be asserted | Unknown competing values, retention, provenance and survival | No conclusion until separately authorized/source-specific review |

## 9. Multi-source proof analysis

| Inputs | Independence / circularity / authenticity | Precedence / ambiguity / failure modes | Verdict |
| --- | --- | --- | --- |
| Authenticated account + old outbox literal + matching namespace | Account authentication is independent of local bytes but does not issue device. Outbox/hash share supplied namespace and writable storage; matching them is circular for originalness. | Outbox local time not independently dated; several devices/generations/copies possible; empty outbox normal. | `NOT_ESTABLISHED`: exact candidate consistency, not authoritative proof. |
| Signed/immutable historical backup + namespace | Current vault/export has no such issuer/signature/original-ID envelope. Hypothetical signature must authenticate issuer's original-installation claim, not merely seal user-selected bytes. | Must independently predate incident and bind this account/installation, distinguish replacements/rollback, and carry exact ID. A newly signed old file or immutable post-incident copy is insufficient. | Current `NOT_ESTABLISHED`; hypothetical `CONDITIONAL`, separate source/trust review, not an existing capability. |
| Authenticated durable server receipt + local namespace match | Server custody can independently authenticate receipt time and account submission; device claim still originated in client. Namespace corroborates the same claim, not installation issuance. | Server activity may follow replacement or first online use of another container; multiple same-account devices; local hash can be recreated. | `NOT_ESTABLISHED`: stronger historical corroboration, missing original/container chain. |
| Prior authority record + account binding + reachable old namespace | Dormant authority/local metadata copies mirror or generated target; account authentication does not sign historical authority. Reachability is necessary preservation, not issuer independence. | No trusted pre-incident issuance chronology; adoption may be post-loss; same-ID copies/ABA/replacements remain. | `NOT_ESTABLISHED`; dormant agreement does not establish current recovery. |
| Operator candidate + two independent authenticated corroborators | No current pair authenticates original local issuance/container. Receipt and binding often share one client claim; two checks are not two independent roots. | Need independent pre-incident custody/scope/history for each; another device, copied bytes, incident-time uncertainty or one shared claim defeats sufficiency. | Current `NOT_ESTABLISHED`; a genuinely independent future/external chain is `CONDITIONAL`, not permission to recover. |

`MULTI_SOURCE_AUTHORITATIVE_PROOF = NOT_ESTABLISHED_FROM_CURRENT_VERIFIED_SOURCES`

No number of correlated checks upgrades untrusted originalness. A candidate set with one match is not proof that history had one legitimate ID. Any source-specific exception requires demonstrating all ten properties and independent review; this task neither authorizes collection nor selects an exception.

## 10. Retroactive versus prospective feasibility

| Verdict | Value and scope |
| --- | --- |
| PRODUCTION_EXACT_ORIGINAL_PROVENANCE_AVAILABLE | `NO` |
| CURRENT_PRODUCTION_AUTHORITATIVE_PROVENANCE_SOURCE | `NOT_FOUND` in inspected repository-defined contracts |
| CURRENT_RETROACTIVE_EXACT_ORIGINAL_RECOVERY_PROVENANCE | `NOT_FEASIBLE` as authorization from these sources; not a universal impossibility claim about unknown external historical evidence |
| CURRENT_RETROACTIVE_PROVENANCE_FEASIBILITY | `NO` for the current verified source set |
| RETROACTIVE_EXISTING_INCIDENT_PROVENANCE | `NO_CURRENT_RETROACTIVE_TRUSTED_SOURCE_FOUND` |
| FUTURE_PROSPECTIVE_PROVENANCE_FEASIBILITY | `CONDITIONAL` on a new approved issuer/trust/history capability satisfying the complete standard |
| PROSPECTIVE_FUTURE_INCIDENT_PROVENANCE | `CONDITIONAL / NOT_IMPLEMENTED / NOT_APPROVED` |
| RETROACTIVE_VS_PROSPECTIVE_DISTINCTION | `PASS` as a characterization distinction, not execution acceptance |

A future record can protect only incidents after trustworthy issuance with an established installation chain. Future adoption of an already-corrupted mirror, a candidate, an outbox-derived guess or newly recovered bytes cannot retroactively prove originalness. Existing local-only/offline users and older versions may have no eligible trusted issuance. These limitations must remain explicit rather than promising eventual support for every historic loss.

## 11. Controlled operator feasibility

`CONTROLLED_OPERATOR_PROVENANCE_FEASIBILITY = NOT_FEASIBLE_FROM_CURRENT_VERIFIED_SOURCES`

`CONTROLLED_OPERATOR_PROVENANCE_PATH = NOT_FEASIBLE` for current unproven historical incidents.

This is not a prohibition on future, separately approved prospective capability. An operator could help verify a genuinely preexisting qualified source, but no complete current chain is found. A support viewer, signed report generated after the incident, privileged database read, or manually selected candidate cannot add missing original issuance/container history. Unknown archives would first need narrowly authorized acquisition, custody/authenticity/retention analysis, exact scope/history proof and independent review. This does not designate support infrastructure, start tooling, authorize real-data collection, or convert an operator into an issuer.

## 12. Prospective trusted local record option

`PROSPECTIVE_TRUSTED_LOCAL_RECORD = CONDITIONAL`

A record would have to be issued before the relevant incident by a demonstrably trustworthy original-creation/adoption process, binding exact bytes/case, historical account scope and a justified origin/storage-installation identity. Issuer trust, clock/precedence, integrity/custody, replacement/version history, anti-rollback and applicability must be established independently, not merely asserted in a new field.

If ordinary page code can rewrite the record or recompute its checksum, it mainly duplicates the current localStorage/IDB trust domain. Such a plain local duplicate is `NOT_FEASIBLE` as independent authoritative proof, although it might improve availability/corroboration after mirror-only corruption. Clearing/corrupting all origin storage, copying profiles, rollback, old clients bypassing the issuer, local-only account ambiguity and late adoption still need a truthful support boundary. A secret stored beside the record or an unsigned local time does not establish an independent issuer.

Device-lifetime/adoption coordination could be a prerequisite for defining trustworthy issuance, but the dormant foundation does not itself qualify that trust or preserve complete original history. Whether an additional trust root exists is unsettled; no native bridge, extension, managed launcher, storage key, schema, signature design or deployment is selected here. Any dependency requiring writer mutation/coordination becomes a separate high-risk prerequisite; this task stops at classification and does not implement it. Prospective feasibility does not repair pre-issuance incidents.

## 13. Prospective remote provenance option

`PROSPECTIVE_REMOTE_PROVENANCE_RECORD = CONDITIONAL`

`SEPARATE_ARCHITECTURE_AND_PRODUCT_WORKSTREAM_REQUIRED`

An authenticated remote append-only record can strengthen account attribution, server chronology and custody. It still records a caller claim unless an independently justified original-issuance/container chain is established. First server sighting is not necessarily first local creation; online registration after an offline replacement or from a second profile is a concrete counterexample. Exact text retention, server immutability/version history, privileged access/audit, replay/rollback protection, multiple installations, reset/replacement lifetime semantics and origin/profile identification require a separate architecture/security/product decision.

Remote availability/retention introduces account-linkable tracking and operator access risks. Offline/local-first and local-only users might be excluded or need a separate issuance strategy; no silent online requirement or broadened telemetry is approved. A copied same-account tuple is not authenticated installation identity. Changes to backend/schema/API/RLS or a new registry cross the current firewall. No remote registry, table, endpoint, collection mechanism or product promise is chosen or implemented.

## 14. E3, writer continuity and exact-target control independence

`E3_DEPENDENCY = INDEPENDENT` for the historical identity-proof proposition. Safe recovery also separately requires admitted lifecycle/creator exclusion evidence; independent means neither proof implies the other, not that E3 is dispensable.

`PROVENANCE_AND_E3_INDEPENDENCE = PASS`

`E3_FEASIBILITY = NOT_ESTABLISHED`

`LIFECYCLE_EVIDENCE_SOURCE = REMAINS_UNAVAILABLE`

Historical provenance answers which exact target may be trusted. E3/episode evidence must address the complete relevant creator set, suspended/restored/old clients and continuity through the authorized operation. An identity archive says nothing sufficient about creator quiescence. A successful lock/lifecycle observation does not authenticate original bytes.

`WRITER_CONTINUITY_STATUS = NOT_YET_PROVEN`

`WRITER_CONTINUITY_CHANGED = NO`

`WRITER_SEMANTIC_CHANGE_REQUIRED = NOT_ESTABLISHED`

`SEPARATE_HIGH_RISK_WRITER_TRANSITION_PREREQUISITE_REQUIRED = CONDITIONAL`

`EXECUTABLE_RECOVERY_WITH_UNPROVEN_WRITER_CONTINUITY = BLOCKED`

This task does not prove cache/session/writer continuity, even when a proposed exact ID equals an old namespace/outbox. A future provenance issuer requiring writer changes is classified as a separate prerequisite, not folded into characterization. No unconditional writer-transition requirement is invented.

`EXACT_TARGET_CONTROL_PROTOCOL_REQUIRED = FUTURE_SEPARATELY_REVIEWED_DESIGN / NOT_IMPLEMENTED`

`EXACT_TARGET_CONTROL_PROTOCOL = NOT_IMPLEMENTED`

Provenance establishes WHAT target is trusted; separately reviewed exact-target control establishes HOW a safe transition commits it. No repair intent/commit/crash-resume algorithm is designed here. Exact original proof alone cannot authorize current execution, new target creation, automatic replacement, or writer/data-plane/reader activation.

## 15. Security and privacy boundaries

No raw production identity or user content belongs in this public artifact. Device literals/fingerprints/namespace and mutation associations are linkable identifiers, not harmless anonymous strings. The following two matrices jointly classify every candidate's ten requested dimensions; K includes any user-supplied backup/media and O includes unknown support/operational archives. Future options are not approved data collection.

| Source | Confidentiality | Integrity / authenticity | Retention | User visibility / operator access |
| --- | --- | --- | --- | --- |
| A mirror | Local identifier, account crossover correlation possible | Page/user writable; no historical authenticity | Until overwrite/clear; no predecessor retention | Browser tooling/current app only; no support entitlement |
| B namespace | Account/device-correlatable hash | Local recomputable consistency, not attestation | IDB life/upgrade/clear; sparse generations | No provenance UI; any future forensic access needs scope authorization |
| C outbox | Identifier plus sensitive pending content/request data | Supported frozen semantics, local trust ceiling | Operational retention, optional legacy fields/loss | No historical recovery operator API; do not expose payloads to identify a device |
| D local ACK | Mutation/owner activity correlation | Local association not signed transcript | Retained outbox/candidate lifetime | No operator authority inferred from ACK |
| D server receipt | Account-linked activity/device and payload digests | Authenticated custody + ordinary immutable ledger; client originalness unverified | Contract ledger; production retention/population unverified | Backend/DB privileged source; no authorized real-row query in this task |
| D checkpoint | Account/sync-activity metadata | Locally mutable progress | Stream overwrite/IDB life | No original-ID UI/operator source |
| D conflict | Potentially sensitive local/remote content | Local durable capture, not original issuer | Conflict/session operational life | Resolution/inspection must not leak candidates across accounts |
| E lifetime | Linkable device/lifetime/current transition metadata | Same local trust domain; dormant, no original attestation | Overwrite/clear/rollback; not append-only history | Dormant API, no current production recovery UI/operator capability |
| F account/data | Health content and authenticated subject | Account/RPC authorization, mutable domain content | Domain retention/reset, not original-device journal | Account-facing data; support access not presumed |
| F binding | Persistent linkable device/account/epoch | Authenticated immutable submitted tuple; not local issuer | Ordinary server contract, real deployment/history unverified | RPC/internal DB custody, not recovery permission |
| G transport | Identifier/activity metadata; never publish tokens | Authenticated channel/ledger where present; unsigned captures untrusted | Local/server retention varies; logs unknown | Existing sync APIs, no historical original-identity retrieval entitlement |
| H vault/export | Highly sensitive Notes/Health data plus timestamps | Editable file/snapshot, non-authenticating checksum/digest | User-controlled files/local snapshots; arbitrary copies | User-visible export; operator access only with separate data authorization |
| I native audit | No promised history; raw current storage remains sensitive | No standard persistent attestation | No audit archive contract | No after-the-fact API; browser profile forensics out of scope |
| J cache | Memory identity/account/content handles | Runtime consistency only | Document/module life, restart loss | Internal object, no historical-support interface |
| K human/media | May expose ID, accounts, tokens, Health or unrelated content | Candidate/attestation editable/misattributable | Human/support custody unknown | User supplied; not blanket operator access or authority |
| L local adjuncts | Device/account/import/reset/mutation association | Local claims/digests/current verification | Operation/store life, stale histories possible | Internal APIs; no original-provenance access entitlement |
| M Notes authority | Cross-domain source/account/device association | Operator-bound/local digests, not Health issuer | Notes migration/store life | Notes authority does not authorize Health access/repair |
| N fixture | Synthetic only; product data denied | Reviewed bounded fixture integrity, not production proof | Qualification record scope | Human-visible synthetic export; no new physical work |
| O external archives | Unknown, potentially sensitive broad telemetry | Unknown custody/authenticity | Unknown; do not infer available | Unknown privileges/visibility; acquisition requires separate authorization |
| Future local issuer | New linkable historical identity | Independent issuer/integrity unresolved; page duplicate insufficient | Needs incident-survival/rollback policy | No deployment/UI/support capability approved |
| Future remote issuer | New long-lived account/install tracking | Issuer/container claim verification and DB custody unresolved | Explicit retention/deletion/history decision required | Least-privilege/audit/user transparency needed; not approved |
| Future support issuer | Potential centralized identity/incident history | Preexisting authenticated chain required, privilege alone insufficient | Explicit custody/retention decision required | Support tooling/source distinction and consent unresolved |

| Source | Account crossover risk | Multi-device risk | Profile/origin crossover risk | Data minimization boundary |
| --- | --- | --- | --- | --- |
| A | Global mirror reused across account sessions | Same/copy/replaced claim confused with original | Copied string provides no container proof | Never publish raw mirror/credentials |
| B | Wrong tuple/account metadata selected | Multiple valid namespaces | Hash of copied tuple identical elsewhere | Use only necessary scope/digest in separately authorized evidence |
| C | Stale/foreign retained row misselected | Several pending/history lineages | Copied IDB row looks consistent | No payload export merely for an ID; preserve pending work |
| D local ACK | Wrong outbox association | Another device's request/receipt | Copied local evidence | Minimal mutation/ref linkage, not content dump |
| D server receipt | Owner checks required even for privileged access | Same user may submit many device values | Client tuple has no origin installation witness | Narrow exact incident scope/time/identity metadata; no bulk ledger |
| D checkpoint | Wrong stream/account checkpoint | Progress from another scope | Local copy indistinguishable history | Progress metadata only if needed |
| D conflict | Wrong local/remote candidate owner | Multiple competing candidates | Imported/copy candidate scope | Avoid content exposure; candidate preservation not proof promotion |
| E | No stored account binding | Later lifetime/replacement confused with original | Same-origin writable/copyable record | No new local keys or provenance capture now |
| F account/data | Auth account not proof of browser ownership | Shared account canonical truth spans devices | Imports/copies from other containers | No real user rows queried |
| F binding | Exact owner still necessary | Several registrations/generations | Server cannot infer local container | No new backend registry/telemetry |
| G transport | Token/caller owner must match retained association | Replays/epochs/multiple clients | Requests can claim copied device/ns | Never collect tokens or assume infrastructure logs |
| H vault/export | Files can be imported across accounts | File data not an installation identity | Portable by design | No real backup opened; no broad content in public evidence |
| I native audit | Storage scope does not imply authenticated account | Many browser storage installations | Origin/container history unestablished | No browser profile forensic collection |
| J cache | A/B/A/rejected/in-flight cached scope | Competing tabs/new session lifetime | Memory belongs to current realm, no trusted old chain | No debugging dump/support memory capture |
| K human/media | Account/scope misattribution | Wrong device remembered/captured | Screenshot URL does not prove installation | Synthetic examples only; redact by separate evidence policy if ever authorized |
| L adjuncts | Wrong account/adoption/reset intent | Several episodes/generations | Copied/stale local evidence | Inspect contracts only, not operation data |
| M Notes authority | Different project/account authority | Different Notes source/device | Notes root is not Health installation proof | No cross-domain promotion or source export |
| N fixture | Cannot bind real product account | Synthetic device/run cannot identify real device | Isolated origin explicitly separate | Keep qualification synthetic and scope-limited |
| O external archives | Unknown; privileged cross-account risk | Unknown device attribution | Unknown origin/container coverage | No collection without new narrowly approved scope |
| Future local issuer | Historical account transition policy required | Lifetime/replacement semantics unresolved | Independent installation binding needed | Exact minimal identity/history, no Health payload tracking; not selected |
| Future remote issuer | Separate owner/security design required | Multiple installation/reset distinctions required | Remote first sighting insufficient | Minimize identifier retention, operator access and telemetry; not selected |
| Future support issuer | Privileged support separation required | Support record may describe another device | Custody must establish origin/container | Tool must not become bulk telemetry or issuer by assertion |

## 16. HEALTH-ID acceptance impact

All criteria remain `REQUIRED / NOT EXECUTED`. This table maps characterization/dependencies, never marks runtime acceptance PASS.

| Criterion | Impact / still-outstanding proof |
| --- | --- |
| HEALTH-ID-C01 | Repeated current source inventory includes creator, reader/final-use, cache/export/restore edges; removal/implementation proof still absent. |
| HEALTH-ID-C02 | Absent versus malformed/error classification not relaxed; no provenance guess or automatic replacement approved. |
| HEALTH-ID-C03 | Exact case/safe legacy compatibility is necessary evidence; no normalization/migration. |
| HEALTH-ID-C04 | Central blocker: no current authenticated original/account/container chain found; absent/ambiguous/stale evidence must deny/escalate. |
| HEALTH-ID-C05 | Old/historical namespace reachability/candidate agreement is not originalness; actual supported access and no orphaning still unproven. |
| HEALTH-ID-C06 | Outbox is corroboration only; pending/bound payload/identity/digest/CAS/receipt/epoch immutability still requires implementation proof. |
| HEALTH-ID-C07 | Cached session is not historical issuer; ABA/rejection/in-flight/export/reset/restore continuity not proven or changed. |
| HEALTH-ID-C08 | Identity provenance does not qualify complete creator exclusion or E3 episode evidence. |
| HEALTH-ID-C09 | Exact target cannot be guessed; durable control/commit/crash-resume protocol remains future separate design. |
| HEALTH-ID-C10 | No supported execution/liveness claim for unproven historic incidents; future issuance cannot retroactively qualify lost bytes. |
| HEALTH-ID-C11 | Reader/owner/current-ID checks do not prove cross-surface historical scope; revocation/ABA/late continuation proof still required. |
| HEALTH-ID-C12 | #763 persisted isolation/INVALID_CONTEXT versus ordinary source failure preserved; partial truth is not an identity waiver. |
| HEALTH-ID-C13 | Typed unavailable/local-only versus empty remains required; finite retry, unsupported recovery copy, warnings/accessibility/physical QA not executed. |
| HEALTH-ID-C14 | Docs-only freeze observed; no domain/schema/backend/gate change; future writer dependency must be separately authorized. |
| HEALTH-ID-C15 | Approved policy is not capability execution; this artifact awaits independent review, with implementation/qualification/Final Gate still separate. |

## 17. Decision tree and one next-work gate

| Case | Required next-work boundary |
| --- | --- |
| A: current authoritative retroactive source actually identified | Establish exact issuer/custody/account/container/precedence/history chain; independent review; only then consider bounded exact-target recovery design. Not the current result. |
| B: no current source, prospective-only source potentially feasible | Existing historical incidents remain unsupported. Return for explicit prospective architecture/product capability decision; do not close REL05G5A-001. |
| C: new remote/privileged/operator source required | Identify new issuer/trust boundary, offline/local-only/retention/privacy implications; explicit product/security/architecture authorization before design/implementation. No automatic registry/bridge/extension/support deployment. |
| D: no defensible provenance mechanism | Retain deny/escalate; never lower proof threshold. Product owner may later consider indefinite unavailability; this artifact does not make that new decision. |

Current finding follows denial/escalation for existing unproven incidents; B/C remain conditional future questions, not a selected capability. Unknown archives must not be promoted into Case A without source-specific evidence. No recovery or data-collection procedure follows from this publication.

`RECOMMENDED_NEXT_ACTION = REL_05G_HEALTH_ID_EXACT_ORIGINAL_PROVENANCE_FEASIBILITY_INDEPENDENT_REVIEW_01`

One independent characterization review should check inventory completeness, the server claim-versus-issuer distinction, source independence and negative/conditional scope, privacy boundaries, and absence of authority promotion. Stop after Draft publication/initial exact-head CI observation. Do not proceed to Ready, merge, operator tooling, runtime recovery, exact-target implementation or physical qualification.

## 18. Frozen authority and validation state

| State | Preserved value |
| --- | --- |
| REL05G5A-001 | `ACTIVATION_PREREQUISITE / REQUIRES_CORRECTION` |
| HEALTH-ID-C01-C15 | `REQUIRED / NOT EXECUTED` |
| Assisted recovery runtime | `NOT_AVAILABLE` |
| Public reader / Health parent activation | `NOT_AUTHORIZED` / `NOT_AUTHORIZED` |
| Writer continuity | `NOT_YET_PROVEN`; changed `NO` |
| Exact-target control | `NOT_IMPLEMENTED` |
| Track A | `TRACK_PARTIAL / PATH_A_QUALIFICATION_PARTIAL` |
| E3 / lifecycle source | `NOT_ESTABLISHED` / `REMAINS_UNAVAILABLE` |
| Bootstrap admission | `BLOCKED_BY_EVIDENCE_QUALIFICATION` |
| R2-U | `NOT_IMPLEMENTED / ARCHITECTURALLY_FEASIBLE_PENDING_DIFFERENTIAL_PROOF` |
| Tracks B/C/D | `NOT_EXECUTED` |
| Seven live-writer blockers | All `OPEN`: unbound pre-reset create; rollback visibility; old/new coexistence; mounted UI identity; canonical field ownership; analytics projection/public claims; reset-fenced local-edit policy |
| DB / schema | `LOCAL_DATABASE_VERSION = 7`; `LOCAL_SCHEMA_VERSION = 1` |
| Storage/backend/domain | Stores, indexes, keyPaths, WorkoutSessionV1, Supabase/RLS/backend API/remote schema unchanged |
| Reader/writer/data plane | No activation of public reader, Health parent, canonical writer, bind/push/pull/resync/reset or G6 |
| New decisions/capabilities | `NEW_PRODUCT_DECISION_MADE = NO`; `NEW_CAPABILITY_IMPLEMENTED = NO` |
| Physical qualification | `DEFERRED_UNCHANGED`; no additional qualification |

All five source constants were rechecked `false`: [selected day](../src/components/views/features/health/healthSelectedDayCompositeConfig.ts), [range](../src/components/views/features/health/healthWorkoutRangeCompositeConfig.ts), [exercise comparison](../src/components/views/features/health/healthExerciseComparisonPreviewConfig.ts), [Home](../src/components/views/features/home/homeWorkoutCompositeConfig.ts), [Search](../src/components/views/features/search/searchWorkoutCompositeConfig.ts). No flag or config change is included.

Publication validation requires exactly this Markdown file, `git diff --check` (including staged diff), resolvable relative links, clean repository after normal commit, Draft status, no auto-merge/Ready/merge, and exact-head hosted CI as the regression signal. No full local frontend suite is required for this docs-only characterization. CI success would validate repository regressions, not provenance feasibility, runtime recovery, physical evidence or acceptance execution. Validation/initial CI results and exact publication head belong in the publication report, not a self-review claim inside this pending-review artifact.
