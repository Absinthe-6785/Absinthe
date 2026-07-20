# K-333E: Cross-Protocol Authority Owner-Decision Proposal

## 1. Executive proposal

**Result: `PROPOSAL_READY_FOR_OWNER_APPROVAL`.** This document is an owner-decision proposal, not new authority or an implementation approval. It recommends a least-authority sequence: K-329 remains the sole manifest representation and canonical content-digest owner; independently named future K-333 authorities may later adopt an identity, retain session evidence, select historical manifest policy, and validate conformity. Operation authorization, admission, eligibility, and activation remain separate and deferred.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Predecessor and authority baseline

K-333D established `BLOCKED_BY_MISSING_AUTHORITY`. Existing authoritative facts are limited to K-329's `ReviewedWriterManifest`, canonical codec, and SHA-256 content digest, and K-333's strict writer/session evidence records with opaque `manifestDigest` and `capabilityDigest` references. K-333 has no authoritative manifest selector, membership evaluator, context decoder, capability decoder, or historical manifest resolver.

Sources: `frontend/docs/K-333D-k333-k329-authority-binding-audit.md:3-41,43-149`; `frontend/src/lib/localDatabase/writerCoordinationEligibility.ts:122-138,475-533,694-723,1155-1174`; `frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts:26-49,196-231`.

## 3. Decision methodology

Every recommendation below is `RECOMMENDED_FOR_OWNER_APPROVAL` unless a sub-policy is explicitly `OWNER_DECISION_REQUIRED` or a consequence is `DEFERRED`. Proposed authority names are responsibility labels only: they do not name existing classes, records, schemas, APIs, persistence stores, or runtime callers. No recommendation changes the meaning of current K-329 or K-333 records.

## 4. Existing immutable facts

- K-329 entries define reviewed writer-type, allowed context types, and required capabilities; K-329 alone validates that coverage within its own model.
- K-333 `WriterIdentityRecord` keeps `id`, `writerTypeId`, source, namespace, and opaque `manifestDigest` distinct.
- K-333 `WriterSessionRecord` adds generation and an opaque `capabilityDigest`; it has no canonical context or capability material.
- K-329 source binding does not include namespace or generation. K-333 binds its own records to source, namespace, and (for sessions) generation.
- No existing source selects a K-329 manifest for K-333, maps a K-333 identity to a K-329 entry, or grants K-333 admission, eligibility, or activation from manifest membership.

## 5. Proposed authority model

All named K-333 authority labels in this section are **`RECOMMENDED_FOR_OWNER_APPROVAL`** future responsibility boundaries. The Absinthe Protocol Owner is separately **`OWNER_DECISION_REQUIRED`** as an external governance role; it is not a production authority.

### K-333 Identity Adoption Authority

Purpose: bind one concrete K-333 writer identity to one reviewed K-329 `writerTypeId`, selected manifest digest, physical source, namespace, and generation. A future trusted writer-identity establishment or registration flow would issue immutable adoption evidence under approved source authority. The K-333 Conformity Validation Authority would validate that evidence as an input, while the K-333 Cross-Protocol Evidence Persistence Authority would retain and resolve it when later policy requires history. Proposed consumers are the Conformity Validation Authority and later Operation Authorization or Admission authorities. It proves only scoped identity-to-reviewed-type adoption; it does not prove current context, capability, session conformity, operation authorization, admission, eligibility, or activation.

### K-333 Session Context Evidence Authority

Purpose: own canonical, decodable session-scoped context material. The proposed issuer is a trusted session-establishment flow or future approved producer; the proposed validator is the K-333 Conformity Validation Authority; the proposed persistence owner is the K-333 Cross-Protocol Evidence Persistence Authority; future authorization or admission layers may consume validated evidence. It is bound to writer identity, physical source, namespace, and generation. A new immutable evidence instance is required when context changes. Expiry and revocation policy are `OWNER_DECISION_REQUIRED`.

### K-333 Session Capability Evidence Authority

Purpose: own canonical, decodable session-scoped capability material and deterministic digest derivation. The proposed issuer is a trusted session capability-establishment flow; the proposed validator is the K-333 Conformity Validation Authority; the proposed persistence owner is the K-333 Cross-Protocol Evidence Persistence Authority. It is bound to writer identity, physical source, namespace, and generation. A new immutable evidence instance is required when capabilities change. Capability identifier namespace, expiry, and revocation policy are `OWNER_DECISION_REQUIRED`.

### K-333 Manifest Selection and History Authority

Purpose: authoritatively select one K-329 manifest digest for an explicit physical-source, namespace, and generation scope. It is both the proposed owner and selector; an approved future selection flow is its issuer; the K-333 Conformity Validation Authority is its validator; the K-333 Cross-Protocol Evidence Persistence Authority is its persistence owner. It records immutable selection, explicit supersession/revocation events, and historical digest-to-canonical-bytes resolution. It proves selection only, not writer membership, session conformity, authorization, admission, eligibility, or activation.

### K-333 Conformity Validation Authority

Purpose: validate selected manifest bytes, identity adoption, canonical session context, and canonical session capabilities against the selected K-329 entry and scope. It would issue the deterministic classification/conformity result it defines. Its exact proposed input authorities are the K-333 Manifest Selection and History Authority (selection/history), K-329 canonical manifest codec (canonical byte validation only), K-333 Identity Adoption Authority, K-333 Session Context Evidence Authority, K-333 Session Capability Evidence Authority, and K-333 Cross-Protocol Evidence Persistence Authority (historical evidence and compatibility metadata). The Evidence Persistence Authority would retain results only if a later approved contract requires replay or audit; that retention sub-decision is `OWNER_DECISION_REQUIRED`. Proposed consumers are later Operation Authorization and Admission authorities. It cannot authorize an operation, admit a write, establish eligibility, or activate production behavior.

### K-333 Cross-Protocol Evidence Persistence Authority

Purpose: retain and deterministically resolve cross-protocol historical evidence where an approved later contract requires it. It would retain identity adoption, canonical context/capability evidence, selection/history references, canonical manifest bytes or content-addressed resolution metadata, supersession/revocation events, version/compatibility metadata, bounded diagnostics, and optionally conformity results. It does not own K-329 manifest representation or codec, manifest-selection semantics, writer-type policy, operation authorization, admission, eligibility, or activation. Exact storage design, retention period, schema, store, repository, and migration remain deferred.

### K-333 Cross-Protocol Architecture Governance Authority

Purpose: govern phase boundaries only. It would confirm prerequisites, preserve separate dormant contract phases, and record when a phase may proceed to implementation review. It would not issue evidence, select policy, validate conformity, authorize operations, grant admission/eligibility, activate production, or approve product policy. Its proposed consumers are future contract-definition tasks and implementation-review workflow; merged architecture decision records and PR history are sufficient at this proposal stage, with no production persistence implied.

### Absinthe Protocol Owner

This is an external governance role, not a production protocol authority. `OWNER_DECISION_REQUIRED`: it may explicitly approve or reject architecture decisions through a merged owner-approved architecture decision or equivalent repository record. Such approval enables only the next architecture/implementation review phase; it is not a runtime service, record, cryptographic identity, admission authority, eligibility authority, activation authority, or implicit consequence of CI success.

### K-333 Cross-Protocol Compatibility Authority

Purpose: own the proposed compatibility relationship among independently versioned future contracts. It would define supported combinations, fail-closed unknown-version behavior, and historical decoder-retention requirements. It would not own record semantics, the K-329 manifest codec, evidence issuance, selection, admission, eligibility, or final version strings. Existing K-329 schemaVersion 1, byteFormatVersion 1, and `k329b-source-reviewed-v1` manifestVersion remain unchanged; existing strict K-333 v1 records remain unchanged. All future contracts would receive independent versions, and no compatibility table is approved here.

## 6. Complete owner-decision matrix

Every row is independently visible. `K-329 owner` refers only to existing K-329 manifest representation/codec/content-digest authority. Every other authority name is a `RECOMMENDED_FOR_OWNER_APPROVAL` proposal unless the row states `OWNER_DECISION_REQUIRED`.

| Decision | Existing authority | Available options | Recommended option | Status | Proposed owner | Scope | Lifecycle | Security rationale | Product / UX consequence | Persistence consequence | Required future contract | Validation input model | Failure behavior | Explicitly excluded interpretation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Membership subject | K-329 classifies its registrations only | type; identity; session; operation; layered | layered type -> identity -> session | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Conformity Validation Authority | type, identity, session | evidence is immutable per input set | prevents type/instance/session confusion | no manual user membership choice | retain inputs when historical proof is needed | Conformity Validation Contract | adopted type plus session evidence | unavailable evidence; fail closed for production enforcement | one global authorization bit |
| Identity mapping | K-333 fields are distinct; no mapper | equality; runtime map; immutable adoption | immutable scoped adoption | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Identity Adoption Authority | identity, type, source, namespace, generation | immutable; explicit replacement only | prevents writer/type replay | local data preserved | retain adoption history | Identity Adoption Contract | immutable adoption evidence | unavailable evidence; no fallback | `writerId = writerTypeId` |
| Context evidence owner | K-329 has policy categories only | runtime value; identity value; session evidence | canonical session evidence | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Session Context Evidence Authority | session, identity, source, namespace, generation | issue before/during session; replace on change; expiry/revocation pending | prevents stale or inferred context | no UI setting; local capture preserved | retain evidence when historical verification needs it | Session Context Evidence Contract | canonical decodable context evidence | unavailable evidence; fail closed for production admission | context implies authorization |
| Capability material owner | K-329 has requirements; K-333 digest is opaque | digest only; runtime registry; session material | canonical decodable session material | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Session Capability Evidence Authority | session, identity, source, namespace, generation | issue at session establishment; replace on change; expiry/revocation pending | prevents semantic use of opaque digest | no user capability control | retain material and digest relation | Session Capability Evidence Contract | canonical bytes plus deterministic digest | unavailable evidence; no inferred capability | digest alone proves capabilities |
| Physical-source scope | K-329 and K-333 bind their own source | global; source only; scoped adoption | bind every adoption to physical source | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Identity Adoption Authority | physical source | immutable per adoption | prevents cross-source replay | source mismatch blocks enforcement, not local data | retain source-bound evidence | Identity Adoption Contract | source equality across evidence | corruption or policy mismatch; no substitution | adding source fields to K-329 manifest |
| Namespace scope | K-333 records bind namespace | none; identity-only; namespace-bound | bind adoption and evidence to namespace | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Identity Adoption Authority | namespace, identity | immutable per evidence | prevents cross-namespace replay | unrelated namespaces remain isolated | retain namespace-bound history | Identity Adoption Contract | namespace equality | unavailable/mismatch; no fallback | K-329 namespace ownership |
| Generation scope | K-333 sessions bind generation | global; namespace; generation-bound | bind adoption and evidence to generation | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | generation, namespace, source | explicit generation replacement/supersession | prevents stale-generation adoption | restore cannot silently select stale policy | append-only generation history | Selection and History Contract | generation equality and historical lookup | stale/missing evidence; fail closed | adding generation to K-329 manifest |
| Manifest-selection authority | no K-333 selector exists | caller bytes; identity self-selects; immutable authority | scoped immutable selector | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | source, namespace, generation | immutable event; change only by explicit event | prevents manifest substitution | users do not select manifests | append-only selection evidence | Selection and History Contract | trusted selection evidence | no newest-manifest fallback | possession equals selection authority |
| Manifest-selection subject | no cross-protocol subject exists | writer type; identity; session; scope | physical source + namespace + generation | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | source, namespace, generation | one selection per exact scope until changed | prevents cross-scope reuse | deterministic automatic policy resolution | retain scoped key/history | Selection and History Contract | scoped selection evidence | ambiguity blocks enforcement | writer identity alone selects policy |
| Manifest-selection lifetime | no lifetime exists | mutable current pointer; immutable event | immutable until explicit supersession/revocation | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | selected scope | append-only; exact policy timing pending | prevents rollback/replay | policy change is auditable | retain all referenced selections | Selection and History Contract | ordered selection history | stale/unknown selection; no fallback | mutable current pointer is sufficient |
| Manifest-byte availability | K-329 canonical codec can validate supplied bytes | digest only; caller bytes; trusted resolution | trusted digest-to-canonical-bytes resolution | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | selected digest and scope | retain while referenced evidence exists | prevents digest-only semantic inference | missing history blocks production safely | retain canonical bytes or immutable copies | Historical Manifest Resolution Contract | trusted bytes plus K-329 codec | unavailable evidence; preserve local data | arbitrary caller bytes are authoritative |
| Selection-history retention | no history exists | current only; destructive pruning; append-only | append-only historical retention | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | selection graph | retain referenced history; pruning policy pending | preserves replay/restore proof | diagnostics remain explainable | durable ordered history | Selection and History Contract | append-only historical lookup | missing history; no newest fallback | current state alone is historical authority |
| Supersession model | no supersession exists | replacement; implicit newest; explicit event | explicit append-only supersession event | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | selected scope | affects future use; old evidence retained | prevents silent policy replacement | updates remain auditable | retain predecessor links | Selection and History Contract | ordered authority event | graph inconsistency or unavailable history | implicit supersession |
| Revocation model | no revocation exists | immediate delete; explicit event; no revocation | explicit event semantics | OWNER_DECISION_REQUIRED | K-333 Manifest Selection and History Authority | selected scope and affected evidence | exact effect/time policy pending owner approval | avoids unsafe retroactive invalidation | local data is not deleted | retain revocation events | Revocation Policy Contract | historical event lookup | policy unavailable; no destructive repair | deleting history or automatic eligibility |
| Rollback behavior | no rollback contract exists | automatic rollback; manual policy; no rollback | no automatic rollback after selection | OWNER_DECISION_REQUIRED | K-333 Manifest Selection and History Authority | selection/history graph | bounded future policy only | prevents loss of later evidence | recovery remains diagnosable | preserve referenced history | Rollback Policy Contract | complete history and scope evidence | fail closed; retain diagnostics | mutable pointer rollback |
| Historical manifest resolution | no resolver exists | runtime registry; digest only; durable lookup | append-only trusted historical lookup | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Manifest Selection and History Authority | digest, source, namespace, generation | before any historical enforcement | prevents stale/unknown manifest use | offline absence blocks enforcement safely | bytes, selectors, decoders retained | Historical Manifest Resolution Contract | trusted digest lookup plus canonical bytes | unavailable evidence; no substitution | registry-only truth |
| Validation input model | only pure K-329 bytes validation exists | caller-all; durable-all; hybrid | immutable identifiers/evidence plus trusted lookup | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Conformity Validation Authority | full scoped graph | validate after approved evidence exists | prevents caller-controlled selector | no user-provided manifest choice | historical lookup required before enforcement | Conformity Validation Contract | selection, bytes, adoption, context, capability, scope, versions | invalid/unavailable evidence; fail closed | arbitrary caller manifest selection |
| Membership result meaning | K-329 coverage is internal only | authorization; classification; eligibility | classification/conformity evidence only | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Conformity Validation Authority | type, identity, session | deterministic result for immutable inputs | prevents privilege escalation | preserves local capture | retain result inputs if relied on | Conformity Validation Contract | complete validated evidence | failed conformity; no authorization | membership authorizes operations |
| Session conformity consequence | no K-333 consequence exists | authorization; evidence-only; admission | evidence matches selected policy | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Conformity Validation Authority | session and selected scope | bound to evidence validity | prevents stale-session reuse | production may remain blocked | retain input evidence/history | Conformity Validation Contract | selected entry, adoption, context, capability | mismatch/unavailable; no mutation | conformity establishes eligibility |
| Operation-authorization consequence | no cross-protocol authorization exists | direct conformity; separate authority | separate future authorization | DEFERRED | Future Operation Authorization Authority | operation, session | contract not yet defined | prevents valid membership escalation | no current behavior changes | future evidence only | Operation Authorization Contract | approved conformity plus operation evidence | policy denial by owner only | conformity authorizes operation |
| Admission consequence | no K-333 admission consequence exists | direct conformity; separate admission | separate future admission | DEFERRED | Future Admission Authority | admission, operation, source | contract not yet defined | prevents admission bypass | production admission remains blocked | future durable admission evidence | Admission Integration Contract | approved authorization and evidence | admission denial by owner only | conformity admits writes |
| Eligibility consequence | no cross-protocol eligibility exists | direct conformity; separate eligibility | separate future eligibility | DEFERRED | Future Eligibility Authority | source eligibility | contract not yet defined | prevents source activation escalation | production remains ineligible | future eligibility evidence | Eligibility Contract | approved prior evidence | fail closed for eligibility | conformity is sufficient eligibility |
| Activation consequence | activation is outside K-333E | eligibility implies activation; separate activation | separate future activation | DEFERRED | Future Activation Authority | production activation | contract not yet defined | prevents automatic rollout | no startup/UI activation | future activation evidence only | Activation Contract | explicit approved eligibility and activation policy | fail closed; no automatic activation | conformity -> activation |
| Failure semantics | current protocols fail strict decode independently | fallback; destructive repair; typed failures | distinct typed fail-closed categories | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Conformity Validation Authority | validation/enforcement boundary | retain diagnostics; recovery policy later | prevents substitution and data loss | unavailable differs from corruption | retain bounded diagnostic evidence | Failure Semantics Contract | complete evidence and error category | invalid, unavailable, denial, corruption, unsupported version, runtime unavailable | newest fallback or local deletion |
| Persistence prerequisite | no authority store exists; K-330 is dormant | runtime-only; current-only; append-only | durable historical evidence before enforcement | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Cross-Protocol Evidence Persistence Authority | all referenced evidence | retain selections, bytes, adoption, context, capability, versions, events | prevents history truncation | local data preserved | append-only durable history required | Cross-Protocol Evidence Persistence and Historical Resolution Contract Definition | trusted historical lookup | unavailable history blocks enforcement | K-330 envelopes are automatically authoritative |
| Versioning strategy | K-329 v1 and K-333 v1 exist | distributed ownership; compatibility authority | independent versions with explicit compatibility authority | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Cross-Protocol Compatibility Authority | each future contract and cross-contract relation | retain decoders while referenced | prevents unknown-version downgrade | upgrades stay diagnosable | version metadata/decoders retained | Versioning and Compatibility Contract | explicit supported version | unsupported version; fail closed | new production version is approved now |
| Compatibility strategy | no cross-protocol edge exists | implicit compatibility; explicit authority | explicit future compatibility policy | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Cross-Protocol Compatibility Authority | cross-protocol validation | owner-approved evolution only | no surprise compatibility change | compatibility history retained | Compatibility Contract | approved version metadata | unsupported combination; fail closed | current compatibility edge exists |
| Implementation sequence | no implementation authority exists | one PR; phased contracts | phased owner-approved contracts | RECOMMENDED_FOR_OWNER_APPROVAL | K-333 Cross-Protocol Architecture Governance Authority | future work | phase 0 precedes all work | prevents unauditable coupling | no immediate feature change | merged decision/PR history only at this stage | Sequenced Contract Plan | no validation before approval | no implementation before approval | all layers in this PR |
| Owner-approval gate | no approval is recorded | implicit review; explicit owner approval | explicit recorded owner approval | OWNER_DECISION_REQUIRED | Absinthe Protocol Owner | all proposed authorities | before phase 1 | prevents recommendations becoming authority | no user action | repository decision record only; no production record | Owner Approval Record Policy | no validation/enforcement before approval | unavailable approval blocks work | this document, merge, or CI approves itself |
| Production-enforcement gate | no production bridge exists | automatic enforcement; explicit later gate | explicit later enforcement gate | DEFERRED | Future Eligibility Authority and Future Activation Authority | admission, eligibility, activation | only after all prior contracts | prevents premature production use | local capture remains safe | future evidence only | Eligibility and Activation Contracts | complete approved historical evidence | fail closed; preserve local data | owner proposal enables production |

## 7. Authority responsibility table

All rows below are proposal labels, not existing production symbols.

| Proposed authority | Status | Owns | Issues / produces | Validates / resolves | Persists | Consumed by | Explicitly does not own |
|---|---|---|---|---|---|---|---|
| K-333 Identity Adoption Authority | RECOMMENDED_FOR_OWNER_APPROVAL | scoped identity/type adoption | immutable adoption evidence | adoption relation for conformity input | K-333 Cross-Protocol Evidence Persistence Authority | K-333 Conformity Validation Authority; later Authorization/Admission | context, capability, conformity, enforcement |
| K-333 Session Context Evidence Authority | RECOMMENDED_FOR_OWNER_APPROVAL | canonical session context | context evidence | context material for conformity | K-333 Cross-Protocol Evidence Persistence Authority | K-333 Conformity Validation Authority; later Authorization/Admission | capability, authorization, admission, eligibility |
| K-333 Session Capability Evidence Authority | RECOMMENDED_FOR_OWNER_APPROVAL | canonical session capability material | capability evidence/digest | capability material for conformity | K-333 Cross-Protocol Evidence Persistence Authority | K-333 Conformity Validation Authority; later Authorization/Admission | policy satisfaction alone, authorization, eligibility |
| K-333 Manifest Selection and History Authority | RECOMMENDED_FOR_OWNER_APPROVAL | scoped manifest selection/history | selection and supersession events | selected digest/history | K-333 Cross-Protocol Evidence Persistence Authority | K-333 Identity Adoption Authority; K-333 Conformity Validation Authority | K-329 codec, membership, enforcement |
| K-333 Conformity Validation Authority | RECOMMENDED_FOR_OWNER_APPROVAL | conformity-result semantics | deterministic conformity result | approved policy/evidence inputs | K-333 Cross-Protocol Evidence Persistence Authority only if later approved | later Operation Authorization/Admission authorities | authorization, admission, eligibility, activation |
| K-333 Cross-Protocol Evidence Persistence Authority | RECOMMENDED_FOR_OWNER_APPROVAL | historical evidence retention/resolution | no policy evidence | deterministic historical lookup | cross-protocol evidence/history | K-333 Identity Adoption, Context, Capability, Selection, Conformity, and Compatibility authorities | K-329 codec, selection semantics, enforcement |
| K-333 Cross-Protocol Architecture Governance Authority | RECOMMENDED_FOR_OWNER_APPROVAL | phase-boundary governance | implementation-review progression | prerequisite completeness | merged decision/PR history only | future contract/review workflow | product-policy approval, runtime/protocol semantics |
| Absinthe Protocol Owner | OWNER_DECISION_REQUIRED | external approval/rejection | repository-recorded owner decision | not applicable | repository decision history | K-333 Cross-Protocol Architecture Governance Authority | runtime/protocol semantics |
| K-333 Cross-Protocol Compatibility Authority | RECOMMENDED_FOR_OWNER_APPROVAL | cross-contract compatibility relation | supported-combination policy | version compatibility/historical decoder needs | version/compatibility metadata via K-333 Cross-Protocol Evidence Persistence Authority | K-333 Conformity Validation Authority; future contract definitions | record semantics, manifest codec, evidence issuance |

## 8. Context and capability decisions

### Context authority decision

The proposed owner is the **K-333 Session Context Evidence Authority**. Its issuer is a trusted session-establishment flow or future approved producer; its validator is the K-333 Conformity Validation Authority; its persistence owner is the K-333 Cross-Protocol Evidence Persistence Authority. Canonical material is a deterministic, decodable context type/category bound to session, identity, source, namespace, and generation. It is immutable for one evidence instance and must be replaced if context changes. Historical material is retained whenever later verification depends on it. Expiry/revocation details remain `OWNER_DECISION_REQUIRED`. Missing or mismatched context is unavailable evidence or conformity failure, not authorization failure, local-data deletion, or automatic repair.

### Capability authority decision

The proposed owner is the **K-333 Session Capability Evidence Authority**. Its issuer is a trusted session capability-establishment flow; its validator is the K-333 Conformity Validation Authority; its persistence owner is the K-333 Cross-Protocol Evidence Persistence Authority. Canonical material is a deterministic, decodable capability set with a digest derived from canonical bytes. It is immutable for one evidence instance and must be replaced if capabilities change. Capability identifier namespace, expiry, and revocation semantics remain `OWNER_DECISION_REQUIRED`. Existing `capabilityDigest` remains an opaque integrity/reference input, never semantic material or proof of K-329 requirement satisfaction.

## 9. Manifest selection and history decision

The proposed owner and selector is the **K-333 Manifest Selection and History Authority**. It selects one K-329 manifest for physical source + namespace + generation, with an immutable lifetime until an explicit append-only supersession or revocation event. The K-333 Cross-Protocol Evidence Persistence Authority would retain the selection graph and canonical K-329 bytes or deterministic resolution metadata before historical enforcement. Exact revocation and rollback semantics remain `OWNER_DECISION_REQUIRED`; no automated rollback is proposed. Missing history is unavailable evidence: production enforcement fails closed, local data is preserved, and newest-manifest substitution is forbidden.

Existing `WriterIdentityRecord.manifestDigest` is an opaque reference. It is insufficient as a complete selector contract, may later be an integrity/reference input to adoption evidence, and must not be reinterpreted as current production selection authority.

## 10. Conformity validation, versioning, and dependency direction

The proposed **K-333 Conformity Validation Authority** would consume only resolved inputs: a selected manifest/history decision, canonical K-329 bytes validated by the existing K-329 codec, identity-adoption evidence, canonical context evidence, canonical capability evidence, source/namespace/generation scope, and version/compatibility metadata. It would issue only a deterministic conformity result. The K-333 Cross-Protocol Evidence Persistence Authority would resolve historical inputs and would retain a result only if a later approved audit/replay contract requires it. Future Operation Authorization and Admission authorities may consume that result; Eligibility may consume only later approved authorization/admission evidence, and Activation never consumes raw conformity.

The proposed **K-333 Cross-Protocol Compatibility Authority** would own only compatibility relationships among independently versioned future contracts. It would preserve fail-closed unknown combinations and decoder retention while evidence remains referenced. K-329 v1 and K-333 v1 remain existing authority; no version string, compatibility table, codec, or record is changed by this proposal.

Dependency direction is one-way: K-329 canonical bytes/content digest and scoped K-333 evidence exist before selection/adoption; selection, adoption, context, and capability evidence precede conformity; conformity precedes only later authorization and admission; admission/authorization precede any later eligibility; activation is last and separate. There is no digest cycle and no membership-to-eligibility or conformity-to-activation edge.

## 11. Consequence boundaries

1. K-329 writer-type classification remains policy owned by K-329.
2. Identity adoption proves only a scoped identity-to-reviewed-type relation.
3. Session conformity proves only a match of approved identity/context/capability evidence to a selected manifest.
4. Operation authorization is deferred to the Future Operation Authorization Authority.
5. Admission is deferred to the Future Admission Authority.
6. Eligibility is deferred to the Future Eligibility Authority.
7. Activation is deferred to the Future Activation Authority.

There is no direct path from manifest membership or conformity to authorization, admission, eligibility, or activation.

## 12. Validation input and persistence prerequisites

The recommended future validation model is hybrid: a caller may supply immutable evidence identifiers or records, while trusted future authorities resolve selected canonical manifest bytes and historical state. Required inputs are selected-manifest authority evidence, canonical bytes or trusted digest resolution, identity adoption evidence, canonical context evidence, canonical capability evidence, source/namespace/generation scope, and compatibility/version metadata. An untrusted caller cannot choose policy by supplying arbitrary manifest bytes; mutable runtime registry state cannot be sole historical truth; digest-only context/capability evidence is insufficient.

Before enforcement, durable historical material must include manifest selections/history, canonical bytes or immutable content-addressed copies, identity adoption evidence, canonical context and capability evidence, supersession/revocation events, version/compatibility metadata, and bounded diagnostic failure evidence where needed. K-333E1 implements none of this. K-330 dormant envelopes are not automatically authoritative, and no storage schema is approved here.

## 13. Failure semantics

- **Invalid evidence:** deterministic validation failure; fail closed for production enforcement; retain diagnostics.
- **Unavailable evidence:** distinguish from corruption; block production enforcement; preserve local data and local capture where safe; no silent fallback.
- **Policy denial:** only the owning future operation, admission, or eligibility authority may deny its own consequence; conformity validation does not overreach.
- **Corruption:** future persistence/recovery policy may quarantine or diagnose; no destructive silent rewrite.
- **Unsupported version:** fail closed, retain original evidence, and require a compatible decoder/authority.
- **Temporary runtime unavailability:** do not reinterpret as policy denial; preserve local work where safe and permit later recovery.

Newest-manifest fallback, inferred context, inferred capabilities, local user-data deletion, implicit source reset, and automatic eligibility are forbidden.

## 14. Recommended future contract sequence

0. Absinthe Protocol Owner records explicit owner approval; K-333 Cross-Protocol Architecture Governance Authority confirms the phase boundary.
1. K-333 Manifest Selection and History Authority Contract Definition.
2. K-333 Identity Adoption Authority Contract Definition.
3. K-333 Session Context Evidence Authority Contract Definition.
4. K-333 Session Capability Evidence Authority Contract Definition.
5. K-333 Cross-Protocol Evidence Persistence Authority and Historical Resolution Contract Definition.
6. K-333 Conformity Validation Authority Contract Definition (evidence/result only).
7. Future Operation Authorization Authority Contract Definition.
8. Future Admission Authority Integration Contract Definition.
9. Future Eligibility Authority Contract Definition.
10. Future Activation Authority Contract Definition.

The K-333 Cross-Protocol Architecture Governance Authority would govern phase boundaries and prerequisite review only; it cannot substitute for the Absinthe Protocol Owner's external policy approval. Each phase is separate, reviewable, dormant until explicitly enabled, and unable to bypass a later authority. This list is sequencing only; it does not authorize implementation.

## 15. Explicit non-goals

No production codec, record schema, identifier, digest domain, compatibility table, database/store/migration/repository, runtime registry/caller, transaction flow, admission, eligibility, activation, or K-334 work is added. K-329 is not modified or re-owned.

## 16. Owner approval checklist

- [ ] K-329 remains the sole manifest representation and content-digest owner.
- [ ] `writerId` and `writerTypeId` remain distinct.
- [ ] Membership uses the layered type -> identity -> session model.
- [ ] K-333 Identity Adoption Authority is approved as the proposed identity-mapping owner.
- [ ] Identity Adoption responsibility split is approved, including issuer, validator, persistence owner, and consumers.
- [ ] K-333 Session Context Evidence Authority is approved as the proposed context owner.
- [ ] Context evidence is session-scoped and historically retained when needed.
- [ ] K-333 Session Capability Evidence Authority is approved as the proposed capability-material owner.
- [ ] Capability material is canonical and decodable; opaque `capabilityDigest` alone is insufficient.
- [ ] K-333 Manifest Selection and History Authority is approved as the proposed selector/history owner.
- [ ] Conformity Validation responsibility split is approved, including result issuer, input resolvers, persistence owner, and consumers.
- [ ] K-333 Cross-Protocol Evidence Persistence Authority is approved as the proposed durable evidence/history owner.
- [ ] K-333 Cross-Protocol Compatibility Authority is approved as the proposed compatibility-relationship owner.
- [ ] K-333 Cross-Protocol Architecture Governance Authority is approved only for phase-boundary governance.
- [ ] Absinthe Protocol Owner is acknowledged as the external approval role; CI success is not owner approval.
- [ ] Selection is scoped to physical source + namespace + generation and is immutable until explicit event.
- [ ] Historical manifest bytes remain resolvable before enforcement and selection history is append-only.
- [ ] Revocation and rollback policy are decided explicitly without destructive history loss.
- [ ] Conformity proves classification/context/capability match only.
- [ ] Operation authorization, admission, eligibility, and activation remain separate.
- [ ] Validation uses trusted historical authority, not arbitrary caller selection.
- [ ] Persistence is required before historical enforcement.
- [ ] Failure categories remain distinct; no newest-manifest fallback is allowed.
- [ ] Future contracts are separate and no implementation begins until approval is recorded in merged authority.

## 17. Validation

This documentation-only change requires K-329, K-332, and K-333 focused tests, typecheck, build, and `git diff --check`. The known K-333 CRLF/LF fixture may report 92/93 locally; it is `ENVIRONMENT_SENSITIVE_NON_BLOCKING` only when the unchanged base reproduces the fixture-anchor condition. Exact-head CI is the merge-gating authority.

## 18. Final proposal status

### PROPOSAL_READY_FOR_OWNER_APPROVAL

All named future authorities remain non-authoritative pending explicit owner approval. No implementation is authorized.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
