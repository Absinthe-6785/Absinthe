# K-333E — Cross-Protocol Authority Owner-Decision Proposal

## 1. Executive proposal

**Result: `PROPOSAL_READY_FOR_OWNER_APPROVAL`.** This is a proposal, not new authority. It recommends a layered, least-authority sequence: retain K-329 as the immutable writer-type policy owner; later adopt a writer identity to one reviewed type and selected manifest within source/namespace/generation scope; retain canonical session context/capability material; validate conformity as evidence only; and keep operation authorization, admission, eligibility, and activation separate.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Predecessor and authority baseline

K-333D merged through PR #594 (`e6a6f4c…`, merge `8fe1a2b…`) and established `BLOCKED_BY_MISSING_AUTHORITY`. K-329 solely owns `ReviewedWriterManifest`, its canonical codec, and its SHA-256 content digest; K-333 has only opaque references and no cross-protocol membership authority.

Sources: `frontend/docs/K-333D-k333-k329-authority-binding-audit.md:3-41,43-66` (reviewed design fact); `frontend/src/lib/localDatabase/writerCoordinationEligibility.ts:122-138,475-533,694-723` (normative implementation).

## 3. Decision methodology

Recommendations apply least authority, instance-versus-type separation, immutable/historically resolvable evidence, explicit lifecycle, no hidden persistence dependency, and local-first fail-closed safety. They are not claims that the repository already implements these properties.

## 4. Existing immutable facts

| Fact | Authority |
|---|---|
| K-329 entries own type/context/capability policy and coverage | `writerCoordinationEligibility.ts:1155-1174` — normative implementation |
| K-333 writer identity contains distinct `id`, `writerTypeId`, opaque `manifestDigest`, namespace, and source | `protocol/writerAuthorityProtocol.ts:26-35,196-219` — normative implementation |
| K-333 session binds writer identity and has only opaque `capabilityDigest` | `writerAuthorityProtocol.ts:37-49,222-231,374-405` — normative implementation |
| K-333 graph is evidence integrity, not K-329 membership policy | `protocol/transactionEvidenceProtocol.ts:448-539` — normative implementation |
| Manifest history/selection and K-333 context/capability material are absent | `K-333D-k333-k329-authority-binding-audit.md:80-121,147-163` — reviewed design fact |

## 5. Owner-decision matrix

| Decision | Existing authority | Recommended option | Status | Explicitly excluded |
|---|---|---|---|---|
| Membership subject | none | layered type → identity → session model | RECOMMENDED_FOR_OWNER_APPROVAL | one global authorization bit |
| Identity mapping | distinct K-333 fields | immutable identity-to-type adoption | RECOMMENDED_FOR_OWNER_APPROVAL | `writerId = writerTypeId` |
| Context owner | K-329 policy only | canonical session-scoped material | RECOMMENDED_FOR_OWNER_APPROVAL | runtime-only proof |
| Capability owner | K-329 policy; opaque K-333 digest | canonical session-scoped material | RECOMMENDED_FOR_OWNER_APPROVAL | opaque digest as material |
| Scope | K-329 source; K-333 source/namespace/generation | policy source-bound, adoption scope-bound | RECOMMENDED_FOR_OWNER_APPROVAL | changing K-329 schema |
| Selection/history | absent | immutable adoption plus append-only historical resolution | RECOMMENDED_FOR_OWNER_APPROVAL | newest-manifest fallback |
| Consequence | absent | classification/conformity evidence only | RECOMMENDED_FOR_OWNER_APPROVAL | admission/eligibility implication |
| Enforcement | absent | separate later contracts | DEFERRED | combined implementation PR |

## 6. Membership-subject decision

Options A–D (type, identity, session, operation alone) each collapse at least one necessary distinction. **Recommendation: E, layered model** — a K-329 entry lists a reviewed type; an identity adopts that type; a session supplies current conformity evidence; operation authorization remains independent. This is stable under instance rotation, avoids replaying stale session evidence, and requires future contracts rather than reinterpreting K-333 records.

Status: RECOMMENDED_FOR_OWNER_APPROVAL. Membership proves classification/conformity only, never authorization.

## 7. Identity-mapping decision

Reject direct equality: K-333 treats `id` and `writerTypeId` separately, while K-329 registration identity embeds type/context in a different value space. Recommend a future immutable adoption authority mapping one concrete K-333 writer identity to one K-329 `writerTypeId`, selected manifest content digest, physical source, namespace, and generation. It proves only that scoped adoption; it does not prove current context/capability or operation permission.

Status: RECOMMENDED_FOR_OWNER_APPROVAL. Future owner: cross-protocol authority layer; a new immutable evidence contract is required.

## 8. Context-authority decision

K-329 `contextTypes` are policy categories, not evidence of a concrete active context. Reject type-implied, identity-scoped, operation-only, and runtime-only options. Recommend canonical session-scoped context material, immutable for that session and historically resolvable when enforcement depends on it. Validation compares it to the adopted entry; failure is evidence-unavailable or conformity-failed, never destructive local repair.

Status: RECOMMENDED_FOR_OWNER_APPROVAL. Context remains conformity evidence, not authorization.

## 9. Capability-authority decision

Reject static type implication, identity-only capability, operation declaration, mutable-registry-only authority, and treating `capabilityDigest` as material. Recommend canonical decodable session capability material and a digest only as its integrity reference. It must be retained/resolved for historical checks, allow explicit revocation/lifetime policy, and prove only satisfaction of K-329 entry requirements.

Status: RECOMMENDED_FOR_OWNER_APPROVAL. A precursor capability-material contract is required.

## 10. Source/namespace/generation decision

K-329 policy stays physical-source-bound. Recommend model E: adoption/binding is additionally namespace-and-generation-bound. This is the narrowest model that preserves namespace isolation, generation replacement, restore safety, and cross-graph replay resistance without changing K-329.

Status: RECOMMENDED_FOR_OWNER_APPROVAL.

## 11. Manifest-selection decision

Reject identity self-reference, mutable runtime selection, caller-supplied bytes as authority, and possession of a valid manifest as selection. Recommend an immutable scoped adoption/selection decision made by a future cross-protocol authority, retaining both the selected digest and independently validated canonical manifest bytes. Existing `WriterIdentityRecord.manifestDigest` remains insufficient until bound by that authority.

Status: RECOMMENDED_FOR_OWNER_APPROVAL.

## 12. History and supersession decision

Reject global replacement, current-only storage, implicit supersession, and destructive history deletion. Recommend append-only selection history: a later scoped selection may supersede future use but cannot invalidate already-recorded evidence; revocation semantics require explicit owner approval; unknown/missing historical bytes fail closed for enforcement. Historical lookup key should include source, namespace, generation, and selected digest.

Status: RECOMMENDED_FOR_OWNER_APPROVAL.

## 13. Membership-consequence decision

Recommend layered consequences: membership establishes reviewed-type classification; session material establishes conformity; operation authorization is separate; admission consumes separately verified evidence; eligibility is a final independent gate; activation remains outside all of these. Membership alone proves none of current context, current capability, operation authorization, admission, eligibility, or activation.

Status: RECOMMENDED_FOR_OWNER_APPROVAL.

## 14. Failure-semantics decision

Unknown/missing/malformed manifest, source mismatch, unknown type, absent/mismatched context or capability, stale/superseded selection, unknown version, graph inconsistency, unavailable registry, offline state, and restore ambiguity must be classified distinctly as corruption, unsupported version, unavailable evidence, policy denial, or temporary runtime unavailability. Recommendation: fail closed for production admission/eligibility; do not substitute another manifest, infer material, delete/rewrite local data, or lose recovery evidence.

Status: RECOMMENDED_FOR_OWNER_APPROVAL.

## 15. Persistence and historical-resolution decision

A pure K-329 validator is not a trusted selector. Recommend durable, append-only historical resolution before any enforcement, with canonical bytes retained for dependent evidence. Runtime registry data may accelerate lookup but cannot be the sole historical authority.

Status: RECOMMENDED_FOR_OWNER_APPROVAL; persistence implementation remains DEFERRED.

## 16. Recommended layered architecture

1. **Existing:** K-329 immutable type policy and content digest.
2. **Recommended future:** scoped immutable adoption/selection authority.
3. **Recommended future:** canonical session context and capability material.
4. **Recommended future:** evidence-only membership/conformity validator.
5. **Deferred:** operation authorization, then admission, then eligibility; activation remains separately forbidden.

This has no digest cycle: manifest bytes/digest and scoped identity exist before adoption; session evidence exists after identity; membership evidence depends only on prior material; later enforcement consumes evidence without changing it.

## 17. Rejected alternatives

`writerId = writerTypeId` risks type/instance confusion; a duplicate K-333 manifest codec splits authority; manifest digest alone permits unbound reuse; opaque capability digest cannot prove semantics; mutable registry-only data loses historical proof; manifest possession permits substitution; membership-to-eligibility is privilege escalation; current-only storage breaks replay/restore; implicit supersession and newest fallback permit rollback; adding scope to K-329 changes its owner contract; one PR combines unauditable authority layers.

## 18. Dependency and construction-order graph

```text
EXISTING: K-329 manifest bytes -> content digest -> reviewed writer type
EXISTING: physical source; K-333 identity -> session
RECOMMENDED: source + namespace + generation + identity + type + digest -> adoption/selection
RECOMMENDED: session + canonical context/capability -> conformity evidence
DEFERRED: conformity evidence -> operation authorization -> admission -> eligibility
FORBIDDEN_IN_K333E: eligibility -> activation; opaque digest -> capability semantics
```

Historical manifest/context/capability material must exist before validating later evidence. No current record is reinterpreted.

## 19. Threat model

The layered proposal detects writer/type confusion, wrong identity adoption, cross-writer/session/source/namespace/generation reuse, stale context/capability, unavailable capability preimage, stale/superseded/rolled-back policy, missing history, manifest/entry substitution, cross-graph mixing, truncation, admission/eligibility escalation, registry compromise, stale restore policy, and unsupported-version downgrade. Adoption/history addresses policy scope and replay; session evidence addresses current conformity; distinct enforcement layers address escalation. All enforcement failures preserve local data and require durable history where retrospective proof is needed.

## 20. Version and compatibility proposal

K-329 v1 and existing K-333 v1 records remain authoritative. Each future independent authority contract should have an independent version, explicit cross-protocol compatibility rules, fail-closed unknown versions, retained historical decoders, and explicit supersession rather than silent schema reinterpretation. No production version string or compatibility-table change is proposed.

## 21. Product and UX boundary

Users do not choose manifests or map writer identities. Missing authority blocks production sync/admission safely while preserving local capture and recoverability where otherwise safe. Diagnostics distinguish unavailable authority from corruption; policy/history maintenance is automatic and auditable, not a user setting.

## 22. Recommended future contract sequence

Recommend Option A, split into independently reviewable work: (1) immutable identity adoption; (2) canonical context material; (3) canonical capability material; (4) manifest selection/history resolution; (5) evidence-only membership validation; (6) separate operation authorization; (7) separate admission; (8) separate eligibility. Persistence is acknowledged at stages 1–4 but implemented only in its own task.

## 23. Explicit non-goals

No production codec, manifest replacement, schema/ID/self-digest, binding/context/capability/adoption implementation, compatibility-table/vector, database/store/migration/repository/lookup/transaction, runtime caller/registration/admission/source interception, eligibility, activation, or K-334 work is added.

## 24. Owner approval checklist

- [ ] Layer membership rather than treating it as authorization.
- [ ] Retain K-329 as manifest representation owner.
- [ ] Keep writer identity and writer type distinct.
- [ ] Require immutable scoped identity-to-type adoption.
- [ ] Make context and decodable capability material session-scoped.
- [ ] Treat opaque `capabilityDigest` alone as insufficient.
- [ ] Scope adoption to source, namespace, and generation.
- [ ] Make selection and append-only historical resolution explicit.
- [ ] Make supersession/rollback explicit and preserve history.
- [ ] Limit membership to classification/conformity.
- [ ] Keep operation authorization, admission, eligibility, and activation separate.
- [ ] Fail closed without deleting local data.
- [ ] Implement future contracts in separate PRs only after approval.

## 25. Validation

Documentation-only validation is required: K-329, K-332, and K-333 focused suites; typecheck; build; and `git diff --check`. The known CRLF/LF K-333 fixture may report 92/93 locally and remains `ENVIRONMENT_SENSITIVE_NON_BLOCKING`; exact-head CI is merge-gating authority.

## 26. Final proposal status

### PROPOSAL_READY_FOR_OWNER_APPROVAL

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
