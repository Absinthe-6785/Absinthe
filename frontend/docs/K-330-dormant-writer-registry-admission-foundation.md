# K-330 Dormant Writer Registry and Admission Foundation

## Verdict and scope

`DORMANT_DURABLE_WRITER_REGISTRY_FOUNDATION_SELECTED`

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

K-330 adds a durable repository for the exact K-329 coordination model. It is infrastructure only.
It does not activate Web Locks, register a production writer, admit a production mutation, invoke
K-328, change the Notes source of truth, consume eligibility evidence, or call startup, hydration,
sync, restore, migration, UI, network, timer, worker, or service-worker code. The module requires an
unforgeable developer/test capability and is deliberately absent from the local-database public
barrel.

K-330 provides a dormant durable coordination repository foundation only. It does not activate
writer coordination, source eligibility, or local-first cutover.

## Storage architecture

The selected design uses the existing dormant `absinthe-local-v2` IndexedDB database, upgraded
additively from version `3` to version `4`, with one new store:

| Property | Contract |
|---|---|
| Store | `writer_coordination_state` |
| Key | `[namespaceFingerprint, generationId]` out-of-line compound key |
| Value | canonical UTF-8 `Uint8Array` envelope |
| Indexes | none |
| Auto-increment | false |
| Records | at most one coordination state per namespace/generation key |
| Envelope ceiling | K-329 1 MiB model ceiling plus 4 KiB wrapper allowance |
| Namespace binding | SHA-256 fingerprint of user/project/device/schema; raw components are not persisted |
| Generation binding | exact bounded local-database generation ID |

The store is additive. Existing stores, rows, indexes, active generation, entities, outbox,
checkpoints, restore/migration state, attachment metadata, and cutover evidence are not cleared,
rewritten, or re-keyed. A populated version-3 upgrade test proves unrelated data survives.

### Rejected split-store design

Separate stores for registrations, operations, checkpoints, source evidence, eligibility evidence,
and authority were rejected for K-330. Although a multi-store IndexedDB transaction could update
them atomically, restart reads and recovery tooling would need more keys, more count/duplicate
invariants, and more opportunities for manually injected split-brain graphs. The K-329 model is
already a bounded canonical aggregate. One envelope therefore gives a stronger and simpler rule:
the previous graph or the complete next graph is visible, never a mix.

No second IndexedDB database was introduced. This preserves the K-321 namespace/generation and
upgrade boundary rather than creating a competing storage architecture.

## Canonical envelope

The persisted envelope contains exactly:

```text
kind
schemaVersion
databaseNamespace
databaseGeneration
coordinationEpoch
transitionRevision
authorityDigest
canonicalModelDigest
coordinationModel
```

Encoding first uses `encodeWriterCoordinationModelCanonical`. The wrapper stores the parsed
primitive-only canonical model, SHA-256 of its exact canonical bytes, and the exact K-329 authority
digest. The fixed-order wrapper is then encoded as UTF-8 JSON.

Decoding rejects invalid UTF-8, empty/oversized bytes, duplicate/extra/missing keys, accessors,
unsupported envelope versions, noncanonical key order, namespace/generation mismatch, model or
authority digest mismatch, noncanonical model bytes, unsupported K-329 schema, and every K-329
structural or relational failure. It re-encodes the complete envelope and requires byte equality.
No field is normalized, defaulted, repaired, or inferred.

The decoder returns only a detached full model after
`decodeWriterCoordinationModelCanonical`, `validateWriterCoordinationModelState`, and
`validateWriterCoordinationModelRelations` all succeed. A canonical individual record is not
sufficient authority for a whole persisted graph.

## Repository and transaction boundary

`openDormantWriterCoordinationDatabase` opens the existing versioned database only with an explicit
K-330 capability. Every mutation opens one strict read/write transaction on the envelope store,
reads and fully decodes the current bytes inside that transaction, checks the complete CAS token,
applies the K-329 pure reducer, validates the complete resulting graph, and writes one replacement
envelope. Resolution occurs only on `transaction.oncomplete`; any failure aborts the transaction.

| Mutation | Atomic transaction content | Required CAS evidence |
|---|---|---|
| Initialize epoch | expected-absent read plus initial envelope add | generation and exact initialization input |
| Register writer | current envelope read, K-329 `REGISTER_WRITER`, envelope put | generation, epoch, revision, authority digest, writer ID/session in action |
| Transition writer / drain acknowledgement | current read, K-329 `ACKNOWLEDGE_DRAIN`, put | base CAS plus exact writer session and drain revision |
| Admit operation | current read, K-329 `ADMIT_OPERATION`, put | base CAS plus operation/writer/session/source revision in action |
| Transition operation | current read, K-329 `TERMINALIZE_OPERATION`, put | base CAS plus exact persisted operation state |
| Capture checkpoints 1–4 | current read, phase-specific K-329 action, put | base CAS plus exact previous checkpoint digest |
| Epoch transition | current read, K-329 `MARK_QUIESCENT`, put | generation, old epoch, revision, authority digest |
| Source evidence + checkpoint 5 | current read, one K-329 source action, one put | base CAS, checkpoint-4 digest, stable source revision |
| Eligibility evidence + checkpoint 6 | current read, two pure reducer steps in memory, one final put | base CAS, checkpoint-5 digest, stable source revision, verifier session |
| Test-only full replacement | current read, full target decode/relation validation, one put | exact base CAS and test capability |

The generic action method cannot bypass specialized requirements. Checkpoint actions require the
predecessor token; source capture requires predecessor and source revision; operation terminalization
requires the expected operation state; checkpoint 6 and eligibility commit are rejected outside the
atomic eligibility method.

## Epoch, admission, and revision CAS

Every normal mutation binds the repository generation plus the K-329 authority epoch, transition
revision, and authority digest. Relevant transitions additionally bind predecessor checkpoint,
operation state, or stable source revision. Mismatches are stable and payload-free:

```text
WRITER_COORDINATION_GENERATION_MISMATCH
WRITER_COORDINATION_EPOCH_MISMATCH
WRITER_COORDINATION_REVISION_MISMATCH
WRITER_COORDINATION_AUTHORITY_MISMATCH
WRITER_COORDINATION_CHECKPOINT_PREDECESSOR_MISMATCH
WRITER_COORDINATION_OPERATION_STATE_MISMATCH
WRITER_COORDINATION_SOURCE_REVISION_MISMATCH
```

IndexedDB serializes concurrent read/write transactions on the single store. Two contexts using the
same current CAS cannot both win: the first completed put advances the revision/digest, and the next
transaction reads that committed state and fails its stale token. No last-write-wins path exists.

K-330 deliberately reuses K-329 registration, operation, drain, checkpoint, source, and eligibility
actions. It does not duplicate the reducer, manifest authority, canonical model codec, current-graph
derivation, relation validator, or eligibility evaluator. No K-329 pure-model extension was needed.

## Restart contract

| Persisted condition | Result |
|---|---|
| No record for exact key | `{ status: 'empty' }`; distinct from corruption |
| Valid canonical envelope | detached complete state and current CAS token |
| Unsupported envelope/model schema | `DORMANT_WRITER_COORDINATION_SCHEMA_UNSUPPORTED` |
| Stale generation binding | `WRITER_COORDINATION_GENERATION_MISMATCH` |
| Malformed/noncanonical/digest-invalid state | `CORRUPT_PERSISTED_RECORD` |
| Missing counterpart or partial graph | rejected; no repair |
| Mixed revisions/epochs/digests | rejected; no repair |
| K-329 relational inconsistency | rejected before state return |
| Checkpoint 6 without eligibility | rejected as a non-persistable K-330 transient state |

Source evidence and checkpoint 5 are produced by one reducer transition and one envelope write.
Eligibility checkpoint 6 is intentionally transient in memory and is persisted only with the final
eligibility evidence/authority transition. Transaction-abort tests prove no source/checkpoint or
eligibility/checkpoint half-state survives. Manually inserted partial bytes remain corrupt on every
read; the repository does not repair or delete them.

## Deterministic concurrency evidence

Fake-indexeddb tests use two independently opened repository contexts against one physical store.
They prove one-winner CAS behavior for:

- different writer sessions registering against one revision;
- the same writer/session registering concurrently;
- one writer ID with competing sessions;
- competing operation admissions;
- competing checkpoint capture;
- competing source-evidence capture;
- competing atomic eligibility commits;
- epoch transition racing a late registration;
- stale generation tokens against generation-isolated keys.

The loser receives a stable revision, generation, model, or relevant specialized mismatch. Tests do
not use sleeps or timing thresholds. IndexedDB's store transaction queue is the deterministic
linearization boundary.

## Failure, corruption, and privacy

Failures expose a bounded code, stable operation label, and at most a bounded K-329 model error code.
They never contain namespace components, persisted bytes, registrations, operations, source
evidence, user content, raw IndexedDB exceptions, stack, or cause. Unknown exceptions map to a
bounded transaction failure.

Permanent test-capability failure injection aborts immediately after an IndexedDB write request and
before completion. It is rejected for developer capability. This proves initialization, registration,
source/checkpoint, eligibility/checkpoint, and replacement writes leave the previous state intact.

## K-328 and Web Locks boundaries

K-328 physical-source binding is persisted only as already validated K-329 evidence. The source and
eligibility records must retain the exact physical-source digest across restart. K-330 neither calls
K-328 nor manufactures its evidence.

K-329 selected Web Locks plus durable registry/epoch admission. K-330 implements only the durable
repository half. It does not call `navigator.locks`, decide browser support, coordinate production
contexts, or claim cross-context source mutation safety. IndexedDB CAS prevents two repository
envelope updates from silently overwriting each other; it does not make existing Notes source writes
atomic with registry/operation transitions.

## Production dormancy

A permanent source audit proves that no non-test application module imports the open/capability
entrypoints. The isolated repository imports no Notes writer, K-328 handoff, cutover, migration,
Supabase/network, React/UI, timer, worker, or service-worker module. K-326G remains explicitly
cross-context unsafe. Existing stores are never cleared or deleted.

`K330_DURABLE_FOUNDATION_HAS_NO_PRODUCTION_CALLER`

## Validation

Validation totals at the K-330 implementation head:

| Command | Result |
|---|---|
| K-330 focused repository | 47 passed; 1 file; 7.50 s; fake-indexeddb |
| K-329 model | 122 passed; 1 file; 8.13 s |
| K-328 handoff | 73 passed; 2 files; 1.25 s |
| K-327 spike | 391 passed; 1 file; 2.02 s |
| K-326 cutover | 77 passed; 1 file; 2.91 s |
| K-325 migration | 150 passed; 1 file; 2.32 s |
| localDatabase | 1,148 passed; 13 files; 11.12 s |
| recovery | 70 passed; 2 files; 12.92 s |
| typecheck | passed; 29.1 s |
| build | passed; 2,480 modules; 13.93 s; existing mixed-import/chunk-size warnings only |
| `git diff --check` | passed; line-ending conversion notices only |
| full frontend | 5,426 passed / 7 skipped; 582 passed / 1 skipped files; 226.31 s |

No flaky or nondeterministic failure occurred. During implementation, one fixture expectation and
two intermediate TypeScript transform errors in a CAS hardening edit were corrected before the
final validation sequence. Initial focused and full-suite shell invocations were also ended by a
five-second orchestration limit before producing test results. The final exact working tree passed
every command above without rerun.

## Residual blockers

Architecture blockers: none for the dormant single-envelope repository.

Production implementation blockers:

- existing Notes writers are not instrumented, registered, drain-aware, or operation-admitted;
- source mutation and operation terminalization are not one production transaction;
- localStorage cannot join the IndexedDB coordination transaction;
- no production K-328 adapter, Web Locks coordinator, eligibility consumer, or rollout exists.

Browser/platform blockers:

- no real-browser multi-tab, crash, quota, eviction, private-mode, or Web Locks evidence;
- no mobile or service-worker lifecycle evidence.

UX/operational blockers:

- no operator drain, maintenance, restart diagnosis, corruption handling, or recovery UX;
- no approved production activation or rollback procedure.

Therefore `NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE` remains mandatory.

Next action: `K-330 — Focused Durable Registry Review`.
