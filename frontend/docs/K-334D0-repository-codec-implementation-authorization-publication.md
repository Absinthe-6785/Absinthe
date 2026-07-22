# K-334D0 Repository/Codec Implementation Authorization Proposal Publication

## 1. Publication Identity

| Field | Value |
| --- | --- |
| Record type | `K334DImplementationAuthorizationPublication` |
| Publication ID | `K334D-PUB-001` |
| Publication version | `1` |
| Publication status | `PUBLISHED_AWAITING_OWNER_DISPOSITION` |
| Proposal type | `K334DImplementationAuthorizationProposal` |
| Proposal ID | `K334D-AUTH-PROPOSAL-001` |
| Decision ID | `K334D-AUTH-D01-v1` |
| Published proposal path | `frontend/docs/K-334D0-repository-codec-implementation-authorization-proposal.md` |
| Published original reviewed proposal head | `28f2919995e6e1e533eb02a188c47d4dbe4e12b7` |
| Published proposal blob | `8a76ca9ddda68fd18bd7cedd4c22a0a7d9733ed3` |
| Pull request | `#603` |
| Original publication commit | `5093dc9c7cdd260248afa3335522cd21b89aaa0e` |

`K334D-PUB-001` publishes the exact reviewed proposal for a future Protocol Owner disposition. It is not a Protocol Owner disposition, approval, option selection, implementation authorization, or implementation start.

## 2. Exact Proposal Binding

| Field | Value |
| --- | --- |
| Repository | `Absinthe-6785/Absinthe` |
| Pull-request base | `904c65af2742b514d08545c69e4fdc5c755562e9` |
| Pre-publication commit count | `3` |
| Pre-publication changed-file count | `1` |
| Independent review | `PASS` on `28f2919995e6e1e533eb02a188c47d4dbe4e12b7` |
| Proposal-head CI | Run `#2014`, workflow run `29891833456` |

The reviewed proposal head and the original publication commit are distinct. This record binds only the proposal path, blob, and reviewed head above; no later proposal content, review, CI result, or pull-request metadata is implicitly bound.

## 3. Publisher Capacity and Provenance

Publisher identity: `Absinthe-6785`.

> I publish `K334D-AUTH-PROPOSAL-001` in the capacity of Proposal Publisher for Protocol Owner disposition.

| Field | Value |
| --- | --- |
| Published at (UTC) | `2026-07-22T06:40:38Z` |
| Git mechanism | Commit on `codex/k334d0-repository-codec-authorization-proposal` |
| GitHub mechanism | PR #603 in `Absinthe-6785/Absinthe` |
| Authenticated actor | `Absinthe-6785` |

Publisher capacity is limited to publication and is not Protocol Owner capacity. Git history supplies the original publication commit provenance without a self-referential pre-commit SHA claim.

## 4. Source-Authority Chain

| Field | Value |
| --- | --- |
| Source design document | `frontend/docs/K-334C3-durable-authority-schema-migration-design.md` |
| Reviewed design head | `85d5833a13e98052d225852df36c59952285ad9f` |
| Merged predecessor | `904c65af2742b514d08545c69e4fdc5c755562e9` |
| Predecessor PR | `#602` |
| Authorization proposal evidence | `K334C3-AUTH-PROPOSAL-001` |
| Publication evidence | `K334C3-PUB-001` |
| Owner evidence | `K334C3-OWNER-EVIDENCE-001` |

K-334C3 authorized only durable-authority design documentation and the documented design decisions. It did not authorize K-334D repository implementation, codecs, schema installation, database wiring, migrations, runtime integration, or production activation. Its owner evidence does not transfer implementation authority into K-334D.

## 5. Independent Review Evidence

| Field | Value |
| --- | --- |
| Reviewed proposal head | `28f2919995e6e1e533eb02a188c47d4dbe4e12b7` |
| Verdict | `PASS` |
| Findings at final review | None |
| `K334D0-R01` | `CLOSED` — production-reachable database version/open/upgrade wiring prohibited. |
| `K334D0-R02` | `CLOSED` — mandatory P1 obligations `D0-P09` and `D0-P10` added. |
| `K334D0A-R04` | `CLOSED` — `D0-P09` and `D0-P10` bound to D01-A, scope, K-334D3 acceptance, activation handoff, and publication preparation. |
| `K334D0-R03` | `CLOSED` — exact-head CI and exact PR metadata recorded accurately. |

Review PASS permits publication for Protocol Owner disposition only. It does not approve an option, select D01-A, authorize implementation or merge, or authorize production behavior.

## 6. Historical CI Evidence

### Reviewed proposal head

| Field | Value |
| --- | --- |
| Head | `28f2919995e6e1e533eb02a188c47d4dbe4e12b7` |
| Run | `#2014` |
| Workflow run ID | `29891833456` |
| Status / conclusion | `completed` / `success` |
| Required checks | test, typecheck, build, backend recovery, Vercel, Preview Comments |
| Overall | `ALL_REQUIRED_CHECKS_PASSED` |

### Original publication head

| Field | Value |
| --- | --- |
| Head | `5093dc9c7cdd260248afa3335522cd21b89aaa0e` |
| Run | `#2016` |
| Workflow run ID | `29897692002` |
| Status / conclusion | `completed` / `success` |

Neither historical run proves a later correction head. Proposal-head CI proves only the reviewed proposal head; original-publication-head CI proves only the original publication head.

## 7. Published Decision Options

The exact normative meanings, scope, exclusions, and consequences of these options are bound to §3 of the published proposal blob `8a76ca9ddda68fd18bd7cedd4c22a0a7d9733ed3`.

| Option ID | Published state |
| --- | --- |
| `K334D-AUTH-D01-A` | Recommended by the proposal only; not selected. |
| `K334D-AUTH-D01-B` | Not selected. |
| `K334D-AUTH-D01-C` | Not selected. |
| `K334D-AUTH-D01-D` | Not selected. |

Publication, silence, pull-request approval, merge, CI, review, recommendation, and publication metadata do not select any option.

## 8. Owner Response Contract

The only allowed owner responses for `K334D-AUTH-D01-v1` are:

| Allowed response |
| --- |
| `APPROVE_K334D_BOUNDED_IMPLEMENTATION` |
| `APPROVE_K334D_CODECS_ONLY` |
| `RETURN_K334D_PROPOSAL_FOR_REVISION` |
| `REJECT_K334D_IMPLEMENTATION` |

An effective response is singular, exact, explicit, durable, attributable, issued in Protocol Owner capacity, and bound to `K334D-PUB-001`, `K334D-AUTH-PROPOSAL-001`, `K334D-AUTH-D01-v1`, and the exact published proposal head. It must include an authority statement equivalent to: “I am responding in my capacity as the Absinthe Protocol Owner.”

Informal agreement, emoji or reaction, PR approval, merge, CI success, recommendation acknowledgement, ambiguous prose, a response without that capacity statement, a response for modified content, or multiple options are ineffective.

## 9. Current Owner Disposition

| Field | Value |
| --- | --- |
| Owner response | `NONE` |
| Owner response received | `0` |
| Owner disposition recorded | `0` |
| Selected option | `NONE` |
| Owner evidence ID | `NONE` |
| Owner evidence timestamp | `NONE` |
| Owner evidence source | `NONE` |
| Owner authorization evidence | `0` |

No owner response has been received, inferred, or created by this publication or correction.

## 10. Post-Publication Implementation-Start Gates

Publication satisfies only step 1 and none of steps 2–10:

1. this durable publication exists;
2. one effective Protocol Owner response exists;
3. durable owner evidence exists and is bound to this publication, proposal, decision, and exact published proposal head;
4. the selected option actually authorizes the contemplated implementation;
5. `D0-P09` and `D0-P10` are established as applicable proof obligations;
6. a separate future implementation task is created;
7. that task contains every required binding in §12;
8. the task verifies its exact starting state;
9. all authorization and proof gates are effective; and
10. implementation begins only after every prior step passes.

An owner disposition alone is insufficient to begin implementation. Publication creates no future implementation task and satisfies no implementation-start gate beyond durable publication itself.

## 11. D0-P09 and D0-P10 Future Proof Gates

| Proof | Meaning |
| --- | --- |
| `D0-P09` | Exact v5 Store and Index Fidelity |
| `D0-P10` | Production-Reachability Isolation |

Both are mandatory P1 obligations. Both must pass independently on the exact implementation head; one cannot compensate for the other, and prior-head proof cannot transfer. Ordinary CI, proposal review, publication, owner approval, merge, and later K-334F work cannot substitute for or retroactively cure missing proof.

Failure, absence, staleness, or inconclusive evidence for either proof blocks K-334D3 completion, implementation acceptance, merge-as-complete claims, activation handoff, and production reachability. This publication neither executes nor satisfies either proof.

## 12. Future Implementation-Task Binding

No implementation may begin from this publication record alone. A separate future implementation task must record all of the following; omission of any mandatory binding is blocking:

- implementation task ID, exact owner-selected option, publication ID, proposal ID, decision ID, and exact published proposal head;
- exact implementation base commit and branch;
- exact allowed files, responsibilities, and repository/codec/schema scope;
- excluded K-334E scope, K-334F scope, runtime scope, and production scope;
- `D0-P09`, `D0-P10`, every other proof obligation, validation commands, and explicit stop conditions;
- reviewer and explicit merge/activation prohibitions.

No such task is created by this record.

## 13. Future Stop Conditions

A future implementation task must stop if an owner response is missing or ambiguous, selects multiple options, lacks owner capacity, or lacks durable evidence; if proposal/publication binding or implementation base differs; if allowed scope cannot be determined; if excluded K-334E, K-334F, runtime, or production scope would be crossed; if `D0-P09` or `D0-P10` cannot be satisfied or is stale/from another head; if production database wiring would be required; if any source would become eligible; or if a new owner policy decision is required.

## 14. Authorization State

| State | Count |
| --- | ---: |
| Proposal drafted | 1 |
| Independent review completed | 1 |
| All proposal findings closed | 1 |
| Proposal-head CI successful | 1 |
| Proposal published | 1 |
| Publication evidence recorded | 1 |
| Publication-record correction started | 1 |
| Publication-record document updated | 1 |
| Owner response received | 0 |
| Owner disposition recorded | 0 |
| D01-A owner selection | 0 |
| D01-B owner selection | 0 |
| D01-C owner selection | 0 |
| D01-D owner selection | 0 |
| K-334D implementation authorization | 0 |
| K-334D implementation started | 0 |
| Future implementation task created | 0 |
| D0-P09 implementation proof executed | 0 |
| D0-P10 implementation proof executed | 0 |
| K-334E authorization | 0 |
| K-334F authorization | 0 |
| Runtime integration authorization | 0 |
| Admission authorization | 0 |
| Eligibility authorization | 0 |
| Activation authorization | 0 |
| Production rollout authorization | 0 |
| Production sources eligible | 0 |

Only publication and publication-correction documentation state may be `1`; no future proof obligation is represented as executed.

## 15. K-334D0B1 Finding State

- `K334D0B-R01`: correction implemented; independent review pending.
- `K334D0B-R02`: correction implemented; independent review pending.
- `K334D0B-R03`: correction implemented; independent review pending.
- `K334D0B-R04`: correction implemented; independent review pending.

The earlier proposal findings remain closed. This correction does not close any K-334D0B finding before independent review.

## 16. Immutability and Supersession

`K334D-PUB-001` applies only to the exact original reviewed proposal content and fixed blob. Proposal changes require new review, exact-head CI, and republication; prior owner responses do not transfer to changed proposal content. This record must not be silently repointed, and substantive publication defects require an explicit superseding record.

K-334D0B1 corrects publication-record completeness only. It does not republish a modified proposal, alter the original proposal binding, create a new publication ID, or alter the immutability or supersession model.

## 17. Non-Authorization Boundary

This publication and correction do not constitute owner disposition or approval; select an option; authorize or start K-334D implementation; create a future implementation task; execute or satisfy `D0-P09` or `D0-P10`; provide exact implementation-head proof; authorize K-334E, K-334F, database version/open/upgrade wiring, runtime integration, admission, eligibility, activation, or rollout; or make any production source eligible.

A later owner disposition alone remains insufficient without the separate task and proof gates above.

## 18. Production Boundary

No production code, schema, migration, repository, transaction, runtime, admission, eligibility, activation, rollout, or source-authority behavior is changed by this publication or correction.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
