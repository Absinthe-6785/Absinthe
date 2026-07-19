# K-333B — Production Transaction Evidence Records

## Executive verdict

K-333B promotes the four record-specific execution-evidence contracts frozen by K-331 into dormant production canonical codecs. An exact committed operation, its admitted decision, immutable outbox intent, and committed terminal state can now be strict-decoded and cross-bound to the unchanged K-333A source-transaction reference. No persistence, source mutation, admission caller, delivery runner, or eligibility path is added.

The K-329 reviewed writer manifest remains authoritative policy evidence, but it is not redefined as a namespace/generation-scoped self-digest transaction record. That semantic gap is explicitly deferred instead of inventing a conflicting production manifest schema.

## Starting main and predecessor

- Repository: `C:\Users\이도현\GitRepos\Absinthe`
- Starting main: `960f377149c0e3596d4929c006f17a59f12f1403`
- K-333A merge prerequisite: exact starting commit, clean worktree
- Branch: `codex/k333b-production-transaction-evidence-records`

## Authoritative record inventory

| Record/evidence | Owner before K-333B | K-333B disposition |
|---|---|---|
| `ReviewedWriterManifest` / `ReviewedManifestAuthority` | K-329 production coordination policy | Deferred as a transaction record; not schema-compatible with the requested namespace/generation self-digest record |
| `WriterRegistrationRecord`, coordination authority, live operations | K-329/K-330 runtime coordination | Runtime-only; unchanged |
| `absinthe_writer_identity` | K-333A production protocol | Reused unchanged |
| `absinthe_writer_session` | K-333A production protocol | Reused unchanged |
| `absinthe_source_authority` | K-333A production protocol | Reused unchanged |
| `absinthe_source_transaction_reference` | K-333A production protocol | Reused unchanged; four opaque references are now independently decoded |
| `absinthe_k330_operation` | K-331 record-specific test evidence | Production codec implemented |
| `absinthe_k330_admission` | K-331 record-specific test evidence | Production codec implemented |
| `absinthe_immutable_outbox_intent` | K-331 record-specific test evidence | Production codec implemented |
| `absinthe_terminal_state` | K-331 record-specific test evidence | Production codec implemented |
| receipts, MMR/checkpoints, lifecycle, bootstrap/restore | K-331 architecture evidence | Deferred K-333 |
| storage schema, repositories, persistent transactions | K-334 | Not implemented |

## Selected K-333B records

The four selected records are the smallest closed K-331 execution-evidence chain. The operation binds the exact writer/session, admitted evidence, immutable intent, committed revision, input/result digests, and namespace/generation. Admission authorizes only the exact operation/writer/session tuple. Outbox and terminal records bind the exact operation and immutable intent/result digests. The existing transaction reference then binds all four record identities and self-digests to K-333A authority evidence.

Rejected admissions and aborted/failed terminals are deliberately not invented: the authoritative K-331 record-specific schemas select only `admitted` and `committed`. They may be modeled by a later reviewed version, not by widening v1.

## K-333A foundation reuse

K-333B reuses canonical value snapshotting, NFC/surrogate checks, canonical UTF-8 serialization, bounded decoding, strict exact-object snapshots, stable `ProtocolResult` errors, domain-separated preimages, and SHA-256. It adds only four registered preimage domains and record-specific protocol/graph functions.

## Record and self-digest inventories

Every field except the named self-digest is included in the v1 preimage. No record has optional fields, arrays, generic payloads, mutable status, timestamps, or caller-defined metadata.

### `absinthe_k330_operation` v1

- Fields: `kind`, `version`, `id`, `namespace`, `generation`, `admissionId`, `admissionDigest`, `writerId`, `writerDigest`, `sessionId`, `sessionDigest`, `mutationKind`, `committedRevision`, `affectedIdentityDigest`, `canonicalInputDigest`, `resultDigest`, `outboxId`, `outboxIntentDigest`, `operationDigest`
- Self-digest: `operationDigest`
- Domain: `absinthe.operation.v1`
- Closed mutation kinds: `note_upsert`, `note_tombstone`

### `absinthe_k330_admission` v1

- Fields: `kind`, `version`, `id`, `operationId`, `writerId`, `sessionId`, `decision`, `admissionDigest`
- Self-digest: `admissionDigest`
- Domain: `absinthe.admission.v1`
- Closed decision: `admitted`

### `absinthe_immutable_outbox_intent` v1

- Fields: `kind`, `version`, `id`, `operationId`, `intentDigest`, `outboxDigest`
- Self-digest: `outboxDigest`
- Domain: `absinthe.immutable_outbox_intent.v1`

### `absinthe_terminal_state` v1

- Fields: `kind`, `version`, `id`, `operationId`, `state`, `resultDigest`, `terminalDigest`
- Self-digest: `terminalDigest`
- Domain: `absinthe.terminal_state.v1`
- Closed state: `committed`

## Manifest/type membership contract

K-333A `WriterIdentityRecord.writerTypeId` and `manifestDigest` remain manifest-scoped references. K-329's reviewed manifest is a global, physical-source-bound policy manifest containing 30 code-reviewed entries; it does not contain namespace, generation, a record ID, or a self-digest field. Turning it into the prompt's proposed transaction manifest would create a second incompatible owner. Membership validation therefore remains an explicit deferred relation.

## Transaction evidence graph

`validateProductionTransactionEvidenceGraph` first strict-decodes and self-digest-verifies all eight supplied records: writer, session, authority, transaction reference, operation, admission, outbox intent, and terminal state. It then reuses the K-333A authority graph and enforces:

- operation namespace/generation equals the writer/session/authority scope;
- operation writer/session IDs and digests match exact decoded records;
- operation admission ID/digest matches the exact admitted record;
- admission operation/writer/session identities match;
- operation outbox identity and intent digest match the immutable intent;
- terminal operation and result digest match;
- transaction reference operation/admission/outbox/terminal IDs and self-digests match;
- transaction reference committed revision matches both operation and source authority.

The K-333A reference schema and stable vectors are unchanged. MMR and checkpoint references remain opaque beyond the K-333A authority relation.

## Compatibility relationships

The compatibility table is frozen and closed. Exactly nine v1/v1 tuples are supported:

1. writer identity → operation
2. writer session → operation
3. operation → admission
4. operation → immutable outbox intent
5. operation → terminal state
6. operation → source transaction reference
7. admission → source transaction reference
8. immutable outbox intent → source transaction reference
9. terminal state → source transaction reference

Lower, higher, malformed, reversed, and unlisted tuples fail closed. Complete K-333 compatibility across receipts, MMR/checkpoints, lifecycle, bootstrap, restore, and attachments remains deferred.

## Stable errors and resource bounds

No new error code was added. K-333B uses the 18 frozen K-333A codes and bounded operation/field labels. Record kinds and semantic enums are closed; identifiers use the inherited 3–256 character lowercase identifier grammar, digests are 64 lowercase hexadecimal characters, and revisions use canonical 1–16 digit decimal strings. Records are additionally bounded by the inherited 32 KiB canonical encoding ceiling, 128-key ceiling, 4 KiB UTF-8 string ceiling, depth 32, and 2,048-node ceiling. The selected v1 records contain no arrays, so manifest/capability array limits do not apply in this scope.

## Runtime totality and Proxy handling

All exported untrusted boundaries accept `unknown`, exact-snapshot before field access, reject unknown/accessor/symbol fields and unsupported prototypes, and contain active, throwing, and revoked Proxy failures. Creators return detached frozen records. No caller-owned array/object or error is retained.

## Stable vectors and test evidence

Each new record has fixed independent canonical payload, framed preimage, and lowercase SHA-256 digest literals. Tests cover strict create/decode/byte round trips, versions/kinds/fields/types/enums/revisions/digests, hostile runtime inputs, every mutable non-self field commitment, self-digest corruption, selected graph edges, cross-record replay, the immutable compatibility table, and fixed vectors. Existing K-333A vector tests remain unchanged and are rerun with the full protocol suite.

## K-334 persistence boundary

K-333B creates no database version, object store, index, migration, repository, durable lookup, transaction, or source commit path. The records are pure dormant values. Persistence and atomic source transactions remain K-334 work.

## Runtime non-reachability

The new module is imported only by its protocol test. There is no production consumer, writer registration, mutation interception, admission runtime, outbox enqueue/delivery, K-328 call, eligibility evaluation, feature flag, startup path, or UI.

## Remaining K-333 work

- production reviewed-manifest membership record/relationship
- raw receipts and compacted projections
- lifecycle lineage and tombstone chains
- Merkle/MMR and checkpoint proofs
- bootstrap and restore evidence
- attachment classification
- remaining compatibility relationships and complete graph integration

## Production eligibility verdict

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
