# K-334D3H - Main Integration Authorization Record

## 1. Record Identity

| Field | Exact value |
| --- | --- |
| Record type | `K334DMainIntegrationAuthorizationRecord` |
| Record ID | `K-334D-MAIN-INTEGRATION-001` |
| Status | `MAIN_INTEGRATION_AUTHORIZED_NOT_EXECUTED` |
| Repository | `Absinthe-6785/Absinthe` |

This record authorizes one separate lifecycle transition: promotion of the
already reviewed K-334D3 merge result to `main`. It is not implementation,
runtime, or production authorization.

## 2. Exact Bindings

| Binding | Exact value |
| --- | --- |
| Implementation merge commit | `c311efc0ed208a3d39734abb822c6fabbf7ff248` |
| Reviewed implementation head | `422930cd3a5322d6a786171d6f1ebc2bb5565528` |
| Current `main` head | `904c65af2742b514d08545c69e4fdc5c755562e9` |
| Implementation branch | `codex/k334d3-repository-codec-implementation` |
| Authorization base branch | `codex/k334d0-repository-codec-authorization-proposal` |
| Owner evidence | `K334D-OWNER-EVIDENCE-001` |
| Selected option | `K334D-AUTH-D01-A` |
| Implementation task | `K-334D-IMPLEMENTATION-TASK-001` |
| Execution task | `K-334D-EXECUTION-TASK-001` |

The authorization is valid only for the exact source merge commit and exact
pre-promotion `main` head above. A changed source, changed `main` head, or
changed scope requires a new authorization record and review.

## 3. Authorized Promotion Scope

The authorized action is one normal GitHub promotion of
`c311efc0ed208a3d39734abb822c6fabbf7ff248` into `main`, after re-verifying
the exact bindings in this record.

The promoted K-334D3 scope is limited to these already merged files:

- `frontend/src/lib/localDatabase/protocol/canonicalProtocolPreimage.ts`
- `frontend/src/lib/localDatabase/protocol/k334CanonicalProtocol.ts`
- `frontend/src/lib/localDatabase/protocol/k334CanonicalRepository.ts`
- `frontend/src/lib/localDatabase/protocol/k334CanonicalProtocol.test.ts`

No new implementation, file change, history rewrite, force-push, or additional
merge is authorized by this record.

## 4. Main Integration Boundary

Main integration is a separate lifecycle transition. It does not reopen the
K-334D3 implementation scope and does not authorize K-334E, K-334F, migration,
recovery, runtime integration, production activation, admission, eligibility,
or source activation.

The future execution must verify that the source merge and target `main` head
still match Section 2, that the scope remains exactly Section 3, and that no
new commits or files have been introduced before promotion.

## 5. Proof Boundary

| Proof | Executed | Satisfied |
| --- | ---: | ---: |
| `D0-P09` | 0 | 0 |
| `D0-P10` | 0 | 0 |

Main integration does not execute, satisfy, waive, replace, or retroactively
cure either proof gate.

## 6. Authorization State

| State | Count |
| --- | ---: |
| Implementation merged | 1 |
| Main integration authorization | 1 |
| Main promoted | 0 |
| K-334E authorization | 0 |
| K-334F authorization | 0 |
| Runtime authorization | 0 |
| Production eligibility | 0 |

## 7. Non-Authorization Boundary

This record authorizes only the bounded main-integration transition in Section
3. It does not authorize source changes, database changes, production behavior,
or any future protocol stage.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
