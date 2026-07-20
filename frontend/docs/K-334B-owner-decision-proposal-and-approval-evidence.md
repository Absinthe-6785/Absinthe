# K-334B — Owner-Decision Proposal and Explicit Approval Evidence

## 1. Executive verdict

`K334B_OWNER_DECISION_PACKAGE_READY_FOR_EXPLICIT_REVIEW`

This is a documentation-only proposal package for the Absinthe Protocol Owner. All twelve decisions are `OWNER_APPROVAL_PENDING`; recommendations are non-authoritative and no implementation is authorized.

## 2. Scope and authority boundary

`SOURCE_FACT`: [K-334A](K-334A-durable-protocol-repository-atomicity-audit.md) was merged at `07de0b10cbea39e77c27185f1252a0ae4d67da11`. It establishes that K-334 owns later additive persistence work but that no topology, database, version, store, migration, repository, or transaction implementation has been selected.

Codex is the proposal author, not the approving authority. A Git commit, merged PR, CI success, review PASS, implementation feasibility, current source behavior, and this task request are not owner approval. The approving authority named by K-333F and K-334A is the **Absinthe Protocol Owner**. Recommendations remain non-authoritative until explicit owner evidence exists.

## 3. Merged baseline

- `SOURCE_FACT`: current Notes persistence remains a mixed legacy IndexedDB/localStorage fallback reality; `absinthe-local-v2` remains dormant.
- `SOURCE_FACT`: K-333F defines future canonical selection/history rules, including exact-subject linearization, but no durable K-333 repository.
- `SOURCE_FACT`: accepted history is authority evidence; materialized heads and indexes are derived projections.
- `SOURCE_FACT`: an initial source-operation authority commit and later terminal reconciliation are distinct lifecycle stages.
- `SOURCE_FACT`: current production Notes cannot atomically commit with a separate `absinthe-local-v2` protocol repository.
- `CONTRACT_INFERENCE`: K-334C may define only a conceptual schema and migration contract after applicable owner evidence; it does not implement it.

## 4. Decision method

Every decision distinguishes `SOURCE_FACT`, `CONTRACT_INFERENCE`, `RECOMMENDED_POLICY`, `ALTERNATIVE_POLICY`, `OWNER_APPROVAL_PENDING`, `OWNER_APPROVED`, `OWNER_REJECTED`, `DEFERRED_BY_OWNER`, and `PROHIBITED_ASSUMPTION`.

`OWNER_APPROVED` may appear only in later, explicit owner evidence. Each recommendation preserves exact-subject scope, append-only evidence, fail-closed unknowns, and the K-333 proof boundary; it is not a source fact or an approval.

## 5. Approval-evidence model

This document revision is `K334B-PROPOSAL-r2`. It is a human-readable proposal
revision identifier, not a digest, signature, database value, or self-reference.
The stable decision identity never changes: `K334B-D01` through `K334B-D12`.

Each decision version is immutable and uses `K334B-DNN-vN` (for example,
`K334B-D04-v2`). A semantic change to a decision's exact question, option set,
recommended-policy meaning, invariants, scope, effects, or required approval
must increment that decision's `vN` monotonically. The K-334B1 corrections are
semantic for D04, D06, and D12, whose current versions are therefore v2; the
other decisions remain v1. Editorial or formatting-only corrections do not
increment a decision version, but must be recorded as a bounded correction to
the proposal revision and must not alter the referenced decision semantics.

Before a proposal version is in an immutable external Git commit, its register
status is `DRAFT_NOT_PUBLISHED` and
`UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED`. No owner approval can be recorded
against it. After an immutable commit is pushed, later external approval
evidence may reference that exact commit and decision version; the PR body is
the publication record for that commit. This document does not hash or embed
its own future commit, avoiding a self-referential commit scheme.

Each later approval-evidence entry must contain:

| Field | Documentation-level requirement |
|---|---|
| `decisionId` | Stable ID `K334B-D01` through `K334B-D12`. |
| `decisionVersion` | Immutable exact decision version, such as `K334B-D04-v2`. |
| `proposalDocument` | This document path. |
| `proposalCommit` | Immutable externally published Git commit containing the reviewed proposal version. |
| `approvingAuthority` | Explicitly identifies the Absinthe Protocol Owner. |
| `disposition` | `OWNER_APPROVAL_PENDING`, `OWNER_APPROVED`, `OWNER_REJECTED`, `DEFERRED_BY_OWNER`, or `SUPERSEDED`. |
| `selectedOption` | Exact option ID or explicitly scoped alternative. |
| `approvalStatement` | Unambiguous owner statement for the decision/version/scope. |
| `approvedAt` | Owner-supplied timestamp or explicit absence. |
| `evidenceReference` | Stable reference to the external approval evidence. |
| `supersedesEvidenceReference` | Historical prior-evidence reference when applicable. |
| `notes` | Bounded clarification; never substitutes for the fields above. |

Approval evidence must bind the document revision, immutable proposal commit,
decision ID/version, selected option, statement, exact effective scope,
timestamp, and any supersession reference. Approval cannot be inferred from
missing fields, merge status, CI, a review, this task, or a publication commit.
Old evidence is historical and immutable: semantic revisions require new
approval evidence and explicit supersession rather than editing prior evidence.

A batch approval must enumerate every decision/version and exact scope it
approves; an omitted decision is not approved. A partial approval must state
the approved and unapproved scope, with every unapproved portion remaining
pending. This is not a codec, signature scheme, database record, API, or
runtime validator.

## 6. Decision summary matrix

| ID | Decision | Recommended option | Confidence | Current disposition |
|---|---|---|---|---|
| D01 | Generic issuer authorization | A — explicit owner-reviewed issuer policy | HIGH | `OWNER_APPROVAL_PENDING` |
| D02 | Rollback-specific authorization | A — separate explicit rollback permission | HIGH | `OWNER_APPROVAL_PENDING` |
| D03 | Generation termination | A — explicit durable termination event | HIGH | `OWNER_APPROVAL_PENDING` |
| D04 | Generation inheritance | A — no automatic authority inheritance | HIGH | `OWNER_APPROVAL_PENDING` |
| D05 | History topology | A — strict single-successor linear history | HIGH | `OWNER_APPROVAL_PENDING` |
| D06 | History retention | A — preserve authority evidence in v1 | HIGH | `OWNER_APPROVAL_PENDING` |
| D07 | Fork resolution | A — permanent fail-closed quarantine | MEDIUM | `OWNER_APPROVAL_PENDING` |
| D08 | Concurrent-successor conflict | B — preserve conflict pending explicit resolution | MEDIUM | `OWNER_APPROVAL_PENDING` |
| D09 | Compatibility combinations | A — explicit allowlist matrix | HIGH | `OWNER_APPROVAL_PENDING` |
| D10 | Retrospective invalidation | A — no silent retrospective invalidation | HIGH | `OWNER_APPROVAL_PENDING` |
| D11 | External-boundary mapping | A — explicit owner-reviewed mapping | HIGH | `OWNER_APPROVAL_PENDING` |
| D12 | Implementation-gate approval | A — explicit scoped owner approval | HIGH | `OWNER_APPROVAL_PENDING` |

## 7. Generic issuer authorization

### K334B-D01 — Generic issuer authorization

- **Exact question:** Who or what may authorize a lifecycle event for an exact protocol subject?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F requires generic issuer authorization before predecessor validation and rejects issuer authority inferred from digest, sequence, storage, or current-head knowledge.
- **Invariants:** authority is explicit, exact-subject or explicitly scoped, action-bounded, and unknown issuer behavior fails closed.
- **Option set:** **A** explicit local owner-reviewed issuer policy scoped to namespace, physical source, generation/scope, action set, and lifecycle status; **B** authenticated application account automatically acts as issuer; **C** writer/session, digest, or capability possession acts as issuer.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). Owner preference for a different trusted issuer model would change this recommendation only if it preserves the same explicit scope and fail-closed checks.
- **Recommendation rationale / rejected options:** A separates application authentication from protocol authority. B and C are rejected because remote identity, session possession, or bytes do not establish protocol issuance authority.
- **Persistence consequence:** future accepted-event records need an approved issuer-reference contract, but no issuer store is selected here.
- **Planning effect:** `REQUIRED_BEFORE_K334C_POLICY_SCHEMA_FINALIZATION` for accepted-write, issuer-reference, and admission semantics.
- **Issuance effect:** `BLOCKS_ACCEPTED_EVENT_ISSUANCE` while pending.
- **Implementation effect:** blocks accepted-event repository/write validation and issuer authorization implementation.
- **Safe unresolved behavior:** preserve diagnostics or proposed evidence without accepting an event.
- **Prohibited assumptions:** authentication, writer/session possession, capability possession, digest, sequence, predecessor, persisted bytes, or a materialized head grants issuer authority.
- **Required approval evidence:** selected issuer model, exact scope/action rules, unknown-issuer behavior, and proposal version.

## 8. Rollback-specific authorization

### K334B-D02 — Rollback-specific authorization

- **Exact question:** What additional authority is required to issue `ROLLBACK_DECISION`?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F requires generic issuer authorization, a present exact-subject lineage target, and additional future rollback authorization.
- **Invariants:** historical membership alone never grants rollback authority; rollback never rewrites history.
- **Option set:** **A** separate explicit rollback permission in addition to generic issuer authority; **B** generic issuer permission includes rollback; **C** manual owner approval for every rollback.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). Owner may prefer C for an emergency-only workflow, but B remains unsafe without a separately approved narrower policy.
- **Recommendation rationale / rejected options:** A keeps exceptional authority distinguishable and auditable. B is overbroad; C is safe but may be operationally unsuitable.
- **Persistence consequence:** future rollback authority evidence must be separately bound; no record format is selected.
- **Planning effect:** `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS`.
- **Issuance effect:** `BLOCKS_ONLY_ROLLBACK_DECISION_ISSUANCE` while pending.
- **Implementation effect:** blocks rollback acceptance and authorization logic.
- **Safe unresolved behavior:** reject rollback; preserve evidence; do not relabel it as `SUPERSEDE`.
- **Prohibited assumptions:** generic issuer authority or a historical target automatically authorizes rollback.
- **Required approval evidence:** selected rollback authorizer, scope, required evidence, and proposal version.

## 9. Generation termination

### K334B-D03 — Generation termination

- **Exact question:** What exact event or evidence terminates a generation?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F does not determine a generation end and rejects automatic termination from runtime/session disappearance.
- **Invariants:** termination is explicit, durable, exact-generation scoped, and cannot be inferred from browser/process state.
- **Option set:** **A** explicit owner-authorized durable termination event; **B** successful successor-generation activation terminates the predecessor; **C** deletion, timeout, session loss, browser closure, or database reopen terminates it.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). An owner may approve B only with an explicit cross-generation event and source binding; C is rejected.
- **Recommendation rationale / rejected options:** A is restart-safe and auditable. B otherwise conflates activation with termination. C makes transient runtime state authority.
- **Persistence consequence:** future terminal lifecycle evidence requires exact-generation binding; no codec or store is selected.
- **Planning effect:** `CONDITIONALLY_REQUIRED_FOR_K334C` when finalizing terminal-generation state or lifecycle keys.
- **Issuance effect:** `BLOCKS_ONLY_GENERATION_LIFECYCLE_ISSUANCE` while pending.
- **Implementation effect:** blocks terminal-generation handling.
- **Safe unresolved behavior:** infer no termination and retain the generation as an independent subject.
- **Prohibited assumptions:** missing tab, expired process, absent Web Lock, session closure, elapsed time, or database reopen terminates a generation.
- **Required approval evidence:** valid termination trigger, actor, exact scope, successor relationship if any, and proposal version.

## 10. Generation inheritance

### K334B-D04 — Generation inheritance

- **Exact question:** Which of history/reference, effective selection, issuer authority, compatibility, rollback membership, and lifecycle state, if any, may a successor generation inherit?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F treats each generation as a new subject and supplies no implicit inheritance.
- **Invariants:** history/reference, effective selection, issuer authority, compatibility, rollback membership, and lifecycle state remain independently scoped. A successor must not automatically receive a lifecycle state, including active, terminal, revoked, quarantined, or eligible, from a predecessor.
- **Option set:** **A** no automatic inheritance of any listed dimension; **B** an explicit owner-approved carry-forward record that names every transferred dimension and exact source/target binding; **C** automatic inheritance from namespace, source, account, device, writer, successor relation, or previous-active status.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). B may be approved later only as an explicit, auditable decision; C is rejected.
- **Recommendation rationale / rejected options:** A prevents cross-generation replay, stale authority, and lifecycle-state transfer. B can preserve provenance without transfer by default. C turns continuity into authority.
- **Persistence consequence:** future cross-generation reference, lifecycle-state, and carry-forward semantics remain unselected.
- **Planning effect:** `CONDITIONALLY_REQUIRED_FOR_K334C` only for cross-generation links, carry-forward keys, lifecycle-state transfer, or inheritance records.
- **Issuance effect:** `BLOCKS_ONLY_GENERATION_LIFECYCLE_ISSUANCE` while pending.
- **Implementation effect:** blocks carry-forward and inheritance implementation.
- **Safe unresolved behavior:** each generation remains an exact independent subject; no authority or lifecycle state carries forward.
- **Prohibited assumptions:** successor generation automatically inherits history/reference, selection, issuer authority, compatibility, rollback membership, lifecycle state, namespace/source/account/device/writer continuity, successor status, or previous active state.
- **Required approval evidence:** selected inheritance classes including lifecycle state, exact source/target binding, scope, no-transfer dimensions, and immutable decision version.

## 11. History topology

### K334B-D05 — History topology

- **Exact question:** What accepted-history topology is authoritative?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F defines one exact predecessor, contiguous sequence, at most one authoritative successor, and fail-closed fork handling for an exact subject.
- **Invariants:** predecessor cardinality, successor uniqueness, exact-subject sequence, authoritative head derivation, and restore/migration reconstruction remain deterministic.
- **Option set:** **A** strict single-successor linear history; **B** branch-preserving DAG with explicit resolution; **C** timestamp/latest-row selection.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). B would require a new approved proof and resolution contract; C is rejected.
- **Recommendation rationale / rejected options:** A aligns with K-333F and gives bounded reconstruction/index semantics. B increases authority and recovery complexity. C makes storage order authority.
- **Persistence consequence:** controls future lineage keys, uniqueness constraints, head projection, fork representation, indexes, migration, and restore contract.
- **Planning effect:** `REQUIRED_BEFORE_K334C_POLICY_SCHEMA_FINALIZATION`.
- **Issuance effect:** `BLOCKS_ACCEPTED_EVENT_ISSUANCE` where valid authoritative lineage cannot be determined.
- **Implementation effect:** blocks accepted-history schema/repository implementation.
- **Safe unresolved behavior:** derive no authoritative topology, head, or selection beyond current pure-contract evidence.
- **Prohibited assumptions:** timestamp, insertion order, database key order, latest row, or cache is authoritative lineage.
- **Required approval evidence:** selected topology, predecessor/successor rule, fork treatment, and proposal version.

## 12. History retention

### K334B-D06 — History retention

- **Exact question:** How must accepted, revoked, superseded, fork, rejected-proposal, diagnostic, restore-reference, and approval evidence be retained, exported, and distinguished?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F requires retained history/bytes while referenced and rejects destructive pruning implied by a current head.
- **Invariants:** accepted, revoked, superseded, fork, rejected-proposal, diagnostic, restore-reference, and approval evidence remain distinguishable and are not silently deleted when needed for proof. Any future export must preserve provenance and complete lineage rather than collapse evidence to a current head.
- **Option set:** **A** append-only v1 preservation of all listed evidence classes, with any exported copy retaining complete lineage and non-authoritative provenance; **B** a separately owner-approved checkpoint, compaction, archival, and export-provenance policy; **C** retain or export only the current head.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). Owner preference for bounded retention may later select B with a separate archival/checkpoint contract; C is rejected.
- **Recommendation rationale / rejected options:** A keeps lineage reconstructible and exported evidence attributable pending a proven archival design. B is not defined here. C cannot prove lineage or provenance.
- **Persistence consequence:** no deletion, compaction, TTL, archival, quota ceiling, retention period, export format, or import/restore authority is selected.
- **Planning effect:** `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS`.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY`.
- **Implementation effect:** blocks compaction, deletion, export, import, and restore-authority implementation.
- **Safe unresolved behavior:** preserve referenced evidence append-only; do not compact, archive destructively, delete, treat an export as authoritative, or select an export format.
- **Prohibited assumptions:** age, an extant head, quota pressure, an exported copy, or a successfully imported/restored copy authorizes deletion, compaction, source replacement, issuer authority, eligibility, or activation.
- **Required approval evidence:** selected retention option, whether all accepted evidence remains retained in v1, complete-lineage export requirement, treatment of conflict/rejected evidence, exported-copy non-authority, deferred compaction status, and immutable decision version.

## 13. Fork resolution

### K334B-D07 — Fork resolution

- **Exact question:** Can an already forked accepted-history state ever be resolved, and by what authority?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F preserves all branches, derives no winner/current result from an unresolved fork, and fails closed for the exact subject.
- **Invariants:** all branch evidence is preserved; no winner, authoritative head, accepted current selection, or state-changing issuance is derived for the forked subject.
- **Option set:** **A** permanent fail-closed quarantine; **B** explicit owner-authorized resolution event that identifies every branch and re-establishes a unique head; **C** automatic winner by commit order, timestamp, digest ordering, latest observation, or last-write-wins.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, MEDIUM). An owner may later choose B only with a complete branch-preserving resolution contract; C is rejected.
- **Recommendation rationale / rejected options:** A preserves safety with no invented resolution authority. B adds material recovery/authority complexity. C makes incidental order authoritative.
- **Persistence consequence:** conflict evidence can be retained neutrally; winner-resolution record semantics remain unselected.
- **Planning effect:** `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` for neutral conflict preservation only.
- **Issuance effect:** `BLOCKS_STATE_CHANGING_ISSUANCE_FOR_FORKED_SUBJECT`.
- **Implementation effect:** blocks fork-winner selection and accepted write paths for forked subjects.
- **Safe unresolved behavior:** preserve every branch, accept no winner, advance no authoritative head, and reject or hold state-changing issuance only for the forked subject.
- **Prohibited assumptions:** last write, latest timestamp, first observation, insertion/key order, or lowest/highest digest resolves a fork.
- **Required approval evidence:** selected resolution policy, eligible resolver, complete-branch rule, resulting-head rule, and proposal version.

## 14. Concurrent-successor conflict resolution

### K334B-D08 — Concurrent-successor conflict resolution

- **Exact question:** How are competing successor proposals against the same current predecessor handled before acceptance?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F forbids two valid successors from one predecessor, requires atomic predecessor/sequence/successor establishment, and preserves conflict evidence without choosing a winner.
- **Invariants:** competing successor acceptance fails closed; contender evidence is preserved; no authoritative head advances for the conflicted predecessor/subject.
- **Option set:** **A** first valid native transaction commits and losers remain rejected evidence; **B** preserve conflict and require explicit owner resolution before acceptance; **C** timestamp, process, network, or commit ordering selects a winner.
- **Recommended option:** **B** (`RECOMMENDED_POLICY`, MEDIUM). An owner may choose A only with an explicit proof that transaction-time validation is the policy-selected acceptance rule rather than incidental observation order; C is rejected.
- **Recommendation rationale / rejected options:** B avoids treating serialization as unstated authority. A can be safe only under an approved exact acceptance rule. C is arbitrary.
- **Persistence consequence:** future conflict/evidence records must preserve exact predecessor and subject; no winner record is selected.
- **Planning effect:** `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` for fail-closed conflict preservation.
- **Issuance effect:** `BLOCKS_ACCEPTANCE_OF_COMPETING_SUCCESSOR_AND_STATE_CHANGING_ISSUANCE_FOR_CONFLICTED_SUBJECT`.
- **Implementation effect:** blocks automatic winner logic and conflict-dependent accepted writes.
- **Safe unresolved behavior:** reject or hold contenders, preserve evidence, accept no winner, and advance no authoritative head.
- **Prohibited assumptions:** IndexedDB commit order, transaction completion, process/network arrival, first observation, fastest tab, timestamp, or digest ordering is authority.
- **Required approval evidence:** selected conflict acceptance/resolution rule, transaction proof requirement, exact scope, and proposal version.

## 15. Compatibility combinations

### K334B-D09 — Compatibility combinations

- **Exact question:** Which manifest, protocol, codec, writer type, source type, and feature-set combinations may participate in accepted history?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F requires explicit compatibility and makes unsupported combinations fail closed; decodability is not compatibility.
- **Invariants:** canonical validity, compatibility, authority, eligibility, and activation remain distinct.
- **Option set:** **A** explicit owner-reviewed allowlist matrix; **B** same major version implies compatibility; **C** successful decoding implies compatibility.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). B and C are rejected.
- **Recommendation rationale / rejected options:** A is explicit and auditable. B and C infer a compatibility edge without owner policy.
- **Persistence consequence:** future supported-tuple/index/decoder-retention contract is unselected.
- **Planning effect:** `REQUIRED_BEFORE_K334C_POLICY_SCHEMA_FINALIZATION`.
- **Issuance effect:** blocks accepted issuance only for unsupported or unapproved tuples.
- **Implementation effect:** blocks compatibility enforcement implementation.
- **Safe unresolved behavior:** reject unknown/mixed combinations; preserve evidence without inferring compatibility.
- **Prohibited assumptions:** shared major version, successful decoding, matching version string, or canonical bytes imply compatibility.
- **Required approval evidence:** allowlist scope, unknown-tuple result, deprecation/decoder-retention intent, and proposal version.

## 16. Retrospective invalidation

### K334B-D10 — Retrospective invalidation

- **Exact question:** Can later policy invalidate previously accepted events?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F defaults to prospective revocation and preserves immutable historical evidence.
- **Invariants:** accepted history is not silently rewritten, deleted, or reclassified by later policy.
- **Option set:** **A** no silent retrospective invalidation; **B** explicit owner-authorized invalidation event; **C** new policy silently reinterprets history.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). B requires a separate bounded contract; C is rejected.
- **Recommendation rationale / rejected options:** A protects historical proof and recovery evidence. B could be scoped later. C destroys stable meaning.
- **Persistence consequence:** no invalidation record, rewrite mechanism, or deletion behavior is selected.
- **Planning effect:** `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS`.
- **Issuance effect:** `DOES_NOT_BLOCK_ISSUANCE_BUT_BLOCKS_LATER_POLICY`.
- **Implementation effect:** blocks invalidation processing.
- **Safe unresolved behavior:** apply no retrospective effect and preserve historical evidence.
- **Prohibited assumptions:** later policy, merge, or review silently invalidates prior accepted evidence.
- **Required approval evidence:** selected prospective/retrospective scope, effect timing, historical preservation rule, and proposal version.

## 17. External-boundary mapping

### K334B-D11 — External-boundary mapping

- **Exact question:** How may external account, authentication, provider, remote-record, or session identity map to a local protocol subject or issuer?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F supplies no external effective-boundary mapping and requires downstream users to identify a boundary explicitly.
- **Invariants:** an external reference is opaque/non-authoritative until explicitly mapped; generic issuer authorization remains independently required.
- **Option set:** **A** explicit owner-reviewed mapping record; **B** authenticated user ID automatically maps to local issuer; **C** email, provider ID, remote ownership, session, or token possession implies authority.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). B and C are rejected.
- **Recommendation rationale / rejected options:** A creates an explicit policy boundary. B/C turn application identity or credential possession into protocol authority.
- **Persistence consequence:** no authoritative external-to-local mapping record or integration is selected.
- **Planning effect:** `CONDITIONALLY_REQUIRED_FOR_K334C` only for schema that embeds authoritative external mappings.
- **Issuance effect:** `BLOCKS_ISSUANCE_PATHS_DEPENDENT_ON_EXTERNAL_SUBJECT_OR_ISSUER_MAPPING`; local-only paths are not blocked by this decision alone.
- **Implementation effect:** blocks mapping-dependent integration and external identity-to-subject/issuer authority implementation.
- **Safe unresolved behavior:** retain needed external references only as opaque data; infer no subject/issuer and perform no mapping-dependent issuance.
- **Prohibited assumptions:** remote user/account owner, provider session, email/user ID match, remote token possession, or Supabase identity establishes local subject or issuer authority.
- **Required approval evidence:** mapping subject/issuer semantics, external evidence class, exact scope, revocation/review rule, and proposal version.

## 18. Implementation-gate approval

### K334B-D12 — Implementation-gate approval

- **Exact question:** What explicit evidence authorizes K-334 production implementation to begin?
- **Current status / proposed owner disposition:** `OWNER_APPROVAL_PENDING`.
- **Existing source facts:** K-333F identifies an explicit owner approval record as required before code; merged documentation, CI, and review do not authorize implementation.
- **Invariants:** approval is explicit, decision/version scoped, and cannot collapse neutral K-334C analysis, policy finalization, schema implementation, repository/transaction implementation, runtime integration, admission evaluation, eligibility authorization, and activation into one vague grant.
- **Option set:** **A** explicit owner approval referencing exact proposal and decisions; **B** merge or review PASS suffices; **C** CI success or implementation feasibility suffices.
- **Recommended option:** **A** (`RECOMMENDED_POLICY`, HIGH). B and C are rejected.
- **Recommendation rationale / rejected options:** A gives reviewable scope and preserves staged safety gates. B/C are evidence of code review, not policy authority.
- **Persistence consequence:** creates no runtime record and selects no database/version/store.
- **Planning effect:** `REQUIRED_ONLY_BEFORE_PRODUCTION_IMPLEMENTATION`; neutral documentation and option analysis remain allowed. Policy-dependent K-334C finalization separately requires the applicable decision approval.
- **Issuance effect:** `BLOCKS_ALL_PRODUCTION_ISSUANCE`.
- **Implementation effect:** `BLOCKS_ALL_PRODUCTION_IMPLEMENTATION`.
- **Safe unresolved behavior:** documentation-only scope; no policy-dependent finalization, schema/repository/runtime implementation, admission enablement, eligibility declaration, or activation.
- **Prohibited assumptions:** runtime integration implies eligibility; passing admission checks implies owner-approved eligibility; eligibility implies activation; staging, CI, merge, a valid codec, this prompt, or a feasibility assessment authorizes any later stage.
- **Required approval evidence:** stages are separately gated: (1) neutral K-334C analysis, (2) policy-dependent K-334C finalization, (3) schema/migration implementation, (4) repository/transaction implementation, (5) runtime integration, (6) admission evaluation enablement, (7) eligibility authorization, and (8) production activation. Eligibility approval must state the exact eligibility contract/version, source class or identity, environment, permitted actions, any supplied expiration/review condition, and that activation is not approved. Neutral K-334C source-fact/option analysis requires no approval.

Admission evaluation determines whether evidence satisfies a contract; it does not make a source eligible. Eligibility authorization is an explicit owner-approved gate for an exact source class or source under an exact contract and scope; it does not activate runtime behavior. Activation authorization is a later explicit gate for actual production use. This proposal creates none of these runtime records or APIs.

## 19. Cross-decision consistency matrix

| Decision | Depends on | Constrains | Contradiction risk |
|---|---|---|---|
| D01 issuer | D09 supported tuple where issuer evidence is versioned | all accepted writes | external identity or bytes treated as issuer |
| D02 rollback | D01 issuer; D05 complete lineage | rollback acceptance | rollback becomes ordinary succession |
| D03 termination | D05 exact generation subject | lifecycle terminal state | runtime disappearance becomes termination |
| D04 inheritance | D03 termination; D05 topology | lifecycle-state persistence, successor state, carry-forward semantics | continuity becomes inherited authority or lifecycle state |
| D05 topology | D09 supported tuple | D03/D04/D07/D08 lineage and head rules | storage order becomes authority |
| D06 retention | D05 history | export/provenance, D07 fork evidence, D10 invalidation, future restore/import analysis | current head or export permits deletion or authority |
| D07 fork | D05 topology; D06 retention | forked-subject issuance | branch winner inferred automatically |
| D08 concurrent conflict | D05 topology | predecessor/successor acceptance | transaction order becomes policy authority |
| D09 compatibility | D01/D02 and accepted writes | all versioned acceptance | decodability becomes compatibility |
| D10 invalidation | D06 retention; D09 compatibility | later policy effects | history silently rewrites |
| D11 external mapping | D01 issuer | mapping-dependent issuance | external identity becomes local authority |
| D12 implementation gate | all decisions' approved scope | policy finalization, schema, repository, runtime, admission, eligibility, activation | one vague approval bypasses stages |

There is no digest, schema, or construction-order cycle in this proposal. The listed dependencies are policy dependencies only.

## 20. K-334C prerequisite matrix

| ID | K-334C classification | Scope affected | Prohibited while pending | Minimum approval evidence |
|---|---|---|---|---|
| D01 | `REQUIRED_BEFORE_K334C_POLICY_SCHEMA_FINALIZATION` | issuer-reference, accepted-write, admission semantics | no accepted-write/issuer contract | issuer model and exact scope |
| D02 | `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` | rollback-specific path | no rollback acceptance | rollback authority rule |
| D03 | `CONDITIONALLY_REQUIRED_FOR_K334C` | terminal generation state/keys | no terminal lifecycle schema | termination trigger/scope |
| D04 | `CONDITIONALLY_REQUIRED_FOR_K334C` | carry-forward/link and lifecycle-state records | no cross-generation or lifecycle-state transfer semantics | each dimension, source/target binding, no-transfer scope |
| D05 | `REQUIRED_BEFORE_K334C_POLICY_SCHEMA_FINALIZATION` | lineage keys, uniqueness, head/fork representation | no authoritative history schema | topology and fork rule |
| D06 | `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` | append-only preservation and future export/provenance analysis | no deletion, compaction, TTL, archival, current-head-only export, import authority, or export format | retention, lineage export, provenance, and non-authority policy |
| D07 | `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` | conflict preservation only | no winner/head/issuance for forked subject | fork resolution rule |
| D08 | `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` | conflict preservation only | no contender acceptance or winner | conflict acceptance rule |
| D09 | `REQUIRED_BEFORE_K334C_POLICY_SCHEMA_FINALIZATION` | tuple/index/admission rules | no compatibility enforcement | allowed tuple matrix |
| D10 | `DEFERRABLE_DURING_NEUTRAL_K334C_ANALYSIS` | invalidation behavior | no retrospective effect | invalidation scope/effect |
| D11 | `CONDITIONALLY_REQUIRED_FOR_K334C` | external mapping schema/integration | no mapping-dependent issuance | mapping semantics/scope |
| D12 | `REQUIRED_ONLY_BEFORE_PRODUCTION_IMPLEMENTATION` | policy finalization, schema, repository, runtime, admission, eligibility, activation | no implementation, admission enablement, eligibility declaration, or activation | separately scoped stage approval; eligibility and activation are distinct |

## 21. Deferred-decision rules

`OWNER_APPROVAL_PENDING` and `DEFERRED_BY_OWNER` are unresolved, not approval. Deferral permits only the neutral scope named in the prerequisite matrix. It never permits accepted issuance that is blocked by the decision, winner selection, external authority inference, compaction/deletion, policy-dependent schema finalization, or production implementation.

## 22. Owner review worksheet

| Decision ID | Decision Version | Question | Recommended Option ID | Alternative Option IDs | Recommendation consequence | Owner Response | Approval Scope | Evidence Reference |
|---|---|---|---|---|---|---|---|---|
| K334B-D01 | K334B-D01-v1 | Who may issue? | K334B-D01-A | K334B-D01-B, K334B-D01-C | explicit scoped issuer policy | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D02 | K334B-D02-v1 | Who may rollback? | K334B-D02-A | K334B-D02-B, K334B-D02-C | distinct rollback authority | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D03 | K334B-D03-v1 | What terminates a generation? | K334B-D03-A | K334B-D03-B, K334B-D03-C | explicit durable termination | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D04 | K334B-D04-v2 | What may inherit, including lifecycle state? | K334B-D04-A | K334B-D04-B, K334B-D04-C | no automatic transfer of any dimension | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D05 | K334B-D05-v1 | What topology is authoritative? | K334B-D05-A | K334B-D05-B, K334B-D05-C | linear exact-subject history | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D06 | K334B-D06-v2 | What is retained and exported? | K334B-D06-A | K334B-D06-B, K334B-D06-C | append-only evidence with non-authoritative exports | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D07 | K334B-D07-v1 | Can forks resolve? | K334B-D07-A | K334B-D07-B, K334B-D07-C | quarantined fork | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D08 | K334B-D08-v1 | How do contenders resolve? | K334B-D08-B | K334B-D08-A, K334B-D08-C | preserve conflict pending policy | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D09 | K334B-D09-v1 | Which tuples are compatible? | K334B-D09-A | K334B-D09-B, K334B-D09-C | explicit allowlist | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D10 | K334B-D10-v1 | Can history be invalidated? | K334B-D10-A | K334B-D10-B, K334B-D10-C | prospective-only default | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D11 | K334B-D11-v1 | How do external identities map? | K334B-D11-A | K334B-D11-B, K334B-D11-C | explicit mapping only | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |
| K334B-D12 | K334B-D12-v2 | What separately gates implementation through activation? | K334B-D12-A | K334B-D12-B, K334B-D12-C | staged explicit owner evidence | `OWNER_RESPONSE_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` |

Allowed owner responses are `APPROVE_RECOMMENDATION`,
`APPROVE_ALTERNATIVE:<exact-option-id>`, `REJECT_AND_REVISE`, `DEFER`, and
`NEED_MORE_EVIDENCE`. Every response, scope, and evidence reference is initially
pending. For D12, the response must separately scope policy finalization,
schema, repository, runtime integration, admission evaluation, eligibility, and
activation; no one boolean covers them all.

## 23. Approval-evidence register

The following is the only operative register shape for this proposal revision.
Each row is intentionally pending. A later evidence record may change a row's
publication status to `PUBLISHED_FOR_OWNER_REVIEW` only after it names an exact
immutable published proposal commit; it must never infer an owner disposition.

| Decision ID | Decision Version | Proposal Document | Published Proposal Commit | Publication Status | Owner Disposition | Selected Option | Approval Statement | Evidence Reference | Effective Scope | Timestamp | Supersedes | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| K334B-D01 | K334B-D01-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D02 | K334B-D02-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D03 | K334B-D03-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D04 | K334B-D04-v2 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D05 | K334B-D05-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D06 | K334B-D06-v2 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D07 | K334B-D07-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D08 | K334B-D08-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D09 | K334B-D09-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D10 | K334B-D10-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D11 | K334B-D11-v1 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |
| K334B-D12 | K334B-D12-v2 | K334B-PROPOSAL-r2 | `NONE_UNPUBLISHED` | `DRAFT_NOT_PUBLISHED` | `OWNER_APPROVAL_PENDING` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `UNPUBLISHED_APPROVAL_EVIDENCE_NOT_ALLOWED` | `NONE_PENDING_OWNER_RESPONSE` | `NONE_PENDING_OWNER_RESPONSE` | `NONE` | `NONE` |

### Superseded pre-B1 empty-row rendering (not an approval register)

The following historical empty-row layout is preserved only to make the B1
correction auditable. It is not an authority record, is not usable for owner
review, and must not be populated. The operative register is above.

| Decision ID | Proposal version | Proposal commit | Owner disposition | Selected option | Approval statement | Evidence reference | Effective scope | Timestamp | Supersedes | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| K334B-D01 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D02 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D03 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D04 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D05 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D06 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D07 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D08 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D09 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D10 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D11 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |
| K334B-D12 | v1 | pending publication | `OWNER_APPROVAL_PENDING` | — | — | — | — | — | — | — |

## 24. Rejection and revision procedure

Later approval must quote or unambiguously reference the decision ID, selected option, and proposal version/commit. Ambiguous “looks good” language is insufficient without explicit scope. Partial approvals remain partial; deferred decisions remain unresolved. A revised proposal preserves old evidence and rejection history but requires new approval for changed semantics. Conflicting owner statements require explicit supersession. Evidence must never be silently edited into prior history. This is a documentation procedure, not a runtime signature protocol.

## 25. Production integration blockers

### B1 approval and revision procedure

An approval statement must identify the Absinthe Protocol Owner, exact decision
ID and immutable decision version, exact selected option, the exact published
proposal commit, effective scope, explicit exclusions, and timestamp or an
explicit timestamp absence. It must say whether approval is one-time or
continuing; it must not invent permanence. For D12, it must name each approved
stage separately. Ambiguous language such as "looks good" is insufficient.

No evidence row is rewritten in place. A semantic proposal revision preserves
the earlier evidence as immutable history, creates its next monotonic decision
version, and requires new owner evidence. A non-semantic correction references
the affected document revision without changing the decision version. Conflicts
require explicit supersession; partial and batch approvals remain bounded by
their enumerated decision/version/scope triples. The superseded pre-B1 empty
row layout above grants no approval and cannot be populated.

`PUBLISHED_FOR_OWNER_REVIEW` is a publication state, not a disposition. It is
permitted only when an external immutable Git commit is recorded. A PR body may
record that commit after push, but neither a commit, merge, CI, review, nor task
request is owner approval. This documentation procedure does not create a
runtime signature protocol, persistence record, or API.

All twelve decisions remain pending: 12 pending, 0 approved, 0 rejected, 0
deferred by owner, 12 owner responses pending, 0 eligibility approvals, and 0
activation approvals. K-334C policy-dependent finalization is not authorized.
K-334C may conduct neutral source-fact and option analysis only where section
20 allows it; it may not create database versions, stores, indexes, migrations,
repositories, production transactions, runtime callers, admission evaluation,
eligibility declarations, or activation.

## 26. Recommended next action

The Absinthe Protocol Owner should provide an explicit, version-scoped response for each `K334B-D01` through `K334B-D12` using the worksheet. A later task may record supplied evidence without rewriting this proposal. No K-334C policy-dependent finalization or production implementation follows automatically.

## 27. Validation evidence

Before publication, run the focused K-329/K-330/K-332/K-333 and K-328/K-325/recovery suites, typecheck, build, and `git diff --check`. The known K-333 mutation-anchor result is `ENVIRONMENT_SENSITIVE_NON_BLOCKING` only if the source and test blobs match `main`, the failure remains the line-ending-sensitive anchor, and this document does not affect it.

## 28. Final invariant

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
