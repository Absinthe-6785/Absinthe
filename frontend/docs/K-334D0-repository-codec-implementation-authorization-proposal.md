# K-334D0 — Durable Authority Repository and Codec Implementation Authorization Proposal

## 1. Proposal Identity

| Field | Value |
|---|---|
| Proposal type | `K334DImplementationAuthorizationProposal` |
| Proposal ID | `K334D-AUTH-PROPOSAL-001` |
| Package ID | `K-334D0-repository-codec-authorization-proposal-1` |
| Decision ID | `K334D-AUTH-D01-v1` |
| Recommended option | `K334D-AUTH-D01-A` |
| Status | `DRAFT_NOT_PUBLISHED` |
| Policy authority | Absinthe Protocol Owner |
| Proposal recorder | Absinthe-6785 |
| Proposal authority | Authorized Implementation Authorization Proposal Recorder |

This is an authorization proposal only. It is not owner approval, publication
evidence, implementation authorization, or the start of K-334D.

## 2. Exact Source-of-Truth Binding

| Binding | Exact value |
|---|---|
| Merged design document | `frontend/docs/K-334C3-durable-authority-schema-migration-design.md` |
| Reviewed design head | `85d5833a13e98052d225852df36c59952285ad9f` |
| Merge commit | `904c65af2742b514d08545c69e4fdc5c755562e9` |
| Merged PR | #602 — K-334C3: Design durable authority schema and migration |
| Design proposal | `K334C3-AUTH-PROPOSAL-001` |
| Design publication | `K334C3-PUB-001` |
| Design owner evidence | `K334C3-OWNER-EVIDENCE-001` |
| Selected design option | `K334C3-AUTH-D01-A` |

K-334C3 authorized and completed documentation design only. This proposal is
bound to its fixed fields, tags, preimages, stores, indexes, ownership, and
fail-closed defaults; it does not convert that design into implementation
authority.

## 3. Owner Decision Requested

The Absinthe Protocol Owner may select exactly one `K334D-AUTH-D01-v1` option:

| Option | Effect |
|---|---|
| `K334D-AUTH-D01-A` — APPROVE BOUNDED K-334D | Authorize only canonical record types, K-333-bound codecs, IDs/digests, declarative v5 store/index definitions, canonical repository primitives, and isolated fixtures/tests. K-334E, K-334F, runtime, and production remain unauthorized. |
| `K334D-AUTH-D01-B` — APPROVE CODECS ONLY | Authorize only record types, codecs, IDs/digests, and fixtures; no IndexedDB definition, store/index, or repository work. |
| `K334D-AUTH-D01-C` — RETURN FOR REVISION | Authorize nothing and require a revised proposal. |
| `K334D-AUTH-D01-D` — REJECT | Reject K-334D implementation authorization; all implementation authorization remains zero. |

The recommendation is `K334D-AUTH-D01-A`. It is not approval: it is offered
because the merged design fixes the base-layer contracts while isolating them
from acceptance, concurrency, migration, runtime activation, and production.

For this recommendation, “declarative v5 store/index definitions” means only
standalone or test-only artifacts. It does not include production-reachable
database version, open, upgrade, migration, initialization, flag, registry, or
startup wiring, whether reached directly or through an import, re-export,
callback, or shared constant.

If `K334D-AUTH-D01-A` is later selected, the authorized schema-definition
slice remains subject to independent successful completion of `D0-P09` (Exact
v5 Store and Index Fidelity) and `D0-P10` (Production-Reachability Isolation).
Owner selection of D01-A, proposal publication, ordinary CI, compilation,
documentation review, or a K-334D3 completion claim satisfies neither proof.
Both proofs must pass on the exact implementation head before K-334D3 can be
accepted as complete or handed to any activation or migration task. Failure or
absence of either proof leaves K-334D3 incomplete, blocks acceptance, and
prohibits handoff; later K-334F work cannot cure an implementation already
accepted without both proofs.

## 4. Proposed K-334D Scope

If and only if the owner later selects `K334D-AUTH-D01-A`, implementation may
use only fields and semantics already fixed by K-334C3. No field, tag,
authority meaning, policy choice, or runtime effect may be invented.

### 4.1 Canonical record models

Strict types/schemas may cover: authority evidence; scoped issuer policy;
rollback permission; durable termination; exact compatibility tuple; external
subject/issuer mappings; conflict/fork observations; exact-subject quarantine;
migration classifications and audit/provenance records where K-334C3 assigns
K-334D ownership; and canonical candidate/quarantine-basis pair/collection
helpers. Required fields remain required, explicit `null` remains explicit,
and unknown fields reject or preserve as non-authoritative as K-334C3 directs.

### 4.2 Canonical codecs and identities

The bounded implementation may provide literal fixed domain tags; exact
ordered-field encoders/decoders; non-circular record-ID, canonical-digest, and
tuple-ID derivation; exactly-once outer-domain binding; deterministic scalar
and collection framing; candidate pair/collection bytes; unknown-domain and
wrong type/tag rejection; and same-ID/same-bytes idempotence versus
same-ID/different-bytes integrity conflict. A valid decode, ID, or digest has
no acceptance, compatibility, eligibility, or runtime effect.

### 4.3 Declarative v5 definitions only

#### Production-reachable schema barrier

The preceding scope is limited to an immutable standalone schema manifest for
the additive v5 store declarations, key paths, indexes, unique/non-unique and
`multiEntry` flags, and schema metadata fixed by K-334C3 Sections 9–10. It may
include a test-only database name, installer, fixtures, and helpers that are
not imported by a production path. These artifacts are an isolated fidelity
contract, not an application database upgrade.

Even if `K334D-AUTH-D01-A` is later approved, K-334D must not modify, export
for production use, or otherwise make reachable any production database
version/open/upgrade wiring. This includes `LOCAL_DATABASE_VERSION`; the
version passed to production `indexedDB.open`; a production database factory;
production schema registries consumed by an open path; `onupgradeneeded` or
live-upgrade callbacks; migration dispatch; runtime initialization; a feature
flag that causes a v5 open; application-startup initialization; or a shared
constant capable of upgrading an existing user's database. This is a
reachability boundary, not a filename or symbol-name convention: an indirect
import, re-export, flag, callback, or initialization path is equally forbidden.

K-334D may not open or upgrade the real application database, touch existing
user data, run a migration, activate a runtime flag, silently import an
isolated installer, or leave an irreversible production-reachable schema
change. The test-only installer must use a distinct database name, be
removable, and remain unreachable from production startup and runtime paths.

Production-reachable definitions require a separate future activation handoff:
explicit owner authorization; an exact authorized base; K-334F and activation
ownership; defined backup, recovery, and crash behavior; a reviewed migration
and version-open design; authorization for any existing-data mutation; exact
CI and migration-test evidence; and a separately authorized runtime-admission
decision. None of those conditions is supplied by this proposal.

That handoff additionally requires exact-head evidence that both `D0-P09` and
`D0-P10` passed independently for the proposed K-334D3 implementation. Prior
head evidence is historical only, and ordinary CI success is not a substitute.
No standalone K-334D3 artifact may become production-reachable while either
proof is missing, stale, failed, or inconclusive; K-334F cannot retroactively
cure an implementation accepted without either proof.

The scope may define versioned schema constants, additive v5 store
declarations, key paths, indexes, unique/non-unique flags, schema metadata,
and isolated test-database harnesses from K-334C3 Sections 9–10. It excludes
opening/upgrading an existing production database, migration execution, and
existing-user-data mutation; those remain K-334F.

The reference to versioned schema constants in this section is limited by the
production-reachable schema barrier above: no such constant may be shared with,
or capable of changing, an existing-user database open or upgrade path.

### 4.4 Canonical repository primitives

The scope may implement single-record canonical operations: append a validated
record; read by exact primary ID; query exact canonical indexes; enumerate all
competitors at a logical position; verify ID/digest integrity; handle
idempotent duplicates; and preserve unsupported/rejected records when
required. It may declare the `authority_heads` shape/store/index contract.

Repository primitives must not accept authority, advance accepted heads,
resolve conflicts, declare forks, activate compatibility, mutate eligibility,
rebuild projections, or use projections as runtime authority.

### 4.5 Isolated fixtures and tests

Only K-334D-layer tests may be implemented: canonical golden and supported
cross-runtime bytes, fixed-domain and exactly-once fixtures, pair/collection
ordering, duplicate/collision handling, append/read/idempotence, competitor
preservation, and isolated IndexedDB schema-definition tests. No test may
modify real user data, run a production migration, or enable authority runtime
behavior.

### 4.6 Schema-fidelity and isolation proof boundary

Before a K-334D3 package can be accepted, it must prove the full v5 contract
against the fixed K-334C3 Sections 9–10 inventory and independently prove that
its installer is production-unreachable. A passing isolated test cannot be
substituted for a production upgrade, migration, or runtime admission.

The proposed schema-definition scope is compliant only when `D0-P09` and
`D0-P10` each pass independently on the exact implementation head. Neither
result may be inherited from a prior head or inferred from ordinary
test/typecheck/build success. This scope definition grants no permission to
merge or accept an implementation without both proofs.

## 5. Explicit Exclusions

### K-334E is excluded

T08–T13 and T22–T24/T33 remain unauthorized: linear-successor acceptance,
accepted-head advancement, multi-store acceptance transactions, competing
successor/conflict/fork/quarantine orchestration, leases, multi-tab
single-writer enforcement, stale-tab fencing, concurrency, and cross-store
retry/recovery. K-334D primitives must not compose those workflows.

### K-334F is excluded

Production v4→v5 migration execution, legacy classification execution,
sessions/leases/checkpoints in a real migration, resume/replay, post-crash
recovery, projection rebuild/reconciliation, completion verification, live
upgrade, and existing-user-data mutation remain unauthorized. Declarative
migration-record schemas do not authorize a migration process.

### Runtime and production are excluded

No proposed artifact may be wired into production authority admission,
authority/compatibility resolution, sync, Notes hydration, restore, deletion,
recovery, UI, feature flags, eligibility, issuer/subject activation, or
production rollout. No current production source is accepted authority.

## 6. Fail-Closed Requirements

- Unknown schema/domain is unsupported and non-authoritative.
- Malformed canonical bytes reject or preserve as non-authoritative as K-334C3
  specifies.
- Wrong type/tag and same ID/different bytes are integrity conflicts.
- Identical duplicates are idempotent no-ops.
- Insertion, query results, timestamps, arrival order, and projections alone
  grant no acceptance or eligibility.
- Missing/corrupt projections permit no fallback authority.
- Unsupported legacy records receive no promotion; conflicts preserve all
  canonical evidence.
- `D0-P09` and `D0-P10` are mandatory P1 obligations. Neither may be waived
  by ordinary CI, owner recommendation, PR approval, implementation merge, or
  future K-334F work; any waiver requires a new Protocol Owner decision that
  revises this authorization contract before implementation acceptance.

## 7. Preconditions Before Any K-334D Implementation

1. This exact proposal is published for owner review.
2. The owner responds explicitly as the Absinthe Protocol Owner.
3. The owner selects one exact `K334D-AUTH-D01-v1` option.
4. Durable owner-response evidence is recorded.
5. The selected option authorizes the proposed implementation.
6. A separate K-334D implementation task is issued.
7. Its branch starts from the exact authorized main commit.
8. Its scope remains outside K-334E, K-334F, runtime, and production work.

Until every precondition holds, K-334D implementation authorization remains
zero.

## 8. Required K-334D Proof Obligations

| ID | Threat / invariant | Owner | Test category | Severity |
|---|---|---|---|---:|
| D0-P01 | Deterministic canonical bytes, fixed tags, exactly-once outer domains. | K-334D | golden/cross-runtime codec | P1 |
| D0-P02 | IDs/digests remain non-circular; same ID/different bytes rejects. | K-334D | identity/integrity | P1 |
| D0-P03 | Exact tuple/mapping has no implicit fallback. | K-334D | codec/repository | P1 |
| D0-P04 | Competitors coexist; logical-position evidence lookup is non-unique. | K-334D | isolated IndexedDB/repository | P1 |
| D0-P05 | Insertion/projection reads do not accept authority. | K-334D | negative-path repository | P1 |
| D0-P06 | Unknown/malformed/unsupported records cannot become authoritative. | K-334D | codec/schema | P1 |
| D0-P07 | Retries are idempotent; storage failure fails closed. | K-334D | repository/storage failure | P1 |
| D0-P08 | Isolated schema tests never mutate production data. | K-334D | isolated IndexedDB schema | P1 |
| D0-P09 | Exact v5 Store and Index Fidelity: every K-334C3 store name, key-path form (scalar/compound), `autoIncrement` flag, index name, index key path, `unique`, `multiEntry`, declared index order, intended non-unique logical-position behavior, and derived-head primary-key uniqueness must match; missing and extra stores/indexes fail. | K-334D | isolated IndexedDB metadata inspection plus deterministic manifest comparison | P1 |
| D0-P10 | Production-reachability isolation: the test-only manifest/installer has a unique test database name, is unreachable from production imports/open/version/startup paths, and cannot alter real user data or a production version. | K-334D | static import/reachability audit plus isolated harness | P1 |

## 9. Future Implementation Package Shape

### D3 acceptance and publication gates

No future K-334D3 package is acceptable, mergeable as complete, or eligible
for an activation handoff until D0-P09 and D0-P10 pass. Fidelity proof must
cover every declared store and index, including store names, scalar versus
compound key paths, `autoIncrement`, `unique`, `multiEntry`, index order,
absence of undeclared entries, intended non-unique logical-position semantics,
and the derived-head primary-key uniqueness contract. The proof must inspect
metadata from an actually created isolated IndexedDB database and compare it
with the deterministic immutable manifest.

Isolation proof must show that no production schema/open/version file, runtime
initialization path, or startup path imports or executes the test-only
installer. A mismatch or reachability failure is a P1 authorization blocker:
it prevents acceptance, completion claims, and any handoff to activation. It
does not authorize an automatic repair, migration, or production schema change.

K-334D3 is not complete, accepted, mergeable as complete, or ready for
handoff unless both `D0-P09` and `D0-P10` pass independently on its exact
implementation head. A pass on one cannot compensate for a failure or absence
of the other. Manual review, ordinary CI, documentation claims, later
migration work, or runtime safeguards added after acceptance cannot waive or
replace either proof.

### Proposal publication-preparation gate

Publication preparation for this proposal requires the text to bind both
`D0-P09` and `D0-P10` as mandatory independent gates in D01-A, the
schema-definition scope, K-334D3 completion/acceptance, and activation
handoff. This is a documentation-readiness check only; future K-334D3
acceptance still requires actual exact-head passing evidence for both proofs.

Prefer bounded sequential PRs:

1. K-334D1 — canonical types and K-333-bound codecs.
2. K-334D2 — IDs, digests, golden fixtures, integrity validation.
3. K-334D3 — v5 declarative stores/indexes in isolated schema tests.
4. K-334D4 — canonical append/read/idempotency repositories and tests.
5. K-334D5 — audit that no runtime path uses the new layer.

This proposal authorizes none of these slices by itself.

## 10. Owner Response Contract

Only these exact values may later be considered for owner evidence:

- `APPROVE_K334D_BOUNDED_IMPLEMENTATION`
- `APPROVE_K334D_CODECS_ONLY`
- `RETURN_K334D_PROPOSAL_FOR_REVISION`
- `REJECT_K334D_IMPLEMENTATION`

The response must include an authority statement equivalent to: “I am
responding in my capacity as the Absinthe Protocol Owner.” Without that
statement, it is not effective owner evidence. This task records no owner
response.

## 11. Authorization Counts

### Correction history

- K334D0-R01: corrected previously; independent review closed.
- K334D0-R02: corrected previously; independent review closed.
- K334D0A-R04: correction implemented; independent review pending.
- K334D0-R03: metadata correction implemented after current commit/CI state is
  known; independent verification pending.

### Effective current counts

| State | Count |
|---|---:|
| K-334D authorization proposal drafted | 1 |
| K-334D0 correction started | 1 |
| K-334D0 proposal document updated | 1 |
| K-334D0A1 correction started | 1 |
| K-334D0A1 proposal document updated | 1 |
| K-334D proposal published | 0 |
| K-334D owner disposition recorded | 0 |
| K-334D implementation authorization | 0 |
| K-334D implementation started | 0 |
| K-334E authorization | 0 |
| K-334F authorization | 0 |
| Runtime integration authorization | 0 |
| Eligibility authorization | 0 |
| Activation authorization | 0 |
| Production rollout authorization | 0 |
| Production sources eligible | 0 |

### Hypothetical only — non-effective

If future valid owner evidence selects `K334D-AUTH-D01-A`, K-334D
implementation authorization would become `1`; every other
implementation/runtime/production authorization remains `0`. This is not an
effective authorization.

## 12. Final Invariants

K-334D implementation authorization remains zero until valid owner evidence is
recorded.

K-334E and K-334F remain unauthorized.

No runtime or production path is authorized to consume the proposed durable
authority layer.

No existing or future record becomes accepted authority merely by being encoded,
stored, indexed, or returned by a repository.

NO_PRODUCTION_SOURCE_CAN_YET_BE_ELIGIBLE
