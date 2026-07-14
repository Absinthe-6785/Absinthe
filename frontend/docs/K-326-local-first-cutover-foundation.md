# K-326 Local-First Cutover Activation Foundation

K-326 adds a dormant, capability-gated protocol that can activate one exact K-325 `verified` legacy Notes
generation. It does not run at startup, change the production Notes read path, call Supabase, start an outbox
worker, or expose a user interface. The legacy vault remains intact.

## Scope and prerequisites

The cutover candidate must remain a strict K-325 version-1 session in `verified` state. Planning, preflight,
activation, and confirmation bind and revalidate the namespace, user, project, device, authority, source root,
source descriptor, source snapshot, migration session, manifest digest, target-state digest, predecessor, and
target generation. A historical `verified` flag is never sufficient. The source is recaptured before planning,
preflight, activation, and confirmation; K-325 exact target validation is repeated in the final transaction.

The target must still be the inactive `preparing` migration generation, have exact manifest-bound entities,
and contain zero outbox and checkpoint rows. The predecessor must still be the metadata active generation.
Active restore sessions, competing cutovers, missing or revoked authority, altered source, malformed persisted
evidence, and changed active pointers fail closed.

## Durable records and lifecycle

K-326 intentionally reuses the existing `migration_state` store, so the database remains
`absinthe-local-v2` version 3 and no schema upgrade is required. Existing K-321 through K-325 stores, indexes,
records, tombstones, outbox history, checkpoints, restore sessions, migration sessions, authority records, and
attachment metadata are untouched.

Cutover sessions use the reserved storage key `k326:cutover:<logical-id>`. Public logical IDs beginning with
`k326:` are rejected. The strict `local_first_cutover_session_v3` record contains a payload-free immutable plan,
bounded lifecycle evidence, and no Note title, body, metadata, attachment content, token, browser exception,
stack, or arbitrary message.

Version 3 binds one exact physical fence instance through a 128-bit random hexadecimal nonce, the monotonic
K-319 safety epoch captured for that installation, namespace, cutover session, target generation, and plan
digest. Durable fence evidence distinguishes `installing`, `installed`, `releasing`, `released`, and `committed`,
and separately records whether the physical vault is `clear`, blocked by another artifact, or indeterminate.
The original identity remains stored after release; a separately observed late identity is bound before it can
be removed. Draft-only version-1/version-2 session and shared-fence shapes are rejected rather than assigned
synthetic identity.

The lifecycle is:

`planned -> preflight -> activating -> activated -> confirmed`

Failures after a durable fence but before activation enter `failed_precommit_fenced`. Only an exact,
graph-validated fence release changes that state to terminal `failed`; failures before the fence enter `failed`
directly, and `cancelled` is terminal. Planning is deterministic and an exact retry returns the same plan.
Repeated preflight is read-only after the durable preflight boundary. An `activating` session resumes the same
transaction. A crash after activation commit leaves `activated`; resume performs confirmation. Confirmed retry
revalidates the source, mode, pointer, generation graph, entities, manifest digest, outbox, and checkpoints.

The plan binds the expected `legacy -> local_first` mode transition and the exact predecessor-to-target pointer
transition. It also lists fixed post-activation checks and prohibited side effects. The canonical plan digest
uses locale-independent code-unit ordering. Unknown fields, reordered fixed contract arrays, changed bindings,
and malformed digests are corruption; no compatibility normalization or repair runs.

## Runtime mode and atomic activation

The strict `local_first_runtime_mode_v1` record is stored at `k326:runtime-mode`. Explicit planning materializes
the current `legacy` mode without changing the production runtime. There is no mode inference from entity
contents and no fallback from malformed or inconsistent mode evidence.

The final IndexedDB transaction spans:

- `database_meta`;
- `generations`;
- `entities`;
- `outbox`;
- `sync_checkpoints`;
- `migration_state`; and
- `restore_sessions`.

Inside that transaction K-326 re-reads the cutover and K-325 sessions, authority/root records, metadata,
predecessor and target generations, exact target entities, target outbox/checkpoints, runtime mode, restore
sessions, and competing cutovers. It then seals the predecessor, activates the exact target, updates the active
pointer, writes `local_first` mode, and marks the cutover `activated`. IndexedDB abort semantics ensure all four
state changes commit together or none survive. No network or other asynchronous external operation occurs in
the transaction.

Two concurrent callers serialize on IndexedDB. One exact activation commits; another caller observes the
activated session and performs idempotent confirmation. Competing sessions, generations, namespaces, restore
activation, predecessor changes, source changes, and authority revocation lose deterministically without
rewriting evidence.

All active-generation pointer changes pass through one low-level mode-aware transition. Initial namespace
bootstrap creates no K-326 mode record. Generic `activateGeneration()` keeps its pre-K-326 behavior only while
no runtime-mode record exists. Once planning owns `legacy` mode or cutover establishes `local_first`, generic
activation fails with `ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL`; it never creates, advances, or repairs
runtime mode.

A K-324 restore after cutover uses the same transition inside its existing restore transaction. It validates
pointer/mode equality, seals the predecessor, activates the exact restore target, advances the active pointer
and `local_first.activeGenerationId`, then commits the restore session atomically. The original cutover target
and session remain historical evidence. Restore with no mode preserves pre-K-326 behavior; restore while an
explicit `legacy` cutover mode exists is rejected. Existing pointer/mode divergence fails as corruption without
repair or fallback.

## Legacy-write freeze

K-326 extends the K-319 recovery boundary with a session-, namespace-, and generation-bound operator
authorization. It never disables recovery mode or permits restore, reset, delete, cleanup, hydration, upload,
or another guarded operation. The authorization can affect only its exact cutover.

Before the activation transaction, K-326 creates a unique fence nonce, advances the K-319 safety epoch, and
first persists that exact instance as `installing`. The mutable K-326A/B shared key was unsafe because localStorage
cannot atomically compare and mutate one slot. K-326C instead derives an opaque SHA-256 key under the reserved
`absinthe:k326:legacy-fence:v3:` prefix from a fixed canonical encoding of the complete identity and schema
version. Each instance therefore owns a different immutable physical key; its strict payload-free value is bound
back to the key digest. Installation double-scans all reserved artifacts, writes only the candidate's exact key,
reads it back, and double-scans again. A second durable transaction revalidates the session, plan, legacy runtime
mode, predecessor pointer, inactive target, and exact physical identity before recording `installed` and allowing
source recapture to continue. A competing, malformed, unsupported, multiple, unreadable, or changing artifact
set stops activation without overwriting or deleting another key. The marker is restrictive metadata only; it
never claims that activation succeeded. Every legacy Notes replacement/removal path consults the complete scan,
including IndexedDB save/delete/clear,
localStorage replacement/removal, persistence migration, and the synchronous Notes storage bridge. IndexedDB
replacement rechecks the marker before clear and before each put, fencing stale in-process operations. Because
localStorage is shared by same-origin tabs, other tabs observe reserved artifacts synchronously and reject legacy
writes. Writes are allowed only when two bounded scans observe the same empty reserved set. Any valid, foreign,
multiple, malformed, unsupported legacy shared-key, changing, or unreadable artifact set blocks writes.

If the process stops before activation, the `activating` marker intentionally remains fail-closed until the
same explicit session is resumed or safely cancelled. A final source/authority failure after fencing records
`failed_precommit_fenced`. Recovery proves that mode remains `legacy`, the pointer remains the planned
predecessor, the migration target remains inactive, target outbox/checkpoints are empty, no restore is active,
and no competing cutover superseded the session. It then removes only the exact namespace/session/target
`activating` fence and records terminal `failed`.

Fence storage and local-v2 cannot share one transaction, so recovery is an explicit idempotent two-phase
protocol. After exact fence identity is established, the durable state advances to
`failed_precommit_releasing`; cleanup derives and removes only that identity's exact key and immediately reads
that key back. It then double-scans the complete prefix. Releasing A while B remains records A as released but
the physical vault as blocked; it is not global recovery success and B remains untouched. Terminal `failed` is
written only after a stable empty scan proves global clearance. Cleanup failure or scan ambiguity leaves the
releasing state retryable, and a crash after removal but before the terminal write resumes after reload.

Terminal `failed` recovery always scans and classifies all physical fence artifacts before returning. An empty set is
idempotent only after mode, pointer, inactive target, zero queue state, restore conflict, and competing-cutover
checks independently prove no activation commit. An exact historical fence or a newer same-session instance is
first bound as the observed late identity, then removed through its dedicated key. Foreign, malformed,
unsupported, activated, confirmed, or unbound artifacts are never removed. If another key appears while A is
removed, it remains present, the complete scan reports the vault blocked, and durable evidence distinguishes A's
release from global clearance. The K-319 epoch only advances, so release never makes pre-fence work current.
Cancellation before activation may invoke the same proof. Activated or confirmed sessions cannot be cancelled
or unfenced. After commit the marker advances to `activated` and then `confirmed`, and legacy writes remain
blocked. The legacy source is never deleted, rewritten, repaired, or marked migrated by K-326.

The old vault is not user-namespaced. The durable K-325 source-root authority identifies that physical/logical
vault, so the fence applies to that bound vault rather than guessing an account from legacy rows.

## Confirmation, cancellation, and rollback

Confirmation recaptures the unchanged legacy source and uses one read/write IndexedDB transaction to verify the
active pointer, `local_first` mode, active migration generation, sealed predecessor, exact entity count and
digest, and zero target outbox/checkpoint rows. It then changes only `activated -> confirmed`. Failure leaves
the activated graph diagnosable; it does not silently revert, repair target entities, select another generation,
or mutate the source.

Planning, preflight, and an uncommitted activating session may be cancelled. A
`failed_precommit_fenced` cancellation request uses the exact recovery proof and ends as terminal `failed`,
retaining its failure evidence. Cancellation retains the session, plan, K-325 manifest, target generation,
target entities, authority evidence, and source. Activated and confirmed sessions cannot become cancelled.

K-326 implements no automated rollback. Legacy data remains preserved as recovery evidence, but reverting after
activation requires a later separately reviewed protocol that proves no local-first mutation, outbox activity,
checkpoint advancement, source change, or generation drift. K-326 never discards post-cutover Notes.

## Outbox, network, and attachment boundaries

The activated migration generation begins with zero outbox and checkpoint rows. K-326 creates no bootstrap
mutations, claims, acknowledgements, retries, remote resurrection, checkpoint updates, pull sync, frontend
delivery runner, K-323 call, or network request. Remote bootstrap remains a future separately reviewed task.

K-325 entities retain their canonical whole-reference parser evidence. K-326 neither reparses Note content nor
moves, repairs, deletes, uploads, or verifies attachment blobs or metadata. Syntactic references do not prove
blob existence. Attachment cleanup remains a separate confirmation-gated production tool and is never invoked
by cutover.

## Production dormancy and evidence

The API is reachable only through an explicitly capability-gated `LocalDatabaseRepository` plus an exact
test/developer cutover authorization. No production store, startup path, hydration path, auth bootstrap, UI,
timer, worker, service worker, environment flag, Supabase adapter, K-323 runner, or import-time side effect calls
it. Production continues using the legacy read path until a later reviewed rollout task.

Permanent tests use fake-indexeddb, a deterministic enumerable localStorage double, synthetic Notes, and failure injection.
They cover exact activation, rollback of every activation write boundary, restart, cancellation, corruption,
source and authority races, competing sessions, restore conflicts, exact fence nonce/epoch validation,
read-back conflicts, late same-session reappearance, foreign/malformed/multiple/unsupported artifacts,
read/set and read/remove cross-tab races, bounded changing-set detection, reload recovery, legacy-write
fencing, and static dormancy.
No real-browser IndexedDB, multi-tab browser, production Supabase, or real incident data was exercised in K-326.

## Residual risks

- Legacy source and `absinthe-local-v2` remain separate databases. The persisted write fence is deliberately
  established before final source recapture and activation; an interrupted attempt remains availability-blocking
  until exact-session resume/cancellation or `failed_precommit_fenced` recovery completes.
- The opaque K-325 source root cannot cryptographically prove that an operator supplied the intended physical
  browser vault.
- Cross-tab behavior is source-proven through same-origin localStorage fencing and synthetic tests, not a real
  multi-tab browser run. Enumeration is not an atomic browser snapshot; the bounded double-scan detects a change
  during its observation window and fails closed, while every protected write performs a fresh scan.
- Production local-first hydration, remote bootstrap, attachment asset migration, and rollback remain explicit
  future rollout requirements rather than hidden K-326 behavior.
