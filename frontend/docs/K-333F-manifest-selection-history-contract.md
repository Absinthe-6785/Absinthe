# K-333F: Manifest Selection and History Contract Definition

## 1. Executive contract

**Result: `CONTRACT_READY_FOR_OWNER_REVIEW`.** This is a documentation-only future-contract definition for the proposed K-333 Manifest Selection and History Authority. It defines the authority boundary that may later select one existing K-329 canonical manifest for one exact subject, retain reconstructible selection history, and resolve historical bytes. It creates no production authority, record, codec, store, selector, API, registry, migration, or runtime behavior.

`DEFINED_FOR_FUTURE_CONTRACT`: a valid selection/history proof may establish that one K-329 manifest content digest was selected by the future selection authority for one exact physical-source/namespace/generation subject, under one selection-contract version, at one reconstructible effective history boundary. It does **not** establish writer membership, context or capability conformity, session conformity, authorization, admission, eligibility, or activation.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Predecessor and authority baseline

K-333E was merged through PR #595. Its owner-decision proposal defines the future selection subject as physical source + namespace + generation; requires immutable, append-only selection history and historical byte resolution before enforcement; keeps revocation and rollback owner-governed; and separates selection from persistence, identity adoption, conformity, authorization, admission, eligibility, and activation.

This contract preserves that sequence. Its definitions are recommendations for future owner approval and do not grant the proposed authority permission to act today.

## 3. Existing source facts

| Source | Symbol / heading | Lines | Authority classification | Fact preserved |
|---|---|---:|---|---|
| `frontend/src/lib/localDatabase/writerCoordinationEligibility.ts` | `ReviewedWriterManifest` | 122-138 | `ALREADY_AUTHORITATIVE` | K-329 owns the existing reviewed manifest representation, physical-source binding, schema version 1, byte-format version 1, manifest version, and entries. |
| `frontend/src/lib/localDatabase/writerCoordinationEligibility.ts` | validation and construction | 475-532 | `ALREADY_AUTHORITATIVE` | Existing manifest validation is strict and source-bound; no namespace or generation fields are added by this contract. |
| `frontend/src/lib/localDatabase/writerCoordinationEligibility.ts` | canonical codec and digest | 694-723 | `ALREADY_AUTHORITATIVE` | K-329 owns canonical bytes and SHA-256 content-digest derivation. |
| `frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts` | `WriterIdentityRecord`, `WriterSessionRecord` | 26-48 | `ALREADY_AUTHORITATIVE` | K-333 stores distinct identity/session values; `manifestDigest` and `capabilityDigest` are digest references, not a selection/history authority. |
| `frontend/docs/K-333E-cross-protocol-owner-decision-proposal.md` | selection and history rows | 79-88 | `ALREADY_AUTHORITATIVE` | Merged K-333E architecture baseline: future selection is subject-scoped, immutable until an explicit event, historically resolvable, and fail-closed when unavailable. |
| `frontend/docs/K-333E-cross-protocol-owner-decision-proposal.md` | selection decision and dependency direction | 130-142 | `ALREADY_AUTHORITATIVE` | Merged K-333E architecture baseline: the future selection authority is separate from persistence and downstream consequences remain separate. |

No existing source resolves a historical K-329 manifest by digest for K-333, selects a manifest for a K-333 subject, evaluates selection history, supersedes or revokes a selection, or treats `WriterIdentityRecord.manifestDigest` as complete selection authority.

## 4. Contract status and terminology

The only statuses used for contract decisions are:

- `ALREADY_AUTHORITATIVE` — existing K-329/K-333 source fact that K-333F does not extend.
- `DEFINED_FOR_FUTURE_CONTRACT` — a future contract rule defined here, pending the required owner-approved implementation phase.
- `OWNER_DECISION_REQUIRED` — a policy choice intentionally not inferred here.
- `DEFERRED` — a later authority or implementation concern outside this contract.
- `REJECTED` — an explicitly unsafe interpretation that a later contract must not adopt.

“Selection event”, “subject”, “sequence”, “head”, and “resolution” below are conceptual terms only. They are not field names, schema names, storage keys, wire formats, API shapes, or production exports.

## 5. Selection subject

`DEFINED_FOR_FUTURE_CONTRACT`: the conceptual subject is:

```text
ManifestSelectionSubject = {
  physicalSourceDigest,
  namespaceId,
  generationId,
}
```

Each component is required for the future authority to issue or resolve selection evidence. K-329 already binds its manifest to `physicalSourceDigest`; K-333 identity records bind namespace and physical source, while K-333 session records additionally bind generation. A selection for one exact tuple is never reusable for another tuple.

| Component | Contract meaning | Replay boundary | Status |
|---|---|---|---|
| physical source | The exact source represented by the K-329-bound digest. A clone receives no implied selection. | Blocks cross-source replay. | `DEFINED_FOR_FUTURE_CONTRACT` |
| namespace | The isolated K-333 namespace in which evidence is evaluated. | Blocks cross-namespace replay. | `DEFINED_FOR_FUTURE_CONTRACT` |
| generation | The exact generation within that namespace. Restore or migration does not promote a prior generation. | Blocks cross-generation and stale-generation replay. | `DEFINED_FOR_FUTURE_CONTRACT` |
| inheritance to a new generation | A later authority may define explicit adoption only after validating source, namespace, compatibility, and history. | No implicit carry-forward. | `OWNER_DECISION_REQUIRED` |

Restore preserves a subject only when restored evidence still names and validates that exact tuple. Migration and source cloning do not imply identity equivalence. A stale generation has no authority to become the current generation through selection history alone.

## 6. Selected manifest identity

`DEFINED_FOR_FUTURE_CONTRACT`: the selected manifest identity is the SHA-256 content digest of the existing K-329 canonical `ReviewedWriterManifest` bytes, together with future ability to resolve the exact canonical bytes for that digest.

- The digest is a content-addressed identity reference; canonical bytes are the semantic material.
- Possession of a digest or bytes does not grant selection authority.
- `WriterIdentityRecord.manifestDigest` remains an opaque integrity/reference input and is not a selector, membership proof, or context/capability proof.
- K-329 remains the sole owner of the canonical manifest codec and canonical content-digest algorithm.

`REJECTED`: newest-by-time, mutable display name, branch name, runtime object identity, arbitrary caller-supplied bytes, and a separate replacement manifest identifier. K-333F creates no new manifest ID and no self-digest.

## 7. Authority and responsibility split

| Role | Future responsibility | Status | Explicit exclusion |
|---|---|---|---|
| K-333 Manifest Selection and History Authority | Owns and issues scoped selection/history decisions after its later authorization policy permits the operation. | `DEFINED_FOR_FUTURE_CONTRACT` | Does not own K-329 bytes/codec, persistence policy, identity adoption, conformity, authorization, admission, eligibility, or activation. |
| K-333 Cross-Protocol Evidence Persistence Authority | Retains and deterministically resolves approved selection/history evidence, bytes or resolution metadata, compatibility metadata, and bounded diagnostics. | `DEFINED_FOR_FUTURE_CONTRACT` | Does not select policy or decide membership/conformity/consequences. |
| K-329 canonical manifest codec | Decodes and validates canonical manifest bytes and content digest. | `ALREADY_AUTHORITATIVE` | Does not select a K-333 subject or preserve selection history. |
| K-333 Identity Adoption Authority | May later consume selection evidence as one input. | `DEFERRED` | Must separately prove identity-to-writer-type adoption. |
| K-333 Conformity Validation Authority | May later consume resolved bytes, lifecycle state, subject, and effective boundary. | `DEFERRED` | Must separately validate identity, context, and capability. |
| Absinthe Protocol Owner | Approves or rejects future architecture decisions through an explicit repository-recorded decision. | `OWNER_DECISION_REQUIRED` | Is not a runtime, record, issuer identity, admission, eligibility, or activation authority. |

Before a future issuer can issue a selection it must have: an exact subject tuple; canonical K-329 bytes whose digest recomputes; matching physical-source binding; a supported future compatibility relation; resolvable prior subject history; and a selection operation authorized by a later owner policy. K-333F defines no runtime API for those checks.

Eligibility must not consume selection as sufficient eligibility. Activation must not consume selection directly. Authorization and admission must not consume selection alone as sufficient evidence.

## 8. Conceptual selection event

Three shapes were considered:

1. one untyped generic event model;
2. unrelated separate records with no shared lifecycle relation; and
3. a conceptual immutable event family with a common subject/history envelope and action-specific semantic payloads.

`DEFINED_FOR_FUTURE_CONTRACT`: choose **3**. The future contract may use a common canonical history envelope, but `SELECT`, `SUPERSEDE`, `REVOKE`, and `ROLLBACK_DECISION` require distinct action semantics and validation rules. `RESTORE_REFERENCE` is an evidence-import/reference action, not an automatic selection action. This is a conceptual model, not a record schema.

Required conceptual components are contract kind and independent contract version; subject tuple; selected manifest digest; manifest format/schema compatibility metadata; predecessor reference; action; subject-local effective sequence; issuer authority reference; bounded reason/decision category; evidence reference; and an event digest derived only after the semantic payload is complete. No event may require its own digest or a successor to construct itself.

## 9. Append-only history model

`DEFINED_FOR_FUTURE_CONTRACT`: history is append-only and subject-local. Prior evidence is immutable; there is no in-place replacement, destructive pruning while referenced, or authoritative mutable current pointer.

The selected ordering model is a **hybrid predecessor reference plus subject-local monotonic sequence**:

- every non-initial event names exactly one predecessor for the same subject;
- every successor has the prior sequence plus one;
- initial selection has no predecessor and the initial sequence;
- a history resolver verifies a single chain, contiguous sequence, exact subject equality, and action-specific transition rules;
- a conflicting head, repeated effective sequence, missing predecessor, cycle, or gap is detectable and fail-closed.

Wall-clock time may be retained as non-authoritative diagnostic metadata only. It cannot order selection history, decide effectiveness, or repair a conflict.

## 10. Event ordering

`DEFINED_FOR_FUTURE_CONTRACT`: the authoritative conceptual order is the verified subject-local sequence and predecessor relation. A future resolver rejects histories with two valid terminal heads, repeated sequence positions, non-contiguous sequence, cross-subject predecessors, missing predecessors, unsupported event versions, or cycles.

`OWNER_DECISION_REQUIRED`: the boundary at which an external session, operation, or transaction must reference a newly issued sequence. Until an owner-approved downstream contract defines that boundary, K-333F does not claim an external evidence item is governed by a new sequence merely because it has a later wall-clock timestamp.

## 11. Current-selection derivation

`DEFINED_FOR_FUTURE_CONTRACT`: the current selection is a derived result, not stored authority. Given complete, compatible, validated history for one subject, a resolver finds the unique terminal sequence and applies its action semantics:

- `SELECT`, `SUPERSEDE`, or an authorized `ROLLBACK_DECISION` with valid bytes yields one effective manifest digest;
- `REVOKE` without an explicit later valid selection yields no effective selection;
- invalid, unavailable, forked, truncated, or unsupported history yields no derived effective selection for enforcement.

A later cache may accelerate lookup only if it is fully recomputable and checked against verified history. A mutable “current manifest” registry as sole authority is `REJECTED`.

## 12. Selection lifetime

`DEFINED_FOR_FUTURE_CONTRACT`: a selection remains effective only for its exact subject until explicit supersession, explicit revocation, subject-generation termination, an owner-approved rollback decision producing a new history event, or a future explicit compatibility rule renders the selection unsupported.

Restart, offline state, newer manifest availability, and restoration alone do not end or replace selection. A new namespace or generation inherits no selection by default. Any future inheritance/adoption rule is `OWNER_DECISION_REQUIRED` and must create independently valid evidence; it cannot reuse an old subject’s history as current authority.

## 13. Supersession

`DEFINED_FOR_FUTURE_CONTRACT`: supersession selects a new manifest for the same exact subject using an explicit successor event. The predecessor remains historically valid for evidence governed by its verified effective boundary. Supersession neither rewrites prior evidence nor deletes prior bytes; it preserves the predecessor/successor relation and requires future evidence to reference the successor boundary.

`OWNER_DECISION_REQUIRED`: the precise downstream mapping from subject-local sequence to session, operation, or transaction boundary. This prevents silently using wall-clock ordering or treating a later manifest as governing earlier evidence.

## 14. Revocation

`DEFINED_FOR_FUTURE_CONTRACT`: the default is prospective revocation. A valid revocation blocks future production enforcement for the exact subject unless a later valid selection is issued under approved policy. Historical evidence remains inspectable and reconstructible; revocation retains a bounded reason and does not delete data, rewrite evidence, or automatically select a replacement manifest.

`OWNER_DECISION_REQUIRED`: retrospective invalidation and any emergency policy. Such a policy needs an explicit owner decision, its own compatibility/time authority, bounded scope, and historical audit semantics. K-333F does not infer it from revocation.

## 15. Rollback

`DEFINED_FOR_FUTURE_CONTRACT`: rollback is a new append-only `ROLLBACK_DECISION` that selects a historically known K-329 content digest for the same subject. It names its predecessor, retains bounded reason and scope, revalidates source binding, canonical bytes, compatibility, and complete history, and never erases intermediate history.

`REJECTED`: deleting successor history, silently moving an authoritative current pointer, using a database snapshot rollback as protocol rollback, or treating previously seen bytes as automatically current.

`OWNER_DECISION_REQUIRED`: authorization policy for issuing rollback. Until that policy exists, a rollback request is denied for enforcement and evidence remains retained.

## 16. Historical byte resolution

`DEFINED_FOR_FUTURE_CONTRACT`: every selected digest required by retained evidence must resolve to exact canonical K-329 bytes whose digest recomputes. The future resolver must also have a supported decoder, matching physical-source binding, compatible manifest metadata, complete subject history, and determinable supersession/revocation state.

The recommended future persistence posture is durable, append-only, content-addressed historical resolution with a local-first readable copy or cache plus a separately approved durable authority. External-reference-only resolution is `REJECTED` because it cannot establish offline/recovery availability. K-333F specifies neither storage nor transport.

If bytes are missing, classify `MANIFEST_BYTES_MISSING` / `EVIDENCE_UNAVAILABLE`; block production enforcement, preserve local data and unresolved evidence, prohibit newest-manifest substitution or inferred content, retain bounded diagnostics, and permit later re-resolution.

## 17. Restore semantics

`DEFINED_FOR_FUTURE_CONTRACT`: restore may preserve exact history or restore references that later re-resolve verified bytes. It must retain the original subject scope, verify restored bytes against digest, preserve predecessor relationships, and treat missing evidence as unavailable. It must not restore only a current selection when that loses required history.

Newer remote material does not override restored history automatically. A stale generation is never promoted, source/namespace/generation mismatch fails closed, restore completion does not imply production eligibility, and no restore action deletes local data merely because selection evidence is missing.

## 18. Offline semantics

`DEFINED_FOR_FUTURE_CONTRACT`: previously resolved, valid evidence may remain available to future local non-production workflows only under their later policy. Production enforcement requiring unavailable authority or bytes fails closed. Offline state is `EVIDENCE_UNAVAILABLE` or `AUTHORITY_UNAVAILABLE`, never `POLICY_DENIED` merely because a fetch cannot occur.

No automatic newest-manifest fetch, substitution, destructive data action, or offline production eligibility is authorized. Deferred resolution remains recoverable.

## 19. Failure taxonomy

| State | Category | Detection and enforcement behavior | Local-data and recovery behavior | Future owner |
|---|---|---|---|---|
| `UNKNOWN_SUBJECT` | invalid | No exact tuple has valid history; fail closed. | Preserve data; obtain valid scoped evidence. | Selection/History |
| `UNKNOWN_MANIFEST_DIGEST` | unavailable | No trusted resolution for digest; fail closed. | Preserve evidence; re-resolve later. | Persistence + Selection/History |
| `MANIFEST_BYTES_MISSING` | unavailable | Digest has no canonical bytes; fail closed. | Preserve data/evidence; recover bytes without substitution. | Persistence |
| `MANIFEST_DIGEST_MISMATCH` | corrupt | Recomputed digest differs; reject bytes. | Retain bounded diagnostic; obtain verified bytes. | K-329 codec + Persistence |
| `PHYSICAL_SOURCE_MISMATCH` | invalid | Source differs from subject/manifest binding; reject. | Preserve data; no cross-source reuse. | Selection/History |
| `NAMESPACE_MISMATCH` | invalid | Namespace differs from subject; reject. | Preserve data; no cross-namespace reuse. | Selection/History |
| `GENERATION_MISMATCH` | stale | Generation differs or is stale; reject current use. | Preserve data/history; create valid new-scope evidence only later. | Selection/History |
| `UNSUPPORTED_MANIFEST_VERSION` | unsupported | K-329 decoder/compatibility unavailable; fail closed. | Retain bytes; require compatible decoder. | K-329 codec + Compatibility |
| `UNSUPPORTED_SELECTION_CONTRACT_VERSION` | unsupported | Future event contract is unknown; fail closed. | Retain evidence; require historical decoder. | Compatibility + Persistence |
| `HISTORY_MISSING` | unavailable | Required subject history absent; no selection derived. | Preserve data; recover history. | Persistence |
| `HISTORY_TRUNCATED` | corrupt | Required predecessor or sequence is absent. | Preserve evidence; recover complete graph. | Persistence + Selection/History |
| `HISTORY_FORKED` | corrupt | Multiple incompatible heads or successors. | Preserve graph; require owner-governed resolution. | Selection/History |
| `DUPLICATE_EFFECTIVE_SELECTION` | corrupt | More than one valid effective result. | Preserve graph; no automatic winner. | Selection/History |
| `SUPERSEDED_SELECTION` | stale | History shows explicit successor. | Preserve prior evidence; use successor only at its valid boundary. | Selection/History |
| `REVOKED_SELECTION` | revoked | Verified prospective revocation applies. | Preserve data/history; no automatic replacement. | Selection/History |
| `ROLLBACK_NOT_AUTHORIZED` | denied | No approved rollback authority/policy. | Preserve graph; retain bounded denial. | Absinthe Protocol Owner + Selection/History |
| `ISSUER_NOT_AUTHORIZED` | denied | Issuer reference lacks future policy authority. | Preserve evidence; no issue/rewrite. | Selection/History |
| `EVIDENCE_UNAVAILABLE` | unavailable | Needed bytes/history/evidence cannot resolve. | Preserve data; defer recovery. | Persistence |
| `AUTHORITY_UNAVAILABLE` | unavailable | Required future authority cannot be consulted. | Preserve data; retry only under later policy. | Relevant future authority |
| `CORRUPT_HISTORY` | corrupt | Invalid graph, encoding, relationship, or digest. | Preserve bounded diagnostic; no automatic repair. | Selection/History + Persistence |

## 20. Proof boundary

`DEFINED_FOR_FUTURE_CONTRACT`: a valid proof establishes only selected digest, authorized future issuer, exact subject, independent contract version, reconstructible lifecycle, and one effective history boundary. It never establishes writer identity membership, context/capability/session conformity, operation authorization, admission, eligibility, or activation.

This boundary governs the executive contract, decision matrix, threat model, consumer contracts, and non-goals. Any future use that treats selection alone as eligibility or activation is `REJECTED`.

## 21. Consumer contracts

| Consumer | May consume | Must still establish | Non-consequence |
|---|---|---|---|
| Identity Adoption | selected digest, subject, history reference, compatibility metadata | identity-to-reviewed-type adoption | Selection does not prove adoption. |
| Conformity Validation | exact bytes, lifecycle state, subject, effective boundary | identity, context, capability, and conformity | Selection does not prove conformity. |
| Evidence Persistence | events, history, bytes/resolution metadata, diagnostics | durable retention/resolution under separate policy | Persistence does not decide policy. |
| Authorization | only later approved composite evidence | operation authorization | Selection alone never authorizes. |
| Admission | only later approved authorization/evidence | admission decision | Selection alone never admits. |
| Eligibility | only later approved evidence | eligibility decision | Selection never establishes eligibility. |
| Activation | no direct selection input | explicit activation policy | Selection never activates production. |

## 22. Persistence dependency

`DEFINED_FOR_FUTURE_CONTRACT`: persistence/history resolution is a precondition to production enforcement, not an optional optimization. A later Cross-Protocol Evidence Persistence contract must define append-only retention, deterministic historical lookup, compatibility metadata retention, bounded diagnostics, corruption handling, recovery boundaries, and authority separation.

K-333F does not approve a database, store, repository, schema, migration, index, network service, cache format, or retention period. No K-330 envelope becomes authoritative automatically.

## 23. Dependency and construction order

```text
EXISTING: physical source ─┐
EXISTING: namespace ───────┼─> DEFINED: selection subject
EXISTING: generation ──────┘          │
EXISTING: K-329 canonical bytes ─> EXISTING: content digest
                                          │
DEFINED: authorized issuer + compatible bytes + prior history
                                          │
                                          v
DEFINED: immutable selection event ─> DEFINED: append-only history
                                          │                 │
                                          v                 v
DEFINED: derived current/historical selection ─> DEFERRED: identity adoption
                                                       └──> DEFERRED: conformity
                                                                  └──> DEFERRED: authorization
                                                                             └──> DEFERRED: admission
                                                                                        └──> DEFERRED: eligibility
                                                                                                   └──> DEFERRED: activation
```

Supersession, revocation, and rollback are `DEFINED_FOR_FUTURE_CONTRACT` action semantics inside the history graph. Retrospective invalidation, rollback authorization, external evidence boundary, and cross-generation inheritance remain `OWNER_DECISION_REQUIRED`. Runtime selector, mutable registry, persistence implementation, admission, eligibility, and activation are `FORBIDDEN_IN_K333F`.

There is no digest cycle: bytes precede manifest digest; the complete event payload precedes event digest; predecessor evidence precedes successor creation; history precedes derived selection; and selection precedes only later consumers. No consumer may require unavailable bytes at validation time, and no enforcement may precede persistent historical resolution.

## 24. Versioning and compatibility

Existing authority remains unchanged: K-329 `schemaVersion` 1, `byteFormatVersion` 1, and manifest version `k329b-source-reviewed-v1`; existing K-333 strict records remain version 1.

`DEFINED_FOR_FUTURE_CONTRACT`: the selection/history contract and any later event encoding have independent versions. Unknown versions fail closed, retained evidence requires retained compatible decoders, and compatibility must be explicit.

`DEFERRED`: exact future version strings, compatibility tables, supported combinations, and decoder retention implementation belong to the future K-333 Cross-Protocol Compatibility Authority. K-333F changes none of them.

## 25. Threat model

| Threat | Prevention / detection | Failure behavior | Future authority and persistence dependency | Residual risk |
|---|---|---|---|---|
| manifest or digest substitution; possession-as-authority | canonical digest recomputation, issuer preconditions, no caller selection | fail closed; retain diagnostic | K-329 codec; Selection/History; Persistence | trusted issuer policy still required |
| cross-source, namespace, or generation replay; graph mixing | exact tuple equality at every edge | reject scope mismatch | Selection/History; durable graph | component identity policy remains owner-governed |
| stale, superseded, or revoked selection reuse | predecessor + sequence; action-state resolution | no current enforcement | Selection/History; retained graph | external evidence-boundary policy unresolved |
| rollback abuse; restore selecting stale policy; remote override | append-only rollback, restore verifies graph, no automatic override | deny/unavailable; preserve data | Selection/History; Persistence | rollback authorization is unresolved |
| truncation, fork, duplicate head, missing predecessor | contiguous chain validation | corrupt/unavailable; no automatic winner | Selection/History; durable retention | recovery requires complete evidence |
| newest-manifest fallback or mutable pointer compromise | history-derived current selection only | reject fallback/pointer authority | Selection/History | cache can only accelerate after verification |
| bytes/decoder unavailable or version downgrade | content-addressed bytes, strict K-329 decode, explicit compatibility | unavailable/unsupported; fail closed | K-329 codec; Compatibility; Persistence | later durable decoder policy required |
| persistence compromise or issuer impersonation | distinct issuer/persistence roles, immutable evidence, bounded diagnostics | corrupt/denied; no repair | Selection/History; Persistence | concrete trust mechanism deferred |
| wall-clock manipulation | sequence/predecessor authority only | timestamp cannot select or repair | Selection/History | diagnostic time may be inaccurate |
| conformity/eligibility escalation | explicit proof and consumer limits | reject as unsupported consequence | downstream authorities | later contracts must preserve separation |

## 26. Decision matrix

| Decision | Existing authority | Defined contract rule | Status | Owner | Subject | Lifecycle | Persistence dependency | Validation input | Failure behavior | Consumer impact | Explicit non-consequence | Unresolved choice | Required future contract |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Selection subject | K-329 source; K-333 namespace/generation facts | exact source + namespace + generation tuple | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | exact tuple | immutable scope | retain tuple/history | exact equality | mismatch fails closed | bounds later consumers | no cross-scope reuse | component adoption | Selection/History |
| Selected manifest identity | K-329 canonical digest | digest plus resolvable canonical bytes | DEFINED_FOR_FUTURE_CONTRACT | K-329 canonical manifest codec | digest/source | content-addressed | bytes or trusted resolution | recomputed digest | unavailable/corrupt | input only | no selection authority from possession | none | Historical Resolution |
| Selection issuer | none | future authorized issuer only | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject/action | issue after preconditions | issuer evidence | policy + history | denied | produces selection only | no membership | issuer authorization | Issuer Policy |
| Selection authority | none | scoped immutable selector | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject | append-only | complete graph | authoritative event | fail closed | supports later proof | no conformity | owner approval | Selection/History |
| Canonical-byte requirement | K-329 codec | exact bytes resolve for retained digest | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | digest | retain while referenced | durable resolution | codec + digest | unavailable | historical validation input | no caller bytes trust | storage topology | Historical Resolution |
| Selection event model | none | action-specific immutable event family | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject/history | append only | event retention | payload before digest | corrupt fails closed | lifecycle proof | no schema now | encoding form | Event Contract |
| Event ordering | none | predecessor + contiguous local sequence | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | one subject | monotonic | complete predecessors | exact chain | fork/truncation | deterministic derivation | no wall-clock authority | external boundary | Event Contract |
| Current-selection derivation | none | unique validated terminal action | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | one subject | recomputable | verified history | graph/action state | no effective selection | later input | no mutable registry authority | cache policy | Resolver Contract |
| Selection lifetime | none | ends only by explicit defined condition | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | exact subject | until event/end/compatibility | retain history | action + compatibility | fail closed | stable proof | no newest update | inheritance | Lifecycle Contract |
| Supersession | none | explicit successor for same subject | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | same subject | append-only successor | predecessor retained | sequence/edge | stale predecessor | future evidence boundary | no rewrite/delete | downstream boundary | Lifecycle Contract |
| Revocation | none | prospective explicit event | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | same subject | future use blocked | reason/history retained | valid revocation | revoked/no selection | downstream sees revoked state | no replacement | retrospective policy | Revocation Policy |
| Retrospective invalidation | none | no inferred retroactivity | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | bounded affected evidence | explicit emergency policy only | audit history | trusted time/policy | fail closed | none until approved | no deletion/rewrite | full semantics | Retrospective Policy |
| Rollback | none | new event selecting known digest | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | same subject | append-only | full graph/bytes | source + compatibility | deny if unauthorized | future evidence boundary | no database rollback | issuer authorization | Rollback Policy |
| History retention | none | retain referenced append-only graph | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | graph | no destructive pruning | durable history | predecessor completeness | unavailable/corrupt | reconstructibility | no current-only truth | retention duration | Persistence Contract |
| Historical byte resolution | K-329 codec | resolve exact canonical bytes | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | digest/scope | while referenced | durable bytes/metadata | digest/codec/source | unavailable | Conformity input later | no inferred bytes | source topology | Historical Resolution |
| Missing manifest bytes | none | unavailable, never substitute | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | digest | recoverable | preserve unresolved evidence | missing resolution | fail closed | no enforcement | no newest fallback | recovery channel | Persistence Contract |
| Missing history | none | unavailable, no derivation | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | subject | recoverable | complete graph | history lookup | fail closed | no enforcement | no local deletion | recovery channel | Persistence Contract |
| Forked history | none | detect and reject ambiguity | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject graph | terminal until resolved | retain all branches | heads/sequences | corrupt fail closed | no current result | no automatic winner | resolution policy | Fork Resolution Policy |
| Duplicate effective selection | none | reject multiple valid results | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | subject/boundary | terminal until resolved | retain graph | derived result count | corrupt fail closed | no consumer use | no latest-wins | resolution policy | Resolver Contract |
| Restore | K-324 patterns; K-333E boundary | preserve/verify exact graph or references | DEFINED_FOR_FUTURE_CONTRACT | K-333 Manifest Selection and History Authority | restored tuple | non-destructive | graph/bytes retained | scope/digest/history | unavailable/mismatch | recovery input only | no implicit selection | reference recovery | Restore Contract |
| Offline behavior | none | local non-production use only under later policy | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | evidence availability | temporary | retained resolution | availability state | unavailable, not denial | no production enforcement | no offline eligibility | local policy | Offline Policy |
| Versioning | K-329/K-333 v1 | independent future contract versions | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Compatibility Authority | contracts | decoder retained while referenced | version metadata | explicit support | unsupported fails closed | compatibility input | no versions assigned now | table | Compatibility Contract |
| Compatibility | none | explicit supported combinations only | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Compatibility Authority | relation | owner-governed | metadata retained | approved relation | unsupported fails closed | validation prerequisite | no implicit edge | combinations | Compatibility Contract |
| Identity Adoption consumer | none | consume selection as bounded input | DEFERRED | K-333 Identity Adoption Authority | selection proof | later | retained selection | resolved digest/scope | unavailable | must prove adoption | selection is not adoption | full contract | Identity Adoption |
| Conformity consumer | none | consume bytes/state/boundary | DEFERRED | K-333 Conformity Validation Authority | selection proof | later | resolved history | bytes + scope + state | unavailable | must validate all other inputs | selection is not conformity | full contract | Conformity Validation |
| Authorization non-consequence | none | separate authority required | DEFERRED | Future Operation Authorization Authority | operation | later | later evidence | approved composite inputs | deny by policy | none now | selection never authorizes | policy | Authorization |
| Admission non-consequence | none | separate authority required | DEFERRED | Future Admission Authority | admission | later | later evidence | authorization/evidence | deny by policy | none now | selection never admits | policy | Admission |
| Eligibility non-consequence | none | separate authority required | DEFERRED | Future Eligibility Authority | source | later | later evidence | approved prior evidence | fail closed | none now | selection never makes eligible | policy | Eligibility |
| Activation non-consequence | none | separate authority required | DEFERRED | Future Activation Authority | production | later | later evidence | explicit activation policy | fail closed | none now | selection never activates | policy | Activation |
| Persistence prerequisite | none | history before enforcement | DEFINED_FOR_FUTURE_CONTRACT | K-333 Cross-Protocol Evidence Persistence Authority | all retained evidence | before enforcement | append-only authority | resolvable graph/bytes | unavailable blocks | prerequisite only | no policy owner | topology | Persistence Contract |
| Implementation gate | K-333E owner gate | explicit recorded owner approval first | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | all future contracts | before code work | repository decision only | owner record | work blocked | permits review phase only | no runtime approval | decision | Owner Approval Record Policy |

## 27. Explicit non-goals

K-333F defines or changes none of: production record schema, codec, stable bytes, vectors, database, index, repository, transaction, runtime selector, mutable registry, network API, source interception, identity adoption, context evidence, capability evidence, conformity validation, operation authorization, admission, eligibility, activation, or K-334.

The document does not make selection current production authority and does not approve a persistence design.

## 28. Unresolved owner decisions

- `OWNER_DECISION_REQUIRED`: authorization and identity of a future selection issuer.
- `OWNER_DECISION_REQUIRED`: inheritance/adoption across a new generation.
- `OWNER_DECISION_REQUIRED`: mapping a subject-local effective sequence to external session/operation/transaction evidence.
- `OWNER_DECISION_REQUIRED`: retrospective invalidation and emergency scope/time semantics.
- `OWNER_DECISION_REQUIRED`: rollback authorization.
- `OWNER_DECISION_REQUIRED`: retention duration, concrete persistence topology, and recovery transport.
- `OWNER_DECISION_REQUIRED`: fork-resolution policy; no automatic winner is permitted.
- `OWNER_DECISION_REQUIRED`: exact future compatibility combinations and historical decoder commitments.

These choices are isolated; none authorizes code or changes the existing source boundary.

## 29. Validation

Validation for this documentation-only change requires the established focused K-329, K-332, and K-333 protocol suites, typecheck, build, and `git diff --check`. The known K-333 fixture-anchor CRLF/LF result remains `ENVIRONMENT_SENSITIVE_NON_BLOCKING` only when source/test blobs are unchanged from the base and exact-head CI is the merge-gating authority.

The required implementation checks, Draft PR, and exact-head CI are recorded in the K-333F delivery report; this document intentionally does not claim a future authority is active.

## 30. Final contract status

### CONTRACT_READY_FOR_OWNER_REVIEW

Subject, identity, issuer split, immutable history, deterministic derivation, lifetime, supersession, bounded revocation, non-destructive rollback, historical resolution, restore/offline behavior, taxonomy, proof boundary, consumers, dependencies, version principles, and unresolved owner decisions are defined at the architecture-contract level. No runtime/persistence implementation, admission, eligibility, or activation authority is created.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
