# K-334D3J - Main Integration Scope Resolution Proposal

## 1. Proposal Identity

| Field | Exact value |
| --- | --- |
| Proposal type | `K334DMainIntegrationScopeResolutionProposal` |
| Proposal ID | `K-334D3J-SCOPE-PROPOSAL-001` |
| Status | `DRAFT_NOT_AUTHORIZED` |
| Implementation merge | `c311efc0ed208a3d39734abb822c6fabbf7ff248` |
| Current `main` | `904c65af2742b514d08545c69e4fdc5c755562e9` |
| Previous integration authorization | `K-334D-MAIN-INTEGRATION-001` |

This is a scope-resolution proposal only. It does not authorize a promotion,
select an integration method, or change any branch.

## 2. Current State and Topology

K-334D3 implementation is merged into
`codex/k334d0-repository-codec-authorization-proposal` at `c311efc...`.
`main` remains at `904c65a...`.

```text
904c65a main
    |
    +-- authorization base history
            |
            +-- c311efc K-334D3 implementation merge
```

`main` is an ancestor of `c311efc...`; neither `c311efc...` nor the reviewed
implementation head `422930c...` is currently an ancestor of `main`.

The merge commit parents are:

- authorization-base parent: `dd56596414c0e0a0758c876ea97e47789e7546ce`
- reviewed implementation parent: `422930cd3a5322d6a786171d6f1ebc2bb5565528`

The actual promotion range is `904c65a..c311efc`: 12 commits and 9 files.
Commit topology, not only a file diff, determines promotion scope.

## 3. Actual File Range

The range contains these five preceding authorization documents:

- `frontend/docs/K-334D0-repository-codec-implementation-authorization-proposal.md`
- `frontend/docs/K-334D0-repository-codec-implementation-authorization-publication.md`
- `frontend/docs/K-334D0-repository-codec-implementation-authorization-owner-disposition.md`
- `frontend/docs/K-334D1-implementation-task-authorization-record.md`
- `frontend/docs/K-334D2-implementation-execution-task-record.md`

It also contains the four reviewed K-334D3 protocol files:

- `frontend/src/lib/localDatabase/protocol/canonicalProtocolPreimage.ts`
- `frontend/src/lib/localDatabase/protocol/k334CanonicalProtocol.ts`
- `frontend/src/lib/localDatabase/protocol/k334CanonicalRepository.ts`
- `frontend/src/lib/localDatabase/protocol/k334CanonicalProtocol.test.ts`

## 4. Integration Options

### Option A - Full History Promotion

Promote the exact linear range `main..c311efc`.

Benefits:

- preserves the reviewed authorization and implementation history;
- retains natural ancestry and existing commit identities;
- requires no rewritten graph or cherry-picks.

Risks:

- expands main integration beyond the four-file K-334D3-only description in
  `K-334D-MAIN-INTEGRATION-001`.

Required authorization: a new explicit authorization binding the exact 12-commit,
9-file range and the exact current `main` head.

### Option B - Bounded Integration

Promote only selected K-334D3 implementation commits.

Benefits:

- keeps the apparent integration scope narrower.

Risks:

- requires cherry-picks and therefore new commit identities;
- alters ancestry and requires independent scope, identity, and validation
  evidence;
- cannot reuse the current exact-commit authorization unchanged.

Required authorization: a separate bounded-integration authorization that names
the selected commits, resulting commit identities, and all required validation.

### Option C - Deferred Main Promotion

Keep the current state: implementation remains merged into the authorization
branch while `main` remains unchanged.

Benefits:

- makes no new scope transition;
- requires no immediate promotion action.

Risks:

- `main` does not contain the approved K-334D3 implementation;
- the integration boundary remains unresolved.

Required authorization: none for deferral itself; a later promotion still needs
an authorization matched to its then-current topology.

## 5. Authorization Boundary

Existing authorization covers K-334D3 implementation execution and the merge
into the approved authorization branch. It does not automatically cover main
promotion, preceding historical commits, or branch-topology changes.

`K-334D-MAIN-INTEGRATION-001` is not executable against the actual range because
it describes only the four K-334D3 protocol files. It must not be treated as
authority for the five additional authorization documents in the real range.

## 6. Recommendation (Not a Selection)

Recommended option: **Option A - Full History Promotion**, subject to a new
explicit authorization and review.

Rationale: the current topology is linear and Option A preserves the existing
authorization trail and exact commit identities. Its wider scope must be stated
explicitly rather than inferred. This proposal does not select Option A or
authorize its execution.

The required future authorization must bind the exact `main` head, exact
`c311efc...` source commit, all 12 commits and 9 files, normal non-rewriting
promotion semantics, and the unchanged non-production boundary.

## 7. Proof and Authorization State

| State | Value |
| --- | ---: |
| Implementation merged | 1 |
| Main integration authorization executable for actual range | 0 |
| Main promoted | 0 |
| `D0-P09` executed/satisfied | 0/0 |
| `D0-P10` executed/satisfied | 0/0 |
| K-334E/F authorization | 0/0 |
| Runtime authorization | 0 |
| Production eligibility | 0 |

Scope resolution does not execute, satisfy, waive, or replace either proof gate.
It does not authorize K-334E, K-334F, runtime, production behavior, or source
eligibility.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
