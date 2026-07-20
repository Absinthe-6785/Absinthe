# K-333D — K-333 ↔ K-329 Cross-Protocol Authority Binding Source-Facts Audit

## 1. Executive verdict

**Selection: `BLOCKED_BY_MISSING_AUTHORITY`.** K-329 is the sole canonical owner of reviewed writer-manifest policy and the relationship between its registration `writerTypeId`, `contextType`, and capabilities. K-333 preserves a `writerTypeId` and opaque `manifestDigest` inside a self-digested writer identity, but has no K-329 manifest decoder, entry resolver, membership proof, selection authority, or policy consequence.

K-333D cannot safely choose a membership subject, bind a writer instance to an entry, evaluate context/capability material, decide a validity window, or turn a match into admission or eligibility. This is an absence finding, not a request to add fields or change either protocol.

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`

## 2. Merged predecessor baseline

PR #593 merged K-333C1 at `9673212a4594196f3c25051f3202f0a8acd96091` through merge commit `6af6b606429d9547c1816eb8ddbb06bbc0d26e79` on 2026-07-19. K-333C1 established that the K-329 digest is SHA-256 over canonical manifest bytes; it is neither a K-333 self-digest nor a manifest-record identity. It also established that K-333 must not create a duplicate manifest schema, ID, codec, or self-digest, and that manifest membership remains deferred.

Source: `frontend/docs/K-333C-deferred-evidence-source-facts-audit.md:5-9,27-33,52-64` (reviewed design fact).

## 3. Source authority hierarchy

| Rank | Authority | Use in this audit |
|---|---|---|
| 1 | Merged implementation and permanent tests | Normative manifest/record fields, canonical encoding, strict decode, and graph relations. |
| 2 | Merged reviewed architecture documents | Reviewed ownership and deliberate deferrals. |
| 3 | Test-support contracts | Historical/design evidence only; never promoted to production authority. |
| 4 | Dormant persistence | Storage capability only; no manifest-selection authority. |
| 5 | Legacy implementations, comments, TODOs | Not load-bearing. |

K-329 owns policy evidence while K-333 owns strict evidence records. No lower-rank source authorizes K-333 to redefine K-329 concepts.

## 4. Search inventory

Searched source and adjacent reviewed documents for `ReviewedWriterManifest`, `ReviewedManifestAuthority`, `manifestDigest`, `manifestVersion`, `physicalSourceDigest`, `writerTypeId`, `writerId`, context, capabilities, membership, admission, eligibility, activation, generation, namespace, session, replacement, revocation, manifest history, persistence, repository, and runtime registration.

| File | Symbol / lines | Authority classification | Finding |
|---|---|---|---|
| `writerCoordinationEligibility.ts` | `ReviewedWriterManifest*` `:122-191`; validator `:475-533`; codec `:694-723` | normative implementation | K-329 policy and content digest. |
| same | registration/operation validators `:550-588`; coverage `:1160-1174`; eligibility `:1376-1442` | normative implementation | K-329 alone evaluates type/context/capability coverage. |
| `protocol/writerAuthorityProtocol.ts` | definitions `:26-108`; factories `:196-267`; graph validator `:374-407` | normative implementation | K-333 strict records without manifest resolution. |
| `protocol/transactionEvidenceProtocol.ts` | execution definitions `:39-104`; graph `:438-539` | normative implementation | K-333 execution evidence without membership policy. |
| `dormantWriterCoordinationRepository.ts` | boundary `:27-34`; envelope `:84-104`; opening `:703-766` | dormant persistence | Capability-gated K-330 envelope, not manifest registry/history. |

Meaningful no-result searches: K-333 has no K-329 codec import, manifest-entry lookup, identity mapping table, context/capability material decoder, active-manifest pointer, manifest persistence/history, or runtime caller that evaluates K-333 membership.

## 5. Existing K-329 manifest contract

`ReviewedWriterManifest` exactly contains `kind`, `schemaVersion`, `byteFormatVersion`, `physicalSourceDigest`, `manifestVersion`, and `entries`. Each entry exactly contains `writerTypeId`, `contextTypes`, `requiredCapabilities`, `authorityRole`, `coordinationRequirement`, and `exclusionProofCode`.

Source: `frontend/src/lib/localDatabase/writerCoordinationEligibility.ts:122-138,440-443` (normative implementation).

- Current constants are schema version `1`, byte format version `1`, manifest version `k329b-source-reviewed-v1`, and closed K-329 context/capability enums (`:3-10,34-57`).
- The validator rejects unknown/missing fields; entries are bounded, strictly increasing by `writerTypeId`, and have sorted unique context/capability arrays with valid role/requirement/proof combinations (`:475-506`).
- `orderedManifest`, canonical encode/decode, and SHA-256 derivation make the digest a canonical **content digest** (`:509-515,694-700`).
- `physicalSourceDigest` is immutable content and the creator uses the frozen reviewed inventory (`:174-180,517-521`).
- `ReviewedManifestAuthority.authorityId` is an authority identifier, not a manifest ID (`:182-191,702-706`). No manifest ID, namespace, generation, session, writer-instance binding, persistence, supersession, or history is defined.

## 6. Relevant K-333 record inventory

| Subject | IDs and bindings | Manifest / authority relation | Possible membership role |
|---|---|---|---|
| `WriterIdentityRecord` | `id`, `namespaceId`, `physicalSourceDigest`, `writerTypeId` | opaque `manifestDigest`; `writerDigest` commits fields | Candidate classification subject only; no entry proof. |
| `WriterSessionRecord` | `id`, namespace, generation, source, `writerId`/digest, epoch | opaque `capabilityDigest` only | Candidate time-bound subject; capability bytes unavailable. |
| `SourceAuthorityRecord` | `id`, namespace, generation, source, revision, roots, lifecycle head | no manifest field | Cannot select an entry. |
| `SourceTransactionReferenceRecord` | IDs/digests for authority, writer, session, operation, admission, terminal, outbox, checkpoint | no manifest field | Links an already-created graph only. |
| `OperationRecord` / `AdmissionRecord` | operation/admission/writer/session evidence | no manifest field | Execution evidence, not policy membership. |
| `ImmutableOutboxIntentRecord` / `TerminalStateRecord` | outbox/terminal/operation evidence | no manifest field | Delivery or terminal evidence only. |

Source: `frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts:26-108,196-345,374-407` and `frontend/src/lib/localDatabase/protocol/transactionEvidenceProtocol.ts:39-104,210-353,438-539` (normative implementation). K-333A calls `writerTypeId` manifest-scoped but explicitly defers membership (`frontend/docs/K-333A-canonical-production-protocol-foundation.md:169-180`, reviewed design fact).

## 7. Identifier-equivalence audit

| Potential relation | Classification | Evidence / limit |
|---|---|---|
| K-333 `writerTypeId` ↔ K-329 entry `writerTypeId` | `PARTIAL_RELATION` | Same identifier label and reviewed manifest-scoped description, but no cross-protocol evaluator/entry relation. |
| K-333 `writerId` ↔ K-329 `writerTypeId` | `NO_RELATION_FOUND` | K-333 identity and type are separate (`writerAuthorityProtocol.ts:26-35`); K-329 derives type from its own registration writer ID (`writerCoordinationEligibility.ts:550-568`). |
| K-333 session `writerId` ↔ K-333 writer identity | `EXACT_EQUIVALENCE_DEFINED` | K-333 graph requires equality of writer ID/digest (`writerAuthorityProtocol.ts:374-404`). |
| K-329 runtime registration ID ↔ K-333 writer identity ID | `NO_RELATION_FOUND` | No mapper or import exists. |
| physical-source identity | `PARTIAL_RELATION` | Both use digests and each protocol binds them internally; no cross-protocol derivation exists. |

String similarity is not identifier equivalence. The missing K-333 ↔ K-329 writer-instance mapping is blocking authority.

## 8. Context evidence audit

K-329 defines a closed `WriterContextType` label and registrations carry one `contextType`; coverage verifies it is permitted by an entry (`writerCoordinationEligibility.ts:34-39,213-229,550-568,1160-1174`, normative implementation). K-333 writer, session, authority, and reference records have no context field; their digests cannot be inverted to recover one.

Verdict: **`DEFINED_OUTSIDE_K333`** for the K-329 label and **`ABSENT`** for canonical K-333 comparison material. Scope, immutability, persistence, and multi-context rules are undefined across the boundary.

## 9. Capability evidence audit

K-329 specifies entry `requiredCapabilities`, registration `capabilities`, and checks coverage (`writerCoordinationEligibility.ts:122-129,213-229,550-568,1160-1174`, normative implementation). K-333 session has only `capabilityDigest`, with no capability list, decoder, derivation source, or relation to an entry (`writerAuthorityProtocol.ts:37-49,222-231,286-300`, normative implementation).

Verdict: **`DEFINED_OUTSIDE_K333`** for policy and **`ABSENT`** for K-333 capability material. An opaque digest is not capability evidence.

## 10. Membership subject and scope

| Candidate | Stable subject / scope fact | Result |
|---|---|---|
| writer type | K-329 entry identifies this label | Can classify a K-329 registration only; K-333 relation is partial. |
| writer identity | K-333 has ID, type, namespace, source, digest | No entry mapping or K-329 registration binding. |
| writer session | K-333 has generation/epoch and writer binding | No context/capability material or validity rule. |
| operation/admission | K-333 graph binds them to writer/session | No manifest policy consequence. |
| source authority/reference | K-333 scopes an evidence graph | No manifest selection. |
| physical source or namespace/generation | Both carry source; only K-333 carries namespace/generation | No cross-boundary scope rule. |

No fact selects a membership subject, cardinality, validity window, or whether membership classifies a writer rather than authorizes a session or operation.

## 11. Evaluation-time audit

| Candidate time | Evidence available | Classification |
|---|---|---|
| K-329 registration/coverage | K-329 manifest, registration context/capabilities | `PURE_IN_MEMORY` within K-329 only. |
| K-333 writer identity creation | type/digest/source/namespace only | `NOT_ENOUGH_INFORMATION`. |
| K-333 session creation | adds generation and opaque capability digest | `NOT_ENOUGH_INFORMATION`. |
| K-333 graph validation/admission/operation | K-333 links only | `NOT_ENOUGH_INFORMATION`. |
| restart/restore/eligibility | needs selection/history and trusted resolution | `REQUIRES_HISTORICAL_LOOKUP` if binding is required. |

K-329 derives a frozen current manifest from physical source at model creation (`writerCoordinationEligibility.ts:1214-1237`); no cross-protocol evaluation time may be selected.

## 12. Manifest selection/history audit

No active/current pointer, replacement, supersession, revocation, effective time/generation, rollback, restore, or durable historical manifest lookup exists. `createK329BReviewedWriterManifest` derives the frozen K-329B inventory for a source (`writerCoordinationEligibility.ts:174-180,517-521,717-723,1214-1237`, normative implementation). The K-330 envelope is test/developer capability gated and is not a manifest-history API (`dormantWriterCoordinationRepository.ts:27-34,84-104,703-766`, dormant persistence).

A content digest verifies supplied bytes but cannot retrieve historical bytes or define a validity window.

## 13. Physical source, namespace, and generation

The K-329 manifest is physically-source-bound and excludes namespace/generation (`writerCoordinationEligibility.ts:131-138,509-521`). K-333 identity is bound to namespace and physical source; session, source authority, reference, and execution graph also bind generation (`writerAuthorityProtocol.ts:26-97,374-405`; `transactionEvidenceProtocol.ts:39-104,438-539`). Exact equality is implemented only inside each protocol. No source says whether a K-329 manifest is adopted per namespace, generation, writer, or session.

## 14. Authorization consequence audit

| Consequence | Classification |
|---|---|
| writer type listed in a K-329 manifest | `ALREADY_DEFINED` within K-329 coverage. |
| context/capability match for a K-329 registration | `ALREADY_DEFINED` within K-329 coverage. |
| K-333 writer/session membership | `UNDEFINED`. |
| K-333 session authorization | `UNDEFINED`. |
| K-333 operation authorization | `UNDEFINED`; graph integrity is not policy authorization. |
| admission approval from manifest match | `FORBIDDEN_AT_CURRENT_STAGE`. |
| production source eligibility from manifest match | `FORBIDDEN_AT_CURRENT_STAGE`. |

K-333B labels the records evidence-only and preserves deferred membership (`frontend/docs/K-333B-production-transaction-evidence-records.md:5-7,78-80,140-146`, reviewed design fact). A future match must not be conflated with session authorization, operation authorization, admission, or eligibility.

## 15. Admission and eligibility relationship

K-329 coverage participates in its own coordination reducer and eligibility evidence (`writerCoordinationEligibility.ts:1156-1174,1376-1439`, normative implementation). K-333 records have no K-329 import or membership evaluation, and no runtime caller invokes K-333 as admission or eligibility policy. The K-330 repository is capability-gated and has no production caller (`dormantWriterCoordinationRepository.ts:27-34,703-766`).

No current production rule connects a K-333 manifest reference to K-329 membership, admission, source eligibility, or activation.

## 16. Persistence and lookup audit

`PURE_EXPLICIT_INPUT_VALIDATION` is available only for validating supplied K-329 manifest bytes against the K-329 codec. It cannot select a trusted manifest for a K-333 identity, map identity to a K-329 registration, or resolve a historical digest after restart. A binding with validity/history would require both `TRUSTED_RUNTIME_SELECTION_REQUIRED` and `DURABLE_DIGEST_LOOKUP_REQUIRED`; historical validation would additionally require `HISTORICAL_LOOKUP_REQUIRED`. Those authority contracts are absent.

Accepting arbitrary caller-supplied bytes without a selection authority creates manifest-substitution risk. No repository or storage change is made here.

## 17. Candidate contract-shape matrix

| Shape | Source support | Verdict |
|---|---|---|
| A. Direct validation against supplied K-329 manifest | Codec exists; subject/mapping/context/capability/selection do not | `BLOCKED`. |
| B. Existing authority adopts a manifest digest | Source authority has no manifest/adoption semantics | `REQUIRES_SCHEMA_CHANGE`; `REQUIRES_PERSISTENCE`. |
| C. Immutable binding evidence record | No selected subject or field inventory | `SPECULATIVE`; `REQUIRES_SCHEMA_CHANGE`. |
| D. Session context/capability evidence | K-333 has opaque/no material | `BLOCKED`. |
| E. Persistent manifest selection/history | No registry, pointer, history, or lookup | `REQUIRES_PERSISTENCE`; `BLOCKED`. |

No candidate is `SOURCE_GROUNDED` for implementation.

## 18. Dependency and construction-order graph

```text
K-329 canonical manifest bytes -> K-329 manifest content digest
        |                            X  (no authoritative cross-protocol edge)
        v
K-329 registration (type/context/capabilities)

K-333 writer identity (type, manifestDigest, source, namespace) -> writer digest
        -> writer session (writer digest, generation, capabilityDigest) -> session digest
        -> operation/admission/outbox/terminal evidence -> source authority/reference graph
```

Existing K-333 edges are IDs, self-digests, physical-source, namespace/generation, and graph relations (`writerAuthorityProtocol.ts:374-407`; `transactionEvidenceProtocol.ts:438-539`). Missing edges are identity ↔ registration, entry identity, context, capability material, selection authority, history, and policy consequence. There is no existing digest cycle, but a new direction would require unavailable selection and subject data; none is proposed.

## 19. Threat model

| Threat class | Existing protection | Missing protection / required future layer |
|---|---|---|
| wrong writer identity/type, cross-writer entry reuse, cross-session reuse | K-333 self-digests and internal writer/session graph binding | authoritative K-333 ↔ K-329 identity and membership relation. |
| stale/substituted context or capability | K-329 validates its registrations | K-333 material, derivation, and validity rule. |
| cross-source, stale namespace/generation, cross-graph mixing | K-329 source digest; K-333 internal scope graph checks | cross-protocol scope/adoption binding. |
| superseded/rolled-back/unavailable manifest, restore selection | canonical digest detects altered supplied bytes | selection, retention, history, supersession, and restore policy. |
| manifest/entry substitution | strict K-329 codec | trusted manifest authority and K-333 entry binding. |
| valid K-333 digest without membership; membership without operation authorization | K-333 graph integrity | explicit distinction among classification, authorization, admission, and eligibility. |
| unknown manifest/bridge version or partial graph acceptance | strict v1 record/codec rejection | reviewed cross-protocol version and complete binding graph contract. |

## 20. Version and compatibility audit

Authoritative versions are K-329 schema `1`, byte format `1`, manifest version `k329b-source-reviewed-v1` (`writerCoordinationEligibility.ts:3-10,131-138`) and K-333 strict v1 record/envelope versions with unsupported-version rejection (`writerAuthorityProtocol.ts:15-24,354-365`; `transactionEvidenceProtocol.ts:265-353`).

Undefined facts are binding/membership/adoption/context-capability evidence versions, manifest history/supersession versions, and cross-protocol compatibility edges. This audit cannot change a K-333 compatibility graph, create a cross-protocol table, or promote a runtime mapping to authority.

## 21. Selection decision

`BLOCKED_BY_MISSING_AUTHORITY`

The precise blockers are: (1) no authoritative K-333 identity-to-K-329 registration/entry relation; (2) no K-333 context material; (3) no K-333 capability material; (4) no selected membership subject or authorization consequence; and (5) no manifest selection/history/lookup contract. Multiple incompatible implementation shapes remain plausible, so no precursor can be selected without owner choices.

## 22. Owner-decision package

| Decision | Why it matters | Evidence / options | Consequence |
|---|---|---|---|
| Is membership about writer type, identity, or session? | Determines subject, cardinality, and scope. | K-329 entry is type policy; K-333 has identity and session records. | Enables a stable relation only after semantics are chosen. |
| What maps K-333 identity to K-329 registration/type? | Avoids writerId/type confusion. | No mapper exists; options are a shared immutable identity rule, reviewed mapping, or no relation. | Determines whether matching is possible. |
| Who owns context and capability evidence? | K-333 cannot compare policy to opaque/no material. | K-329 registration owns concrete values; K-333 does not. | Determines whether membership can be validated. |
| What consequence follows membership? | Prevents policy escalation. | Current K-333 is evidence-only. | Defines maximum safe effect. |
| How are manifests selected, retained, superseded, revoked, and recovered? | Prevents substitution and stale reuse. | Current K-329B is frozen/no history. | Determines whether explicit input or durable lookup is required. |
| What source/namespace/generation scope is adopted? | K-329 is source-only; K-333 is narrower. | No cross-boundary rule exists. | Determines replay/cross-generation protection. |

No evidence-supported default is recommended. The smallest next clarification is an owner-reviewed authority decision for these semantics, separate from production implementation.

## 23. Explicit non-goals

This audit adds no K-329/K-333 codec, manifest representation, manifest ID or self-digest, binding/membership/capability/context record, compatibility-table change, store/index/schema/version, migration, repository, durable lookup, transaction, runtime consumer, registration, admission integration, eligibility, activation, or K-334 work.

## 24. Validation

Documentation-only validation will run:

| Command | Outcome |
|---|---|
| `npm test -- --run src/lib/localDatabase/writerCoordinationEligibility.test.ts` | Passed: 122/122. |
| `npm test -- --run src/lib/localDatabase/crossModuleSourceAuthorityK332.test.ts` | Passed: 22/22. |
| `npm test -- --run src/lib/localDatabase/protocol` | 92/93: the known CRLF/LF-sensitive `rejects selector and loop-structure mutations in bounded source fixtures` failed only because its LF mutation anchor was absent in this checkout; `ENVIRONMENT_SENSITIVE_NON_BLOCKING`. No protocol/test source was changed. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed: 2,480 modules transformed. |
| `git diff --check` | Passed. |

Exact-head CI is the final merge-gating authority. No audit test is added.

## 25. Next-task acceptance criteria

No binding implementation is accepted from this audit. A later task may begin only after owner decisions define an authoritative subject/mapping, concrete context and capability evidence, source/namespace/generation scope, manifest selection and historical resolution, a non-escalating consequence, and a versioned dormant validation boundary. It must preserve:

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
