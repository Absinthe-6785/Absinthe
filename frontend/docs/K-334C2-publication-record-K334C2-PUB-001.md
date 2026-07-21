# K-334C2 Publication Record - K334C2-PUB-001

## 1. Record Identity

| Field | Value |
|---|---|
| Record type | K334C2ProposalPublicationRecord |
| Publication record ID | K334C2-PUB-001 |
| Proposal title | K-334C2 - Policy-Dependent Durable Authority Semantics |
| Repository | Absinthe-6785/Absinthe |
| Package version | K-334C2A-reviewed-publication-1 |
| Publication status | PUBLISHED_FOR_OWNER_REVIEW |
| Prior proposal state | DRAFT_NOT_PUBLISHED |
| Publication transition | DRAFT_NOT_PUBLISHED -> PUBLISHED_FOR_OWNER_REVIEW |
| Published at | 2026-07-20T23:54:18.3368297Z |
| Supersedes publication record | NONE |

The publication ID and package version were checked for uniqueness in repository
files, branches, pull requests, issues, issue comments, pull-request comments,
and GitHub code search before this record was created.

## 2. Publication Authority

**Publication recorder:** Absinthe-6785
**Recording authority:** Authorized Proposal Publication Recorder
**Policy approval authority:** Absinthe Protocol Owner

The publication recorder may verify and bind the exact reviewed proposal and
record its transition to PUBLISHED_FOR_OWNER_REVIEW. The recorder may not choose
an option, alter an owner response, create owner-policy evidence, or authorize
implementation.

Only the Absinthe Protocol Owner may later provide a separate explicit
disposition for each exact decision/version. Publication, PR approval, PR merge,
and CI success are not policy approval.

## 3. Published Proposal Binding

| Field | Exact binding |
|---|---|
| Proposal path | frontend/docs/K-334C2-policy-dependent-durable-authority-semantics.md |
| Published proposal commit | e1e75037308a72f057bc4dbda8f6b845674866eb |
| Published proposal Git blob SHA | 743f1b71a03cefc0f6a8fe2c4b450242901d5a52 |
| Proposal file SHA-256 | B8EF5B9969BAA5AD060A0957BEDB3E594350A0C0C4EF3BB2A97DAEBDB45F84AF |
| Proposal byte identity | Verified byte-identical to the path at the published proposal commit. |

This record binds the repository, path, exact proposal commit, exact Git blob,
package version, exact decision/version set, exact recommendation set,
publication ID, timestamp, recorder, and recording authority. A branch name, PR
number, latest commit, timestamp, or merge order alone is insufficient.

## 4. Decision and Recommendation Set

This publication is valid only for the complete exact set below. Partial
publication is invalid.

| Decision ID and version | Source question | Recommended option | Owner response |
|---|---|---|---|
| K334C2-D01-v1 | K334C-OQ-03 | K334C2-D01-A | OWNER_RESPONSE_PENDING |
| K334C2-D02-v1 | K334C-OQ-04 | K334C2-D02-B | OWNER_RESPONSE_PENDING |
| K334C2-D03-v1 | K334C-OQ-05 | K334C2-D03-A | OWNER_RESPONSE_PENDING |

The recommendation IDs are bound as proposal recommendations only; none is
approved. Adding/removing a decision or recommendation requires a new proposal
version, exact proposal commit, publication record, and explicit supersession.

## 5. Publication Transition

This exact proposal transitions from DRAFT_NOT_PUBLISHED to
PUBLISHED_FOR_OWNER_REVIEW. The transition establishes proposal identity,
integrity, complete decision-set availability, and owner-review availability
only. It does not establish an approval, rejection, deferral, selected option,
or effective policy semantics.

## 6. Owner Response State

- Published decisions for owner review: 3
- Owner responses pending: 3
- Selected options: 0
- Owner statements: 0
- Approving-authority responses: 0
- Owner-response timestamps: 0
- Owner-evidence references: 0
- Completed owner non-authorization acknowledgements: 0

The proposal worksheet is unchanged. No owner name, scope, statement, response,
option, timestamp, evidence reference, or acknowledgement is inferred by this
publication.

## 7. Owner Response Contract

Each decision requires a separate response in exactly one accepted form:

- APPROVE_RECOMMENDATION
- APPROVE_ALTERNATIVE:<exact-option-id>
- REJECT_AND_REVISE
- DEFER
- NEED_MORE_EVIDENCE:<specific-question>

Blanket approval, “approve all,” “looks good,” “proceed,” PR approval, PR merge,
and CI success are invalid as policy evidence. A selected option must be an
exact option ID. Scope, owner statement/reason, approving authority, timestamp,
and non-authorization acknowledgement must be explicit. No response may become
evidence until all required fields are complete and bound to this exact
publication record.

## 8. Future Owner-Evidence Binding

Any later owner-disposition evidence MUST bind: this record type and ID; exact
proposal path, commit, and blob SHA; package version; decision ID/version;
selected exact option ID; response type; scope; owner statement/reason;
approving authority; timestamp; non-authorization acknowledgement; applicable
superseded decision/version; evidence ID; evidence-record commit; and evidence
provenance.

Missing or mismatched bindings fail closed. A future evidence record may not
rely only on a PR comment, chat transcript, issue comment, branch name, latest
commit, merge status, or CI status.

## 9. Supersession Contract

This publication supersedes no prior K-334C2 publication. Later proposal changes
require a new publication record that explicitly identifies this one when it
supersedes it. Publication supersession is append-only; old publication records
and old proposal bytes remain historically referenceable. There is no
latest-publication-wins inference, and owner evidence bound to one publication
cannot silently apply to another. This record is not mutated in place after its
authoritative commit; correction or supersession requires a new record.

## 10. Current Fail-Closed Defaults

### Authority lifecycle

Immutable grant evidence remains; revocation, expiry, and supersession are not
inferred; missing/conflicting lifecycle evidence fails closed; issuer authority
does not imply rollback authority.

### Compatibility

No production compatibility tuple is approved. Unknown/unlisted combinations
fail closed. Decode success and runtime support are insufficient. No Cartesian
product, wildcard, or range inference is permitted.

### Accepted forks

Permanent exact-subject quarantine remains. Every branch is preserved; no
winner, authoritative head, remediation, or state-changing issuance exists for
the affected subject.

### External mappings

Mapping evidence must be explicit. Missing/conflicting mappings fail closed.
Mapping supersession neither revokes nor transfers grants, and account, session,
token, or provider possession does not establish authority.

## 11. Authorization Counts

| State | Count |
|---|---:|
| Owner responses pending | 3 |
| Approved recommendations | 0 |
| Approved alternatives | 0 |
| Rejected | 0 |
| Deferred | 0 |
| Evidence requests | 0 |
| Owner-evidence records | 0 |
| Schema/migration authorizations | 0 |
| Repository/transaction authorizations | 0 |
| Runtime authorizations | 0 |
| Admission authorizations | 0 |
| Eligibility authorizations | 0 |
| Activation authorizations | 0 |

## 12. Non-Authorization Boundary

Publication does not authorize schema design, database versions, stores, indexes,
migrations, repositories, transactions, runtime integration, admission,
eligibility, or activation. Even a later owner approval establishes policy
semantics only; every implementation stage still needs separate explicit
authorization.

## 13. Validation Evidence

- Proposal branch and origin head matched the published proposal commit.
- Proposal Git blob and working-tree blob matched:
  743f1b71a03cefc0f6a8fe2c4b450242901d5a52.
- The working proposal file was byte-identical to the published proposal path.
- Exact proposal-head CI passed: two test jobs, two typecheck jobs, two build
  jobs, two backend-recovery jobs, Vercel, and Preview Comments.
- Decision/recommendation bindings and three pending worksheet responses were
  verified.
- Approved count remained zero; no prior K-334C2 publication or owner-evidence
  record was found.
- K334C2-PUB-001 and K-334C2A-reviewed-publication-1 were unique before this
  record was created.

## 14. Final Publication Statement

The exact proposal package bound in section 3 is
PUBLISHED_FOR_OWNER_REVIEW. Every owner response remains
OWNER_RESPONSE_PENDING. This publication establishes no owner disposition and
no implementation authority.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
