# K-333B — Production Transaction Evidence Records

## Executive verdict

K-333B promotes the four record-specific execution-evidence contracts frozen by K-331 into dormant production canonical codecs. K-333B1 closes the original thin-evidence replay gap: an admitted decision, immutable outbox intent, and committed terminal state now self-digest-commit one shared `exactOperationDigest`, and the public graph validates the K-331 operation/terminal/outbox authority roots plus all nine compatibility edges. K-333B2 adds permanent adversarial evidence, and K-333B3 closes the remaining compatibility-selector and loop-structure evidence gap without changing production protocol semantics. No persistence, source mutation, admission caller, delivery runner, or eligibility path is added.

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

The four selected records are the smallest closed K-331 execution-evidence chain. The K-331 operation-identity rule states that an exact same identity and canonical input is idempotent and that the same operation ID with any changed field fails. K-333B1 represents that already-selected meaning as `exactOperationDigest`: a domain-separated canonical digest over the operation kind/version, ID, namespace, generation, admission ID, writer/session IDs and digests, mutation kind, committed revision, affected-identity digest, canonical-input digest, result digest, outbox ID, and immutable outbox-intent digest.

The commitment deliberately excludes `admissionDigest`, dependent self-digests, and its own digest. Admission, outbox, and terminal records can therefore bind it without a cycle. `canonicalInputDigest` alone was rejected because it does not commit writer/session, namespace/generation, mutation kind, revision, result, or evidence identities. `outboxIntentDigest` alone was rejected because delivery intent is not the complete admitted-operation authority. Binding `OperationRecord.operationDigest` from admission was rejected because the operation self-digest already commits `admissionDigest` and would create a cycle.

The finite construction order is: writer identity, writer session, exact-operation commitment, admission, operation/outbox/terminal records, the three one-record authority roots and source authority, then the unchanged K-333A transaction reference. The exact-operation preimage contains only forward IDs for admission and outbox; it contains no dependent self-digest. There is no placeholder, zero, sentinel, two-pass patch, or digest cycle.

Rejected admissions and aborted/failed terminals are deliberately not invented: the authoritative K-331 record-specific schemas select only `admitted` and `committed`. They may be modeled by a later reviewed version, not by widening v1.

## K-333A foundation reuse

K-333B reuses canonical value snapshotting, NFC/surrogate checks, canonical UTF-8 serialization, bounded decoding, strict exact-object snapshots, stable `ProtocolResult` errors, domain-separated preimages, and SHA-256. It adds only four registered preimage domains and record-specific protocol/graph functions.

## Record and self-digest inventories

Every field except the named self-digest is included in the v1 preimage. No record has optional fields, arrays, generic payloads, mutable status, timestamps, or caller-defined metadata.

### `absinthe_k330_operation` v1

- Fields: `kind`, `version`, `id`, `namespace`, `generation`, `admissionId`, `admissionDigest`, `writerId`, `writerDigest`, `sessionId`, `sessionDigest`, `mutationKind`, `committedRevision`, `affectedIdentityDigest`, `canonicalInputDigest`, `resultDigest`, `outboxId`, `outboxIntentDigest`, `exactOperationDigest`, `operationDigest`
- Self-digest: `operationDigest`
- Domain: `absinthe.operation.v1`
- Closed mutation kinds: `note_upsert`, `note_tombstone`

### `absinthe_k330_admission` v1

- Fields: `kind`, `version`, `id`, `operationId`, `writerId`, `sessionId`, `exactOperationDigest`, `decision`, `admissionDigest`
- Self-digest: `admissionDigest`
- Domain: `absinthe.admission.v1`
- Closed decision: `admitted`

### `absinthe_immutable_outbox_intent` v1

- Fields: `kind`, `version`, `id`, `operationId`, `intentDigest`, `exactOperationDigest`, `outboxDigest`
- Self-digest: `outboxDigest`
- Domain: `absinthe.immutable_outbox_intent.v1`

### `absinthe_terminal_state` v1

- Fields: `kind`, `version`, `id`, `operationId`, `state`, `resultDigest`, `exactOperationDigest`, `terminalDigest`
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
- admission operation/writer/session identities and exact-operation commitment match;
- operation outbox identity, intent digest, and exact-operation commitment match the immutable intent;
- terminal operation, result digest, and exact-operation commitment match;
- source authority `operationRegistryRoot`, `terminalRoot`, and `outboxRoot` match the selected operation, terminal, and outbox self-digests;
- transaction reference operation/admission/outbox/terminal IDs and self-digests match;
- transaction reference committed revision matches both operation and source authority.

The three roots use the exact K-331 single-record canonical formulas:

- `SHA-256(["ABSINTHE_OPERATION_REGISTRY_ROOT_V1", 1, [operationDigest]])`
- `SHA-256(["ABSINTHE_TERMINAL_ROOT_V1", 1, [terminalDigest]])`
- `SHA-256(["ABSINTHE_OUTBOX_ROOT_V1", 1, [outboxDigest]])`

These are bounded one-record roots for the representative graph, not a claim of general Merkle/MMR proof verification. The K-333A reference schema and stable vectors are unchanged. MMR and checkpoint references remain opaque beyond the K-333A authority relation.

## Compatibility relationships

The compatibility table is frozen and closed. The public graph validator invokes the same fixed internal edge inventory immediately after all records independently decode and before any dependent relationship use. Exactly nine v1/v1 tuples are supported and invoked:

1. writer identity → operation
2. writer session → operation
3. operation → admission
4. operation → immutable outbox intent
5. operation → terminal state
6. operation → source transaction reference
7. admission → source transaction reference
8. immutable outbox intent → source transaction reference
9. terminal state → source transaction reference

The fixed inventory is not caller-extensible or attacker-controlled. Strict v1 record decoders make an unsupported version unreachable inside a successfully decoded graph. K-333B3 independently fixes one test-owned selector-plus-tuple literal for every runtime edge, compares the complete objects against the graph inventory, and separately compares its tuple projection against the compatibility table. The test proves exact cardinality, selector-pair and complete-edge uniqueness, order, and deep immutability.

K-333B3 also uses the existing TypeScript compiler API to parse only `transactionEvidenceProtocol.ts` and inspect the target public graph function. The bounded static guard requires every independent decode declaration and immediate failure return to precede the loop; the loop to iterate the closed inventory; exactly one unconditional `validateTransactionEvidenceCompatibility` call after the two selector reads; an immediate per-edge `if (!compatible.ok) return compatible`; and representative relationship validation only after the loop. Small test-only mutated source variants prove selector drift, pre-call `continue`/`break`, a final decode check moved below the loop, ignored compatibility output, and relationship validation moved before the loop are rejected. This is structural evidence of the current v1 source shape, not behavioral evidence that unsupported future-version records reach the graph compatibility branch. Lower, higher, malformed, reversed, and unlisted direct tuples fail closed. Complete K-333 compatibility across receipts, MMR/checkpoints, lifecycle, bootstrap, restore, and attachments remains deferred.

## Stable errors and resource bounds

No new error code was added. K-333B uses the 18 frozen K-333A codes and bounded operation/field labels. Record kinds and semantic enums are closed; identifiers use the inherited 3–256 character lowercase identifier grammar, digests are 64 lowercase hexadecimal characters, and revisions use canonical 1–16 digit decimal strings. Records are additionally bounded by the inherited 32 KiB canonical encoding ceiling, 128-key ceiling, 4 KiB UTF-8 string ceiling, depth 32, and 2,048-node ceiling. The selected v1 records contain no arrays, so manifest/capability array limits do not apply in this scope.

## Runtime totality and Proxy handling

All exported untrusted boundaries accept `unknown`, exact-snapshot before field access, reject unknown/accessor/symbol fields and unsupported prototypes, and contain active, throwing, and revoked Proxy failures. Creators return detached frozen records. No caller-owned array/object or error is retained.

## Stable vectors and test evidence

The exact-operation commitment and each modified record have fixed independent canonical payload, framed preimage, and lowercase SHA-256 digest literals. Operation has 20 declared fields and commits 19; Admission has 9/8; Outbox has 7/6; Terminal has 8/7. In every case only the named self-digest is excluded. Tests cover strict create/decode/byte round trips, versions/kinds/fields/types/enums/revisions/digests, hostile runtime inputs, every mutable non-self field commitment, self-digest corruption, all nine compatibility edges, same-ID/different-operation replay, cross-graph mixing, independently resealed root mismatches, and fixed vectors.

K-333B2 permanently constructs a fully resealed arbitrary-commitment attack without changing any underlying Operation semantic field. Admission, Outbox, Terminal, all three authority roots, SourceAuthority, and SourceTransactionReference are rebuilt around the forged commitment; their individual decoders pass, and the forged Operation self-digest is independently checked against its canonical framed preimage. The public Operation decoder recomputes the authoritative commitment from Operation fields and rejects with `RELATIONSHIP_MISMATCH`; the public graph returns the same bounded failure. The attack therefore fails because its carried commitment is semantically false, not because a dependent record, root, authority digest, or reference digest is stale.

K-333B3 focused tests pass 19/19 and the full K-333 protocol suite passes 93/93. The fully resealed K-333B2 forged-commitment attack remains unchanged and green. This evidence-only correction changes no production source file, record schema, field inventory, preimage domain, authority-root formula, compatibility tuple, stable vector, or error code. Existing K-333A record schemas and vector literals are unchanged.

Adjacent focused results are K-332 22/22, K-331 62/62, K-330 51/51, K-329 122/122, K-328 73/73, K-327 391/391, K-326 78/78, and K-325 238/238. The localDatabase suite passes 1,344/1,344, recovery passes 70/70, typecheck passes, build passes with 2,480 modules transformed, and `git diff --check` passes. Repository-default full concurrency reports 5,615 passed / 7 skipped and seven timing failures across recovery export, K-330/K-328 dormancy scans, and legacy Analytics; the affected files independently pass 52/52, 51/51, 3/3, and 4/4. A new single-worker full run was not practical after the preceding attempt exceeded the external 10-minute command limit without reporting a failure. Exact-head CI is the final merge-gating authority.

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
