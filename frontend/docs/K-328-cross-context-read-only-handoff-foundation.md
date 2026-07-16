# K-328 — Cross-Context Read-Only Handoff Foundation

## Status and scope

K-328 translates the selected K-327 architecture into dormant production-shaped modules. It implements real IndexedDB authority/candidate persistence, a native Web Locks wrapper, bounded canonical snapshot capture for injected isolated adapters, restart validation, and a real Chromium two-page harness.

Nothing invokes the handoff from application startup, Notes hydration, current persistence, migration, cutover, restore, sync, UI, workers, or timers. K-326G still classifies production localStorage and legacy IndexedDB as `uncoordinated_legacy_writers` with `crossContextSafe: false`. K-328 does not make either source eligible.

| Capability | K-328 status |
|---|---|
| Production IndexedDB schema | Implemented, dormant |
| Native Web Locks wrapper | Implemented, dormant |
| Read-only capture | Implemented for injected isolated adapters |
| Candidate persistence | Implemented |
| Authority persistence | Implemented |
| Restart validation | Implemented |
| Two-context browser evidence | Implemented in headless Chromium |
| Production eligibility | Not enabled |
| Existing Notes read-path switch | Not implemented |
| Existing writer migration | Not implemented |
| Legacy deletion | Not implemented |
| Network mutation | Not implemented |
| User-facing rollout | Not implemented |

## Modules

- `crossContextHandoff/types.ts`: versioned records, limits, payload-free error codes, adapter and observer contracts.
- `canonical.ts`: UTF-8 accounting, SHA-256 helpers, detached source-entry validation, ordering, depth bounds.
- `identity.ts`: strict physical and logical identity parsing and digest derivation.
- `records.ts`: candidate/session generation, record validation, canonical byte encoding, graph binding, resource budgets.
- `webLocks.ts`: exclusive physical-source Web Lock wrapper with unsupported, abort, lock-failure, and operation-failure outcomes.
- `database.ts`: isolated IndexedDB schema, bounded byte reads, authority CAS, append-only candidate transaction, restart reads.
- `handoff.ts`: dormant caller-provided-adapter orchestration and restart entry point.
- `observability.ts`: optional payload-free effect observer.
- `crossContextHandoff.test.ts`: production-module unit and fake-indexeddb transaction tests.
- `crossContextHandoffDormancy.test.ts`: permanent active-caller and K-326G audit.
- `tests/k328-browser-fixture.html` and `scripts/run-k328-browser-tests.mjs`: isolated Vite/Chrome real-engine harness.

## Physical source and lock identity

The accepted physical record is exactly:

```text
schemaVersion: 1
origin: canonical HTTP(S) origin
sourceFamily: legacy_notes
backend: combined_localstorage_indexeddb
databaseName: absinthe-notes-v1
objectStoreName: notes
physicalSourceVersion: 1
```

Canonical bytes are the fixed-position JSON tuple beginning `absinthe_legacy_physical_source_v1`. SHA-256 of its UTF-8 bytes is the full physical-source digest. The lock name is:

```text
absinthe:legacy-source-handoff:v1:<64 lowercase hex physical digest>
```

User, project, namespace, and device never enter this tuple or lock name. They form a separate logical-scope digest validated under the physical lock. Changing account scope cannot split one physical source into multiple locks.

## Web Locks behavior

`withPhysicalSourceLock` requests an exclusive native lock. There is no lease, localStorage lock, `steal`, `ifAvailable`, or unlocked fallback. Unsupported Web Locks fail closed. Pre-grant abort never invokes the operation. Acquisition failures and callback failures are distinct, the callback is limited to one invocation, and diagnostics contain only stable codes.

The Chromium harness proves two same-origin pages serialize on the same physical lock, an aborted waiter never enters, callback failure releases the native lock, and distinct physical origins progress independently. Firefox, WebKit, PWA, private-mode, and storage-bucket behavior are not claimed.

## IndexedDB schema

| Property | Value |
|---|---|
| Database | `absinthe-cross-context-handoff-v1` |
| Version | `1` |
| Authority store | `handoff_authority` |
| Authority key | full physical-source digest, out-of-line |
| Candidate store | `handoff_candidates` |
| Candidate key | generated candidate ID, out-of-line |
| Indexes | none |
| Values | immutable canonical-JSON UTF-8 `Uint8Array` |

The database is separate from `absinthe-local-v2`, `absinthe-notes-v1`, attachment databases, and all current Notes stores. Initial creation is additive within this new database. Unknown existing layouts fail open validation; no store is cleared, recreated, upgraded in place, or repaired. `onversionchange` closes open connections. `onblocked` returns a bounded failure, and a late successful open is immediately closed.

## Snapshot capture and identifiers

The source adapter must be caller-provided, explicitly isolated, and read-only. Capture accepts only exact `[id, value]` string tuples, rejects duplicates, measures UTF-8 bytes, sorts IDs with locale-independent UTF-16 code-unit comparison, and freezes newly allocated tuples. It never mutates, normalizes, timestamps, marks, deletes, clears, or repairs the source.

Snapshot SHA-256 covers the versioned ordered tuple. Identifiers are generated internally:

- candidate: `candidate-<first 24 lowercase snapshot SHA-256 hex>`, exactly 34 UTF-8 bytes;
- session: `handoff-<first 16 lowercase physical digest hex>-<canonical revision>`, 26–41 UTF-8 bytes, revision `0..Number.MAX_SAFE_INTEGER`.

Syntax alone is insufficient. Restart rederives the complete snapshot, candidate, session, root, manifest, physical, and logical binding.

## Candidate and authority records

The candidate owns the sole immutable ordered snapshot and contains the candidate/session IDs, physical and logical digests, revision, full snapshot/root/manifest digests, entity count, and records. The authority contains no duplicate snapshot. It binds the logical scope, physical digest, revision, session, candidate, and full digest chain.

Durable lifecycle:

```text
handoff_pending
  -> snapshot_committed_pending_finalization
  -> read_only_handoff
```

The first preflight source read establishes a revision. A pending authority is installed under the native physical lock. Capture then rereads the source and rejects a changed revision. Candidate creation and the snapshot-committed authority transition occur in one strict two-store transaction. Final terminalization is an authority CAS. Restart from snapshot-committed evidence validates the candidate graph and performs only the terminal CAS without rereading the source. Terminal locked retry validates authority/candidate and performs no source read, digest, candidate write, or authority write.

## Transaction and collision semantics

Candidate creation uses `IDBObjectStore.add()`, never `put()`. Authority changes require exact expected bytes. Request success is not completion: every successful result waits for `transaction.oncomplete`. Abort and request/transaction failures are bounded separately.

| Case | Result | Durable mutation |
|---|---|---|
| New key and expected authority | `created` | candidate plus exact authority CAS |
| Same key, exact canonical bytes/full binding | `existing_identical` | none |
| Same store key, different valid canonical bytes/binding | `CANDIDATE_KEY_COLLISION` | none |
| Store key/payload ID mismatch | `PERSISTED_EVIDENCE_MISMATCH` | none |

The browser collision test injects only the object-store lookup key after both candidate payloads pass normal generation and validation. It tests storage-key collision policy, not SHA-256 collision probability. Production identifier parsing is unchanged and the injection is absent from the public directory export.

## Resource contract

| Bound | Value |
|---|---:|
| Authority payload ceiling | 4,096 bytes |
| Candidate payload ceiling | 504,000 bytes |
| Demonstrated candidate high-water | 503,794 bytes |
| Transaction writes | 509,000 bytes |
| Application reserve | 3,904 bytes |
| Aggregate source tuples | 499,000 bytes |
| Source record count | 4,096 |
| Canonical record | 131,072 bytes |
| Source-record ID | 256 bytes |
| Source-record value | 20,000 bytes |
| JSON depth | 64 |

Production budget validation preserves `1,302 + 503,794 + 3,904 = 509,000` and rejects the 1,303-byte authority plus-one case. Authority/candidate ceilings are raw rejection ceilings, not invented reachable exact payload maxima. All persisted bytes are bounded before fatal UTF-8 decoding, schema construction, digesting, or mutation.

## Restart, malformed bytes, and privacy

Restart performs a bounded authority read, learns the immutable candidate key, then rereads authority and candidate together and rejects an authority change between observations. It verifies structured-clone `Uint8Array`, byte ceilings, fatal UTF-8 decoding, JSON depth, exact schema, canonical re-encoding, key/payload equality, identifier derivation, and the full graph. Missing, malformed, noncanonical, mismatched, over-limit, or unknown evidence fails closed without repair.

`MALFORMED_UTF8_BYTE_BOUNDARY_IMPLEMENTED_AND_TESTED`: the stores intentionally contain byte arrays, so malformed UTF-8 is representable and is rejected by fatal `TextDecoder` before JSON parsing. No malformed-byte claim is made for ordinary JavaScript strings.

Errors contain only a stable code and operation. Observers report effect names only. Neither path includes source values, Note IDs, Notes content, record JSON, tokens, auth objects, or raw browser exceptions.

## Observable effects

Optional injected observers distinguish attempts and committed effects:

```text
lock_request, lock_acquired, coordinator_attempt, source_read,
database_open, persistence_read, transaction_start,
candidate_create_request, candidate_committed_write,
authority_committed_write, transaction_abort,
finalization_attempt, digest_operation
```

Normal production use has no observer. Every effect has a positive unit or browser path; no permanently-zero safety signal exists. Detached test evidence compares authority bytes, candidate key/bytes, source entry bytes, and object counts independently of effect counters.

## Real browser evidence

`npm run test:k328-browser` launches two isolated Vite origins and headless installed Google Chrome through CDP without adding a browser dependency. The production modules execute in real pages using native IndexedDB and `navigator.locks`. This managed Windows environment required Chrome's `--no-sandbox` launch flag because the sandboxed GPU process repeatedly terminated; the test does not claim browser-sandbox evidence, while the IndexedDB and Web Locks implementations under test remain native browser APIs.

Collected evidence includes schema creation, candidate/authority commit, real `add()` `ConstraintError`, zero-write replay, page-close/reopen validation, two transaction abort boundaries, versionchange closure/reopen, Web Lock ordering/abort/failure release, same-store-key two-context collision, malformed UTF-8 rejection, and different-origin independence.

This is page-close/reopen restart evidence, not OS crash or power-loss durability. Browser-process crash, storage eviction, quota, Firefox/WebKit, and forced close during an in-flight transaction remain future gates.

## Dormancy and remaining gates

The permanent audit finds no active caller outside the module and verifies the existing K-326G rejection statements. There is no production source adapter, production inventory scan, startup wiring, writer routing, K-323 call, migration, cutover, restore, UI, worker, timer, service worker, cleanup, deletion, repair, or network behavior.

Before eligibility can change, a later task must still provide real-data aggregate inventory, coordinate every K-327 writer, eliminate authoritative localStorage fallback, test quota/eviction and additional browsers, complete production writer drain/flush UX, and obtain independent persistence/security review.
