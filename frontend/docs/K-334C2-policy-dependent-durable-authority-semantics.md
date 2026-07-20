# K-334C2 - Policy-Dependent Durable Authority Semantics

## 1. Executive Verdict

K334C2_OWNER_DECISION_PACKAGE_READY

This is an owner-review package for the three category-B questions left open by
the merged K-334C analysis. It proposes exact policy options and recommends a
safe option for each question. No recommendation is approved by this document:
every owner response is OWNER_RESPONSE_PENDING.

## 2. Authorization Boundary

This task is authorized only to prepare policy-finalization documentation for
K334C-OQ-03 through K334C-OQ-05. It does not authorize schema or migration
design, database-version selection, stores, indexes, repositories,
transactions, runtime integration, admission, source eligibility, activation,
or a production change. This package creates neither a publication record nor
owner-disposition evidence.

## 3. Authoritative Inputs

| Input | Binding role |
|---|---|
| [K-334A audit](K-334A-durable-protocol-repository-atomicity-audit.md) | Source-fact and atomicity baseline. |
| [K-334B proposal](K-334B-owner-decision-proposal-and-approval-evidence.md) | Approved policy proposal identities. |
| [K334B-PUB-001](K-334B-publication-record-K334B-PUB-001.md) | Publication identity. |
| [K334B-OWNER-EVIDENCE-001](K-334B-owner-disposition-evidence-001.md) | The twelve approved K-334B dispositions. |
| [K-334C analysis](K-334C-neutral-durable-authority-architecture-analysis.md) | Merged neutral analysis, OQ-03 through OQ-05, and INV-001 through INV-018. |
| 3da6cde7d83abb4ac358839730d864f46789a892 | K-334C merge commit. |

The merged evidence selects K334B-D01-A through D12-A except D08-B. In
particular, D01 requires explicit scoped issuer policy; D02 requires distinct
rollback authority; D03 requires explicit durable termination; D04 prohibits
automatic generation inheritance; D05 requires linear accepted history; D06
preserves evidence append-only; D07 permanently quarantines accepted forks;
D09 requires an explicit compatibility allowlist; D10 prohibits silent
retrospective invalidation; D11 requires explicit external mappings; and D12
keeps later stages separately authorized.

Source-grounded boundary facts remain unchanged. frontend/src/lib/noteIndexedDb.ts
uses NOTES_IDB_NAME, openNotesDb, and saveNotesToIndexedDb for the legacy Notes
IndexedDB path; frontend/src/lib/notePersistence.ts can use the separate
notes-v2 localStorage fallback. Separate IndexedDB databases and localStorage
cannot share a native transaction. K-329 owns ReviewedWriterManifest and its
content digest; K-333 owns canonical codecs, preimages, strict decoding, and
proof semantics. Those facts constrain future work but provide no durable
K-334 authority repository and no production eligibility behavior.

The source references for those statements are
frontend/src/lib/localDatabase/writerCoordinationEligibility.ts:
ReviewedWriterManifest, encodeReviewedWriterManifestCanonical,
decodeReviewedWriterManifestCanonical, and deriveReviewedWriterManifestDigest;
frontend/src/lib/localDatabase/protocol/canonicalProtocolPreimage.ts;
frontend/src/lib/localDatabase/protocol/strictProtocolDecode.ts: decodeExactObject;
and frontend/src/lib/localDatabase/protocol/writerAuthorityProtocol.ts:
decodeWriterIdentityRecord, decodeWriterSessionRecord, and
decodeSourceAuthorityRecord. They are protocol/value ownership and validation
boundaries, not a K-334 durable authority repository or a production
eligibility evaluator.

ID uniqueness check: repository searches for K334C2-D01-v1, K334C2-D02-v1,
K334C2-D03-v1, and every option ID below found no prior definition. These IDs
therefore do not reuse K334B-D01 through K334B-D12.

## 4. Category-B Question Inventory

| Decision | Version | K-334C question | Exact question |
|---|---|---|---|
| K334C2-D01 | v1 | K334C-OQ-03 | What are the grant, revocation, expiry, and supersession semantics for authority? |
| K334C2-D02 | v1 | K334C-OQ-04 | What exact dimensions and matching syntax define the D09 compatibility allowlist? |
| K334C2-D03 | v1 | K334C-OQ-05 | What, if any, accepted-fork remediation exists without replacing D07 silently? |

No fourth owner-policy question is introduced. Lifecycle, applicability, and
evidence consequences below are dependent sub-questions required to make the
three listed questions unambiguous; they do not authorize schema or
implementation.

## 5. Existing Approved Constraints

All decisions are constrained by K334C-INV-001 through K334C-INV-018. The
material constraints are: exact accepted lineage has no automatic fork winner;
issuer and rollback authority are independently explicit; termination is
durable and explicit; no generation inherits authority, compatibility, mapping,
or history; authority and provenance are append-only; unknown compatibility
fails closed; external account/session/token state is not authority; later
policy does not silently invalidate accepted evidence; and policy approval is
not implementation, admission, eligibility, or activation authority.

Until a later owner record selects a K-334C2 option, missing, ambiguous, or
conflicting evidence fails closed while retained evidence remains available for
audit. Neither a digest, decoder success, runtime value, session, account,
browser closure, timeout, nor token expiry supplies missing authority.

## 6. Decision K334C2-D01 - Authority Lifecycle

**Question.** Define immutable grant, ending, revocation, expiry, and
supersession semantics consistent with K334B-D01, D02, D03, D04, D10, and D11
and K334C-INV-005, -006, -007, -008, -010, -011, and -015.

**Fixed constraints.** A grant is exact-subject, exact-action, and
provenance-bound evidence. Issuer and rollback grants are distinct; ordinary
issuer authority never supplies rollback. A terminated generation, session
loss, account change, or successor generation does not infer revocation.
External identity mappings remain separate explicit evidence and do not
silently carry a grant to another subject or generation.

### Options

| Option | Policy |
|---|---|
| K334C2-D01-A | **Explicit append-only lifecycle events.** Immutable grants end only through exact, authorized, append-only revoke, supersede, or explicit applicability-termination evidence. No automatic expiry. |
| K334C2-D01-B | Explicit immutable grants with a bounded validity interval. Expiry is prospective but needs a trusted protocol-time rule, a durable time-evidence rule, and fail-closed treatment of missing or ambiguous time. |
| K334C2-D01-C | Mutable effective-grant state, updated or replaced in place. |

### Recommendation

Recommend K334C2-D01-A.

Every grant and lifecycle event is immutable and append-only. A later event
identifies the exact prior grant by stable grant identity plus the exact
subject, action, and prior-evidence digest; it does not overwrite the grant.
Revoke, supersede, and explicitly authorized applicability termination end
future applicability only. A superseding grant does not replace historical
evidence: it ends applicability of the identified prior grant and supplies a
separate successor grant where needed. Historical events accepted under then
valid evidence remain historically accepted; no event silently reclassifies or
deletes them.

There is no clock-based or inferred expiry in v1. An expiry policy would be a
future versioned owner decision, must state exact trusted protocol-time
evidence, and must fail closed where that evidence is unavailable or ambiguous.
Generation termination does not itself revoke a grant, and grants cannot
transfer to a successor generation automatically. A later explicit grant is
required for every exact successor scope.

Duplicate lifecycle records are exact idempotent replays only when their
canonical immutable identity and payload match. Conflicting, duplicate-key, or
incompatible lifecycle evidence is preserved and blocks new applicability for
the affected exact scope; it never selects a latest row or inferred winner.
Issuer applicability additionally requires every referenced external mapping to
be explicit, valid for the same exact scope, and non-conflicting. Ambiguous or
missing mappings fail closed.

**Trade-offs.** Option A provides deterministic replay, auditability, minimum
trusted-clock dependence, restore safety, and generation isolation. It grows
storage and requires owner review of explicit lifecycle events. Option B can
bound stale authority but introduces CRITICAL clock/time-evidence ambiguity and
recovery burden. Option C simplifies a current-state lookup but is HIGH risk:
it loses audit history, obscures crash/replay behavior, and conflicts with D06,
D10, and INV-011.

**Unresolved default before approval.** Preserve immutable grant evidence;
infer no revocation, expiry, or supersession; reject missing/conflicting
lifecycle evidence prospectively; apply no retrospective effect.

**Approval effect.** A future explicit owner approval would select lifecycle
semantics only. **It does not authorize** a record schema, store, index,
repository, transaction, runtime caller, admission, eligibility, activation,
or a grant issuance.

**Owner response.** OWNER_RESPONSE_PENDING; accepted form is one of the forms
in section 13.

## 7. Decision K334C2-D02 - Compatibility Semantics

**Question.** Define the exact D09 allowlist dimensions, matching behavior,
and supersession semantics. Successful decoding and matching major versions are
not compatibility.

**Fixed constraints.** Compatibility evidence is explicit and owner-reviewed;
unknown combinations fail closed; no wildcard silently broadens authority; no
later rule silently rewrites historical accepted evidence. K-329 manifest
content remains reviewed-manifest evidence, while K-333 retains canonical
codec/preimage/proof ownership. This policy may reference those exact evidence
identities but cannot redefine their bytes, codecs, proof meaning, or selection.

### Options

| Option | Policy |
|---|---|
| K334C2-D02-A | Exact immutable tuples: every participating dimension is named; no ranges, sets, or wildcards. |
| K334C2-D02-B | Exact immutable tuples plus closed, explicitly enumerated value sets for a named dimension; no open range, major-version inference, or wildcard. |
| K334C2-D02-C | Bounded semantic ranges with separately defined grammar, inclusivity, prerelease behavior, feature interaction, and history semantics. |
| K334C2-D02-D | Decoder or current runtime support implies compatibility. |

### Recommendation

Recommend K334C2-D02-B, with the following v1 policy contract. Each
compatibility entry is immutable, has an exact policy/evidence version binding,
and applies prospectively. It contains an exact tuple with only a closed
enumerated set where expressly allowed below. An omitted required dimension is
invalid, never any; an omitted non-applicable dimension is the canonical
not-applicable value, not an implicit wildcard.

| Dimension | v1 status and matching |
|---|---|
| Manifest version | Required; exact-match only; bound to the exact reviewed K-329 manifest digest. |
| Protocol version | Required; exact-match only. |
| Codec version | Required; exact-match only and bound to the K-333 canonical decoder/codec identity. |
| Writer type | Required; exact-match or a closed explicitly enumerated set. |
| Source type | Required; exact-match or a closed explicitly enumerated set. |
| Feature set | Required; exact canonical set equality, or a closed enumerated set of exact canonical feature sets. Unknown flag fails closed. |
| Evidence schema version | Required when that evidence participates; otherwise canonical not-applicable. Exact-match only. |
| Namespace scope | Prohibited as a broadening wildcard; an entry may bind one exact namespace only when a later policy scope expressly requires it. |
| Generation scope | Prohibited as a broadening wildcard; an entry may bind one exact generation only when expressly required. |

Ranges and wildcards are prohibited in v1. A successful decode, same major
version, current runtime support, or an opaque digest alone cannot satisfy a
tuple. Mixed partial matches are retained as rejected/inapplicable evidence,
not normalized into a compatible combination. Each entry binds the policy
version and exact immutable evidence identities that justify it.

A later compatibility entry may supersede future applicability only by naming
the exact prior entry and scope. It cannot invalidate historical accepted
events silently. It is not global by default: applicability is exact tuple plus
the optional exact namespace/generation binding above, and never an inferred
cross-generation permission. The entry as a whole, not a partial dimension,
is independently superseded; a partial change requires a new full immutable
tuple bound to its own policy/evidence version.

**Trade-offs.** Option B keeps exact replay, auditability, migration clarity,
and a bounded operational escape hatch for deliberately enumerated variants.
It imposes HIGH owner and storage-review burden as combinations grow. Option A
is simpler and most restrictive but can require needless policy churn. Option C
has HIGH ambiguity around syntax, prereleases, and feature interaction. Option
D is CRITICAL and rejected because runtime/decoder behavior could broaden
authority without owner evidence.

**Unresolved default before approval.** Every unknown, omitted-required, or
unlisted combination fails closed; decode success does not imply compatibility;
no production combination is approved.

**Approval effect.** A future explicit approval would choose policy matching
semantics only. **It does not authorize** compatibility data, a manifest
resolver, codec changes, schema, storage, transactions, runtime evaluation,
admission, eligibility, or activation.

**Owner response.** OWNER_RESPONSE_PENDING; accepted form is one of the forms
in section 13.

## 8. Decision K334C2-D03 - Accepted-Fork Remediation

**Question.** Define whether a remedy may exist for an already accepted-history
fork without silently replacing K334B-D07-v1.

**Fixed constraint.** D07-v1 currently means permanent exact-subject
fail-closed quarantine: preserve every branch, choose no automatic winner,
maintain no authoritative head, and block state-changing issuance only for the
affected subject. Unrelated subjects remain unaffected.

### Options

| Option | Policy |
|---|---|
| K334C2-D03-A | Reaffirm D07 permanent quarantine for v1. No accepted-fork remediation exists. |
| K334C2-D03-B | A future, separately approved manual owner-authorized remedy may enumerate every branch, retain all evidence, and establish only prospective continuation. |
| K334C2-D03-C | Automatic deterministic winner selected by time, digest, arrival, transaction order, majority, or last-write-wins. |
| K334C2-D03-D | Global reset or generation replacement bypasses a fork. |

### Recommendation

Recommend K334C2-D03-A: reaffirm permanent quarantine in v1. It is the only
option consistent with existing D07 without a new decision version and explicit
supersession. There is no manual remedy, branch selection, synthetic successor,
restored authoritative head, or renewed state-changing issuance for a forked
subject in v1. All branch evidence remains visible. The prohibition is
exact-subject scoped and does not cross a generation boundary or affect
unrelated subjects.

Option B is not selected or authorized by this package. It is a future-policy
possibility only and would require: a new D07 decision version explicitly
superseding D07-v1; a new publication and owner-evidence record; an exact
affected subject; full branch enumeration; preserved evidence; an explicit
prospective consequence; a separately authorized implementation; and, if it
ever allowed renewed issuance, a second explicit unquarantine event. A failed
or conflicting future remedy must retain the attempt and preserve quarantine.
It may not transfer authority across generations automatically or rewrite prior
accepted status.

Options C and D are prohibited under current policy. Automatic selection
launders a fork into an inferred head. Generation replacement cannot bypass D04,
D05, D06, D07, D10, or D11 and is not remediation without explicit policy for
every identity, authority, and evidence transition.

**Trade-offs.** Option A has HIGH permanent-lockout and manual-recovery burden,
but minimizes unauthorized history rewriting, branch loss, replay ambiguity,
and fork laundering. Option B has HIGH owner and recovery burden even with
future safeguards. Options C and D are CRITICAL for unauthorized authority
selection, evidence laundering, and data-loss risk.

**Unresolved default before approval.** Permanent affected-subject quarantine,
no winner, no authoritative head, no remediation, and preserved branches remain
in force.

**Approval effect.** A future approval of Option A would only reaffirm the v1
policy boundary. **It does not authorize** any remedy, unquarantine event,
schema, repository, transaction, runtime behavior, admission, eligibility, or
activation. An Option B future proposal needs its own new D07 version and
evidence before implementation can even be considered.

**Owner response.** OWNER_RESPONSE_PENDING; accepted form is one of the forms
in section 13.

## 9. Cross-Decision Dependencies

Owner review must occur in this order: (1) K334C2-D01 authority lifecycle, (2)
K334C2-D02 compatibility, then (3) K334C2-D03 accepted-fork remediation.

1. D01 determines which exact future authority may approve or supersede
   compatibility/remediation evidence, distinguishes rollback authority, and
   fixes prospective lifecycle effects.
2. D02 inherits D01 supersession constraints and can constrain which exact
   evidence is usable in a future remediation; it cannot infer authority from
   decoding or a manifest digest.
3. D03 cannot bypass D01 authority, D02 compatibility, D04 generation
   isolation, or D10 prospective-only history rules. A fork remedy cannot
   automatically carry authority to a successor generation.

There is no digest cycle: K-329/K-333 owned evidence remains an input to a
future decision, and a policy record may bind those identities without creating
or redefining their content/digests.

## 10. Security and Data-Loss Analysis

| Option family | Material risk | Rating | Mitigation and residual risk |
|---|---|---|---|
| D01-A | Stale immutable grant reuse; owner operational error; storage growth | MEDIUM | Exact subject/action/provenance, explicit prospective ending, and conflict quarantine limit reuse. Residual review/storage burden remains. |
| D01-B | Clock manipulation, ambiguous expiry, premature revocation, restore ambiguity | CRITICAL | No v1 recommendation; a future version needs trusted durable protocol-time evidence. |
| D01-C | Unauthorized mutable authority persistence, history reinterpretation, crash/replay ambiguity | HIGH | Rejected; mutation cannot provide append-only audit evidence. |
| D02-A/B | Compatibility-entry error, storage growth, permanent mismatch lockout | MEDIUM | Exact tuples/closed sets, explicit owner review, no wildcard, and prospective supersession. Residual operational burden remains. |
| D02-C | Range grammar, prerelease, feature-set, and replay ambiguity | HIGH | Rejected in v1; no range inference. |
| D02-D | Decoder/runtime-derived compatibility broadening and hidden authority escalation | CRITICAL | Prohibited; decode success is never compatibility. |
| D03-A | Permanent user lockout and recovery burden | HIGH | Exact-subject scope, all branch preservation, export/manual investigation, and no unrelated-subject impact. |
| D03-B | Manual branch-selection error, synthetic-successor laundering, restore/import ambiguity | HIGH | Not selected; future version needs exact enumeration and separate approval/evidence. |
| D03-C/D | Automatic winner, branch evidence loss, cross-generation laundering, retrospective rewrite | CRITICAL | Prohibited under D04-D07 and D10-D11. |

Across all choices, unauthorized persistence, premature ending, rollback
escalation, history reinterpretation, and import/replay ambiguity are contained
only by immutable exact evidence and fail-closed rejection. No numeric
probability is asserted.

## 11. Recovery and Migration Consequences

All recommendations preserve evidence rather than delete, compact, or silently
reinterpret it. Recovery/import/replay must preserve exact immutable identities
and then revalidate them; a backup, localStorage fallback, remote row, manifest,
or decoder cannot confer authority. A future migration must prove its complete
evidence set and cannot use separate IndexedDB/localStorage domains as though
they were one atomic commit. D01-A avoids a trusted-clock recovery dependency;
D02-B avoids range reinterpretation; D03-A avoids a recovery procedure that
could select or launder a forked head. Storage growth and explicit owner review
are accepted burdens, not permission for evidence loss.

## 12. Policy-Version and Supersession Contract

This is a documentation-level contract for a later owner disposition. Each
approved K-334C2 decision must bind all of the following: decision ID; decision
version; selected option ID; exact package commit; publication record ID; owner
evidence ID; approving authority; exact owner statement; timestamp; exact
scope; superseded decision/version if any; prospective-effect boundary; and an
explicit non-authorization boundary.

Supersession is append-only and identifies the exact prior decision/version.
It changes future applicability only, retains historic policy/evidence, and
cannot silently make a new decision applicable to historical accepted events.
Malformed, duplicate-conflicting, missing, or unbound approval evidence is not
an approval. This task creates no publication or owner-evidence record.

## 13. Owner Decision Worksheet

| Decision | Recommended option | Response (pending) | Exact allowed response |
|---|---|---|---|
| K334C2-D01-v1 | K334C2-D01-A | OWNER_RESPONSE_PENDING | APPROVE_RECOMMENDATION; APPROVE_ALTERNATIVE:K334C2-D01-B; APPROVE_ALTERNATIVE:K334C2-D01-C; REJECT_AND_REVISE; DEFER; NEED_MORE_EVIDENCE:<specific-question> |
| K334C2-D02-v1 | K334C2-D02-B | OWNER_RESPONSE_PENDING | APPROVE_RECOMMENDATION; APPROVE_ALTERNATIVE:K334C2-D02-A; APPROVE_ALTERNATIVE:K334C2-D02-C; APPROVE_ALTERNATIVE:K334C2-D02-D; REJECT_AND_REVISE; DEFER; NEED_MORE_EVIDENCE:<specific-question> |
| K334C2-D03-v1 | K334C2-D03-A | OWNER_RESPONSE_PENDING | APPROVE_RECOMMENDATION; APPROVE_ALTERNATIVE:K334C2-D03-B; APPROVE_ALTERNATIVE:K334C2-D03-C; APPROVE_ALTERNATIVE:K334C2-D03-D; REJECT_AND_REVISE; DEFER; NEED_MORE_EVIDENCE:<specific-question> |

Only the exact forms listed above are accepted. “Approve all,” “looks good,”
“proceed,” “merge,” and “use the best option” are ambiguous and have no policy
effect. Every later response must use the contract in section 12. No owner
approval is inferred from the existence, review, merge, CI result, or use of
this worksheet.

## 14. Current Authorization State

| Stage | State |
|---|---|
| K-334C2 package preparation | Complete. |
| Owner decisions | Pending explicit individual responses. |
| Schema/migration | Not authorized. |
| Repository/transaction | Not authorized. |
| Runtime | Not authorized. |
| Admission | Not authorized. |
| Eligibility | Not authorized. |
| Activation | Not authorized. |

## 15. Required Next Action

Obtain an explicit Protocol Owner response for each separately enumerated
decision in section 13. If the owner selects an alternative or requests more
evidence, revise only the affected policy package. Do not create a publication
record, owner evidence, schema, or implementation before a valid response and
separate stage authorization exist.

## 16. Production Boundary

This document changes no production source, schema, persistence, transaction,
runtime caller, admission evaluator, eligibility state, activation behavior,
network behavior, recovery mode, or legacy Notes behavior. Approval of future
K-334C2 decisions would establish policy semantics only; it would not
automatically authorize database design/version changes, stores/indexes,
migrations, repositories, transactions, runtime integration, admission,
eligibility, or activation. K-334C3 and every later stage require separate
authorization.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
