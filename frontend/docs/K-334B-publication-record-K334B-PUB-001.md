# K-334B Publication Record — K334B-PUB-001

## Record

| Field | Value |
|---|---|
| `recordType` | `K334BProposalPublicationRecord` |
| `publicationRecordId` | `K334B-PUB-001` |
| `proposalDocument` | `frontend/docs/K-334B-owner-decision-proposal-and-approval-evidence.md` |
| `proposalPackage` | `K-334B — Owner-Decision Proposal and Explicit Approval Evidence` |
| `proposalPackageVersion` | `K-334B2-reviewed-publication-1` |
| `publishedProposalCommit` | `e9fa5a4cfb2e107919de04b014d2cdf871d8388e` |
| `includedDecisionVersions` | The exact twelve versions in [Included decision versions](#included-decision-versions). |
| `publicationStatus` | `PUBLISHED_FOR_OWNER_REVIEW` |
| `publishedAt` | `2026-07-20T14:24:38Z` |
| `recordedBy` | `Absinthe-6785` |
| `recordingAuthority` | `Authorized Proposal Publication Recorder` |
| `policyApprovalAuthority` | `Absinthe Protocol Owner` |
| `supersedesPublicationRecord` | `NONE` |
| `ownerDispositionSummary` | 12 pending; 0 approved; 0 rejected; 0 deferred; 12 owner responses pending; 0 eligibility approvals; 0 activation approvals. |
| `implementationAuthorization` | `NONE` |
| `notes` | Administrative publication evidence only. This record is immutable after publication except through a new superseding publication record. |

This is Artifact B in the K-334B two-artifact model. Artifact A remains the
immutable proposal document at the exact `publishedProposalCommit` above. This
later record does not replace or retarget that proposal commit, and it does not
contain its own publication-record commit SHA.

## Included decision versions

This record publishes exactly these decision versions from the proposal commit:

- `K334B-D01-v1`
- `K334B-D02-v1`
- `K334B-D03-v1`
- `K334B-D04-v2`
- `K334B-D05-v1`
- `K334B-D06-v2`
- `K334B-D07-v1`
- `K334B-D08-v1`
- `K334B-D09-v1`
- `K334B-D10-v1`
- `K334B-D11-v1`
- `K334B-D12-v2`

## Publication transition

For that exact immutable proposal commit and fixed decision-version set, this
record performs only this administrative transition:

```text
DRAFT_NOT_PUBLISHED
→ PUBLISHED_FOR_OWNER_REVIEW
```

The transition records that the proposal target is immutable, the proposal
commit is known, the decision-version set is fixed, explicit owner review may
begin, and later owner evidence may reference `K334B-PUB-001`.

It does not select a recommendation or alternative; approve or reject an
option; finalize K-334C policy; authorize schema, migration, repository,
transaction, runtime, admission, eligibility, or activation work; or otherwise
change an owner disposition. Publication is not approval.

## Authority boundary

### Authorized Proposal Publication Recorder

The `Authorized Proposal Publication Recorder` may record that this exact
immutable proposal package is available for owner review. That is
administrative publication authority only.

### Absinthe Protocol Owner

The `Absinthe Protocol Owner` is the only approving authority for policy
dispositions of `K334B-D01` through `K334B-D12`.

Publication-record creation, a Git commit, push, PR creation, PR merge, CI
success, review PASS, Draft-to-Ready transition, implementation feasibility,
and current source behavior are not owner approval.

## Owner disposition and approval boundary

Publication does not alter any owner disposition. All twelve decisions remain
`OWNER_APPROVAL_PENDING`: 12 pending, 0 approved, 0 rejected, 0 deferred, 12
owner responses pending, 0 eligibility approvals, and 0 activation approvals.

`K334B-PUB-001` publishes the complete package; it does not approve the package
as a whole. Owner dispositions remain decision-level. A batch owner response is
valid only if it individually enumerates every decision ID, version, selected
option, and scope. Approval of one decision does not approve another, and
policy approval does not approve implementation, eligibility, or activation.

Any later valid owner disposition must reference:

- `publicationRecordId`: `K334B-PUB-001`;
- `publishedProposalCommit`: `e9fa5a4cfb2e107919de04b014d2cdf871d8388e`;
- exact decision ID and exact decision version;
- exact selected option;
- exact approved or deferred scope;
- approving authority;
- approval statement;
- timestamp;
- evidence reference; and
- supersession reference where applicable.

Approval fails closed if the publication record is missing; the proposal commit
mismatches; the decision version is not included; the option does not belong to
that decision version; scope is ambiguous; approving authority is absent; the
statement merely says “looks good” or equivalent; or evidence treats
publication as approval.

## Supersession

A new publication record is required if any included decision receives a new
semantic version; any option, recommendation, policy consequence, approval
scope semantics, or K-334C prerequisite classification changes; or the proposal
commit changes semantically. A superseding record must use a new
`publicationRecordId`, name its new proposal commit and complete decision-version
set, explicitly supersede `K334B-PUB-001`, retain this record and prior owner
evidence historically, and never transfer approval automatically.

Non-semantic later changes do not silently retarget this record. Its approval
target remains `e9fa5a4cfb2e107919de04b014d2cdf871d8388e` unless a new explicit
publication record supersedes it.

## Proposal integrity and validation context

The proposal path exists in the published commit. Its blob is fixed at
`e6b6d9b361d50d1e7c370fbec3dcd040d6bd7903`; no later branch head is substituted
as the approval target. The publication-record commit is evidence that this
publication was recorded, not the policy proposal target.

GitHub Actions CI for the exact published proposal commit completed successfully.
The associated validation context is: K-329/K-330/K-332/K-333 269/269 passed;
K-328/K-325/recovery 307/307 passed; protocol bundle 236/237 with only the known
CRLF/LF mutation-anchor result, whose relevant source and test blobs match
`main`; typecheck passed; build passed; and `git diff --check` passed. CI success
confirms validation status only; it is not owner approval.

## Final invariant

`NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE`
