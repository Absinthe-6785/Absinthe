# K-332 — Define Cross-Module Source Authority and Protocol Contract

## 1. Executive verdict

**Scope confidence: HIGH.** The merged K-331 document and its permanent focused test both name the
same next task and order it before K-333 and K-334:

`K-332 — Define Cross-Module Source Authority and Protocol Contract`

K-332 freezes the handoff contract between the completed K-325 through K-331 architecture chain and
future production protocol, persistence, and runtime work. It does not implement any of those future
layers.

Selected verdicts:

- `K332_CROSS_MODULE_CONTRACT_SELECTED`
- `K333_OWNS_PRODUCTION_PROTOCOL_REPRESENTATION`
- `K334_OWNS_PRODUCTION_PERSISTENCE_AND_ATOMIC_TRANSACTIONS`
- `LATER_INTEGRATION_OWNS_RUNTIME_WIRING_AND_ACTIVATION`
- `ARCHITECTURE_FIXTURES_ARE_NOT_PRODUCTION_EVIDENCE`
- `NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

The implementation is deliberately limited to this document and a deterministic test-only evaluator.
It adds no production import, codec, store, schema version, transaction repository, browser call,
network call, writer registration, source interception, eligibility change, or activation path.

## 2. Repository evidence and scope derivation

### Authoritative repository evidence

| Evidence | Relevant statement | Scope consequence |
|---|---|---|
| `frontend/docs/K-331-production-writer-instrumentation-admission-integration.md`, Executive verdict | Selects source authority, receipt reconciliation, source revision lineage, bootstrap/restore authority, protocol-before-repository order, and keeps every production source ineligible. | K-332 must consume, not redefine, K-331 semantics. |
| Same document, `Future implementation impact` | Assigns strict codecs, canonical preimages, proofs, version gates, and stable errors to K-333; assigns additive stores and bounded transactions to K-334. | K-332 cannot implement production representation or persistence. |
| Same document, `Future K-333 and K-334 ownership` | K-333 implements named codec/domain/version semantics; K-334 implements stores and transactions without inventing authority. | K-332 must provide a complete semantic handoff that both successors can consume. |
| Same document, `Exact K-329/K-330 protocol field audit` | Distinguishes existing coordination identity from new receipt, revision, bootstrap, restore, lifecycle, and authority bindings. | K-332 freezes cross-module responsibility and sequencing, not field encoding. |
| Same document, `Deterministic evidence and production non-reachability` | K-331 fixtures prove contract consistency only and create no production repository, reducer action, codec, store, or caller. | K-332 evidence must retain that honesty boundary. |
| Same document, `Recommended sequence` | Names K-332 exactly, then K-333 protocol/model extension, then K-334 dormant repository. | This is the authoritative K-332 title and placement. |
| `frontend/src/lib/localDatabase/productionWriterAdmissionDefinition.test.ts`, `K331B_FUTURE_TASK_ORDER` | Encodes `K-332_SOURCE_AUTHORITY_AND_PROTOCOL_CONTRACT` before K-333 and K-334. | The permanent test independently confirms the roadmap ordering. |
| PR #589 final merged files and main commit `27d95eaf5819ff0d074bbf9aa8ff58bbc1b7d28b` | The merged K-331 artifact consists of its architecture document and deterministic tests/support. | K-332 starts from the reviewed K-331 exact authority contract. |

Repository, issue, pull-request, commit-message, TODO, and roadmap searches found no separate standalone
K-332 specification and no conflicting K-332 title. The explicit merged roadmap definition is
authoritative but intentionally short; the detailed K-332 contract below is the smallest boundary
needed to connect its named K-331 inputs to its named K-333 and K-334 successors.

### Candidate boundary assessment

| Candidate | Evidence | Decision |
|---|---|---|
| Protocol-to-repository handoff | K-331 requires protocol evolution before repository implementation. | **Owned by K-332 as sequencing and interface contract only.** |
| Authority graph materialization | K-331 defines graph semantics; K-333 owns representation; K-334 owns persistence. | K-332 lists required graph components and their owner, but implements neither. |
| Atomic source transaction | K-331 selects one authority transaction; K-334 is its future repository owner. | K-332 freezes atomicity invariants and rollback boundary only. |
| Bootstrap/restore/reconciliation orchestration | K-331 already defines semantics; production records/codecs/stores are future-owned. | K-332 defines handoff prerequisites, not algorithms or storage. |
| Source-writer activation | Later K-335 through K-340 sequence owns clients, adapters, instrumentation, evidence, and eligibility. | Explicit K-332 non-goal. |
| Compatibility rollout and mixed versions | K-331 requires rejection; K-333 owns production codecs/version enforcement. | K-332 requires fail-closed compatibility evidence but does not assign values or decode records. |
| Shadow verification and activation audit | K-329/K-331 require evidence before eligibility. | K-332 defines the dependency gate; later runtime work produces real evidence. |

## 3. Scope decision

### Selected K-332 responsibility

**Exact task title:** K-332 — Define Cross-Module Source Authority and Protocol Contract

**Purpose:** freeze the normative cross-module inputs, successor outputs, sequencing, atomicity split,
and fail-closed evidence gates required to translate K-331 authority semantics into K-333 production
protocol and K-334 production persistence without making any current source eligible.

K-332 owns:

1. normative predecessor intake and supersession rules;
2. K-333 and K-334 handoff interfaces at the semantic level;
3. the activation dependency graph and its fail-closed ordering;
4. the responsibility split for atomicity, compatibility, failure, rollback, and audit evidence;
5. deterministic architecture-only evidence that exercises those rules.

K-332 explicitly does not own:

- a canonical production envelope, preimage, codec, decoder, proof, version value, or stable production
  error;
- an IndexedDB version, object store, index, migration, persistent repository, lookup, or transaction;
- a writer client, Web Locks adapter, source mutation facade, source interception, runtime bootstrap,
  restore finalization, receipt reconciliation execution, compaction, network behavior, or UI;
- production eligibility, shadow rollout execution, source activation, K-326G changes, or K-328
  production invocation.

Predecessor inputs are the exact K-325 through K-331 contracts catalogued below. Successor outputs are
the frozen semantic inventory, ownership matrix, activation prerequisites, and evidence gates that
K-333 and K-334 must implement without inventing cross-module authority.

Completion requires deterministic evaluation of the fail-closed graph, full ownership separation,
all current sources remaining ineligible, predecessor regression checks, and no production
reachability.

### Rejected alternatives

| Alternative | Why rejected / owner |
|---|---|
| Re-design legacy migration or shadow verification | Completed by K-325; K-332 consumes its verified-generation evidence. |
| Re-design cutover activation or legacy freeze | Completed as a dormant foundation by K-326; real-source handoff remains blocked. |
| Re-open physical-source handoff architecture | K-327 and K-328 own the selected handoff and dormant implementation/evidence. |
| Rebuild writer inventory, eligibility reducer, or durable registry | K-329 and K-330 already own those boundaries. |
| Add canonical envelopes/codecs/proof verification/stable protocol errors | Explicit K-333 ownership. |
| Add source stores, schema upgrades, atomic repositories, or production lookups | Explicit K-334 ownership. |
| Register real writers, intercept mutations, or activate eligibility | Later runtime integration, K-335 through K-340. |
| One broad “production readiness” umbrella | Would hide ownership and permit unsafe partial readiness; rejected in favor of explicit gates. |

### Confidence

**HIGH** — an explicit authoritative K-332 title and responsibility exists in the merged K-331 roadmap
and its permanent task-order test. No conflicting repository evidence exists.

## 4. Predecessor contract inventory

| Task | Normative completed contract | Evidence/implementation level | Unresolved production dependency | Future owner / K-332 handoff |
|---|---|---|---|---|
| K-325 | Source-authority-bound legacy capture, exact-set shadow verification, inactive verified target generation. | Dormant production modules plus fake-IndexedDB evidence; no activation. | Consume verified target without trusting stale status or mutating legacy source. | K-326 consumes; K-332 requires migration/handoff evidence in the activation graph. |
| K-326 | Atomic generation/mode/session cutover contract, append-only settlement, post-cutover legacy freeze. | Dormant production foundation plus fake-IndexedDB tests; real source remains rejected by K-326G. | Safe cross-context legacy-source handoff and real runtime authority. | K-327/K-328 handoff; later activation. |
| K-327 | Physical-source identity, Web Lock linearization, persisted handoff authority, immutable snapshot, bounded evidence. | Architecture document and deterministic test model only. | Production-shaped persistence and browser behavior. | K-328. |
| K-328 | Separate dormant handoff persistence, strict read-only candidate/snapshot behavior, reopen/browser durability evidence. | Dormant production-shaped foundation and browser tests; no production caller. | Writer coordination and production eligibility. | K-329 onward; K-332 requires handoff resolution evidence. |
| K-329 | Reviewed writer set, fixed canonical coordination evidence, reducer/race preconditions, eligibility decision. | Architecture and deterministic tests only. | Durable registry and real transaction domain. | K-330 registry; K-332 consumes the eligibility invariants. |
| K-330 | Dormant single-envelope registry/admission repository with CAS and strict durable validation. | Production module and fake-IndexedDB tests; no writer or K-328 caller. | Source mutation cannot yet share the required authority transaction. | K-331 defines the transaction architecture; K-334 implements it. |
| K-331 | Canonical local-first source authority, immutable receipt lineage, reconciliation actor, bootstrap/restore/lifecycle/attachment/drain semantics. | Architecture document and deterministic test support only; no schema, codec, repository, or caller. | Cross-module semantic freeze, then production protocol and repository. | K-332 contract, K-333 protocol, K-334 repository. |

### Normative, superseded, and test-only evidence

- The current normative K-331 authority is its final K-331G independently resolved graph and the
  document sections that explicitly supersede earlier incomplete K-331D/E/F claims.
- Historical K-331 fixture verdicts marked superseded are not successor inputs.
- K-327, K-329, and K-331 executable models are deterministic architecture evidence, not production
  registrations, persisted production proof, or runtime capability.
- K-325, K-326, K-328, and K-330 contain dormant production modules, but dormancy and missing callers
  mean their records cannot be combined into production readiness.
- Future tasks consume identities and bindings, not raw fixture payloads: namespace, physical source,
  generation, authority graph, writer/session/operation, epoch, source revision, receipt, terminal,
  outbox intent, bootstrap/restore, manifest, protocol/version, and shadow-verification evidence.

## 5. Successor ownership handoff

### K-333 ownership boundary

K-333 receives:

- K-331's final semantic domains and identity/binding relationships;
- K-332's exact dependency graph, atomicity constraints, compatibility gates, and ownership matrix;
- the rule that no caller-supplied readiness value is authority;
- the rule that architecture fixture tokens are never production evidence.

K-333 must produce:

- canonical production envelopes and domain-separated preimages;
- strict total decoders with unknown-field and mixed-version rejection;
- production proof formats and bounded verification;
- version compatibility enforcement;
- emitted and tested stable production protocol errors;
- protocol artifacts that carry every K-332-required binding without duplicating authority.

K-333 must not create stores, perform persistence, register writers, intercept source mutations, or
activate eligibility.

### K-334 ownership boundary

K-334 receives:

- the reviewed K-333 protocol artifacts and compatibility policy;
- K-332's atomic transaction read/write set, sequencing, idempotency, and rollback invariants;
- K-331's source-authority, receipt, revision, bootstrap, restore, lifecycle, attachment, and terminal
  semantics.

K-334 must produce:

- additive source stores/indexes and populated upgrade evidence;
- strict boundary reads using K-333 decoders;
- atomic source, receipt, revision, entity/tombstone, outbox-intent, bootstrap, restore,
  reconciliation, sealing, and finalization repository operations as assigned by K-331;
- deterministic exact-retry and rollback behavior;
- production lookup repositories that return repository-derived authority, never caller truth.

K-334 must not invent a second protocol, weaken K-333 validation, wire production writers, or activate
eligibility.

### Later runtime-integration boundary

Later tasks consume K-333 protocol capability plus K-334 repository capability. They alone may build a
dormant coordination client, Web Locks adapter, writer registration/instrumentation, source mutation
facade, drain runtime, shadow rollout, operational audit, and eventual reviewed eligibility/activation.
They must not infer readiness from module presence and cannot bypass K-326G, K-328 handoff evidence,
K-329/K-330 coordination authority, or K-332's ordered gates.

## 6. Activation dependency graph

The repository order is protocol before repository because K-334 must implement the exact K-333
representation. A source may advance only through this directed graph:

```text
unregistered
  -> dormant
  -> architecture_admissible
  -> protocol_capable
  -> repository_capable
  -> shadow_capable
  -> production_eligible
  -> activated
```

| State | Exact minimum prerequisite | Current reachability |
|---|---|---|
| `unregistered` | No durable registration. | Current real writers. |
| `dormant` | Exact namespace/source/generation/session-bound dormant registration. | Only dormant architecture/repository foundations, not real writers. |
| `architecture_admissible` | Dormant registration plus accepted K-332 contract binding. | Test-only evaluation. |
| `protocol_capable` | Architecture-admissible plus compatible K-333 production protocol capability. | Unreachable; K-333 absent. |
| `repository_capable` | Protocol-capable plus K-334 repository capability and atomicity evidence. | Unreachable; K-334 absent. |
| `shadow_capable` | Complete authority graph, resolved migration/handoff, complete bootstrap/restore, current writer/session, terminal/outbox authority, stable source, and shadow evidence. | Architecture fixture may model this state only; never production evidence. |
| `production_eligible` | Shadow-capable plus complete runtime wiring, real evidence, reviewed activation policy, and all compatibility/audit gates. | Forbidden/unreachable in K-332. |
| `activated` | Production-eligible plus a future atomic activation commit. | Forbidden/unreachable in K-332. |

No edge may be skipped. Repository capability without protocol capability is invalid because K-334 may
not invent representation. Runtime wiring without every earlier artifact remains ineligible. A
test-only artifact can reach at most `shadow_capable` and the evaluator's return type fixes both
`eligible` and `activated` to `false`.

## 7. Fail-closed sequencing rules

| Missing or conflicting evidence | Architecture result | Production consequence |
|---|---|---|
| No registration | `REGISTRATION_MISSING` | Remain `unregistered`. |
| K-332 intake incomplete | `ARCHITECTURE_CONTRACT_INCOMPLETE` | Remain dormant. |
| Protocol capability missing | `PROTOCOL_CAPABILITY_MISSING` | Cannot reach protocol/repository capability. |
| Repository capability missing | `REPOSITORY_CAPABILITY_MISSING` | Cannot reach repository/shadow capability. |
| Atomicity evidence missing | `ATOMICITY_EVIDENCE_MISSING` | No source mutation may start. |
| Compatibility evidence missing | `COMPATIBILITY_EVIDENCE_MISSING` | No mixed or inferred compatibility. |
| Authority record/binding incomplete | `AUTHORITY_GRAPH_INCOMPLETE` | No normalization or caller repair. |
| Migration or handoff unresolved | `MIGRATION_HANDOFF_UNRESOLVED` | Legacy source remains authority; no activation. |
| Bootstrap/restore authority incomplete | `BOOTSTRAP_RESTORE_INCOMPLETE` | No baseline/finalization inference. |
| Writer/session stale | `WRITER_SESSION_STALE` | Reject the operation; do not transfer identity. |
| Terminal/outbox authority missing | `TERMINAL_OUTBOX_AUTHORITY_MISSING` | Do not infer commit or replay source mutation. |
| Shadow verification missing | `SHADOW_VERIFICATION_MISSING` | Cannot become production-eligible. |
| Contract/capability versions differ | `VERSION_INCOMPATIBLE` | Fail closed; no permissive default or downgrade. |
| Physical source changes during evaluation | `SOURCE_CHANGED_DURING_EVALUATION` | Discard evaluation and restart from fresh authority. |
| Runtime wiring missing | `RUNTIME_WIRING_MISSING` | Capability modules alone are insufficient. |
| Evidence is an architecture fixture | `ARCHITECTURE_FIXTURE_NOT_PRODUCTION_EVIDENCE` | Never register or qualify a real source. |
| Activation implementation absent | `PRODUCTION_ACTIVATION_NOT_IMPLEMENTED` | Eligibility and activation remain false. |

These are K-332 architecture-evaluator errors only. All 17 are emitted by deterministic paths and
tested; none is reserved. They are not final production protocol error names. K-333 owns those names,
encodings, privacy bounds, and compatibility behavior.

## 8. Atomicity responsibility split

### Architecture-level atomicity defined by K-332

K-332 requires one future linearizable authority boundary to validate admission, current
namespace/source/generation/session/epoch, expected source revision, immutable outbox intent, entity or
tombstone change, next source revision, and immutable receipt. Either all authority writes commit, or
none do. Reconciliation may update only the coordination terminal projection after independently
verifying immutable repository authority. Bootstrap/restore finalization must derive one exact durable
graph. No caller-provided `ready`, `committed`, `quiescent`, or evidence boolean is authoritative.

### K-333 representation responsibility

K-333 represents every transaction input, output, identity, digest, revision, proof, version, and
stable error canonically. It does not perform persistence or claim transaction atomicity.

### K-334 persistence responsibility

K-334 chooses the additive store layout and implements transaction boundaries, strict rereads,
compare-and-swap, append-only receipt/revision evidence, exact retry, abort, rollback, and durable
lookup behavior. It must prove populated upgrades preserve earlier K-321 through K-330 data.

### Runtime orchestration responsibility

Later integration acquires transient cross-context serialization, calls the repository once with a
bounded admitted handle, projects committed source state to memory, and reconciles terminal evidence.
It owns retries, drain orchestration, shadow operation, and operational UX but cannot expand the
repository transaction or manufacture authority.

## 9. Version and compatibility ownership

K-332 defines only semantic compatibility requirements:

- every artifact binds the same namespace, physical source, generation, and writer session;
- K-333 protocol and K-334 repository capability versions must be mutually supported;
- unknown, malformed, mixed, stale, or downgraded evidence fails closed;
- a capability version is insufficient without an exact persisted graph and runtime evidence;
- compatibility must be checked again at the transaction/activation boundary.

K-333 owns canonical version fields, codecs, decoder behavior, proof verification, compatibility
tables, and stable errors. K-334 owns persistent version storage, additive migration, and atomic
boundary enforcement. Later rollout owns deployment sequencing and mixed-client operational policy.
K-332 assigns no production version number and emits no production record.

## 10. Failure and rollback ownership

- K-332 defines the invariant: any missing or conflicting evidence preserves the previous durable
  authority state and cannot create eligibility.
- K-333 defines machine-readable failure representation and bounded production diagnostics.
- K-334 implements transaction abort, exact retry, receipt-backed reconciliation, and durable
  recovery lookups. It must never normalize malformed authority or replay an ambiguous mutation.
- Later runtime integration decides bounded retries and operator/user presentation. It must not treat
  timeout, lost context, or missing terminal projection as proof of source failure.
- K-326's conservative post-activation rollback policy remains unchanged. K-332 adds no rollback,
  repair, cleanup, restore execution, or source rewrite.

## 11. Deterministic evidence model

`crossModuleSourceAuthorityK332.testSupport.ts` models abstract, test-only evidence artifacts bound to
one namespace, physical source, generation, and writer session. It is intentionally not a canonical
codec or durable schema. The evaluator:

1. builds no implicit default and accepts no readiness boolean;
2. derives the highest architecture state from present, compatible, exactly bound evidence;
3. emits distinct fail-closed architecture blockers;
4. checks source stability across the evaluation observation;
5. enforces protocol-before-repository ordering;
6. permits a fixture to model at most `shadow_capable`;
7. always returns `eligible: false` and `activated: false`.

The focused suite exercises the actual evaluator for missing protocol, repository, atomicity,
compatibility, authority, handoff, bootstrap/restore, session, terminal/outbox, shadow, version,
source-stability, runtime, and evidence-class failures. It also verifies responsibility ownership,
every activation prerequisite, intermediate-state ordering, caller-flag non-authority, and complete
error emission. The fixtures provide deterministic contract evidence only.

Minimum future production audit evidence before eligibility can even be considered:

- exact reviewed K-333 protocol version and canonical artifact digests;
- exact K-334 schema/repository version and populated-upgrade evidence;
- atomic commit/abort/exact-retry evidence for every source transaction class;
- independently derived authority graph, receipt lineage, terminal/outbox, bootstrap/restore, and
  compatibility evidence;
- K-325 migration and K-328 physical-source handoff binding to the same namespace/generation;
- current K-329/K-330 writer/session/epoch evidence and complete writer instrumentation coverage;
- stable-source and shadow comparison evidence;
- browser/platform and mixed-version rollout evidence;
- static and runtime proof that no bypassing legacy or direct source writer remains.

## 12. Production eligibility verdict

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

Architecture capability alone is insufficient. K-333 alone is insufficient. K-334 alone is
insufficient. K-333 plus K-334 without real runtime wiring, complete writer coverage, source handoff,
authority evidence, browser/platform evidence, and shadow verification is insufficient. Runtime wiring
without all predecessor evidence is also insufficient.

K-333, K-334, and later runtime integration do not exist on this branch. K-326G remains unchanged and
fail-closed. K-328 has no production invocation. No current source can reach `production_eligible` or
`activated`.

## 13. Completion criteria

K-332 is complete when:

- its scope is traceable to the exact merged K-331 title/order;
- K-325 through K-331 normative inputs and superseded/test-only evidence are distinguished;
- K-333, K-334, and later runtime outputs are non-overlapping;
- activation states and fail-closed sequencing are explicit;
- atomicity, compatibility, failure, rollback, and audit ownership are explicit;
- deterministic tests exercise the evaluator instead of asserting only policy constants;
- every architecture error is emitted and tested with no reserved code;
- no fixture can become production-eligible or activated;
- no production implementation or reachability is added;
- focused, predecessor, localDatabase, recovery, typecheck, build, diff, and full frontend validation
  are recorded on the exact head.

## 14. Deferred work

- **K-333:** production protocol/model extension, strict codecs/decoders, canonical preimages,
  proofs, versions, compatibility enforcement, stable production errors.
- **K-334:** additive source persistence, populated schema upgrade, atomic source/repository
  transactions, exact durable lookup/retry/rollback behavior.
- **Later integration:** dormant coordination client, Web Locks adapter, writer instrumentation,
  drain/browser evidence, K-328 consumer, eligibility evaluation, reviewed rollout and activation.
- **Operational evidence:** real-browser, multi-context, crash, quota/eviction, worker, mobile,
  mixed-version, observability, and operator UX evidence.

K-332 does not start or partially implement any deferred item.

## 15. Exact validation evidence

Exact working-tree validation before commit:

| Check | Result |
|---|---|
| `npm test -- --run src/lib/localDatabase/crossModuleSourceAuthorityK332.test.ts` | 1 file, 22/22 passed |
| `npm test -- --run src/lib/localDatabase/productionWriterAdmissionDefinition.test.ts` | K-331: 1 file, 62/62 passed |
| `npm test -- --run src/lib/localDatabase/dormantWriterCoordinationRepository.test.ts` | K-330: 1 file, 51/51 passed |
| `npm test -- --run src/lib/localDatabase/writerCoordinationEligibility.test.ts` | K-329: 1 file, 122/122 passed |
| `npm test -- --run src/lib/localDatabase/crossContextHandoff` | K-328: 2 files, 73/73 passed |
| `npm test -- --run src/lib/localDatabase/crossContextSourceHandoffSpike.test.ts` | K-327: 1 file, 391/391 passed |
| `npm test -- --run src/lib/localDatabase/localFirstCutover.test.ts` | K-326: 1 file, 78/78 passed |
| `npm test -- --run src/lib/localDatabase/legacyNotes` | K-325: 3 files, 238/238 passed |
| `npm test -- --run src/lib/localDatabase/` | 15 files, 1,250/1,250 passed |
| `npm test -- --run src/lib/recovery` | 2 files, 70/70 passed; no rerun needed |
| `npm run typecheck` | editor, bare-identifier, and app checks passed |
| `npm run build` | passed; 2,480 modules transformed |
| `git diff --check` | passed |
| `npm test` | 584 files passed, 1 skipped; 5,529 tests passed, 7 skipped |

The build retained the repository's existing dynamic/static-import and greater-than-500-kB chunk
warnings. No K-332 production import exists. No real-browser evidence is claimed by K-332.
