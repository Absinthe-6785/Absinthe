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
`k326:` are rejected. The strict `local_first_cutover_session_v4` record contains a payload-free immutable plan,
bounded lifecycle evidence, and no Note title, body, metadata, attachment content, token, browser exception,
stack, or arbitrary message.

Version 4 binds one exact physical fence instance through a 128-bit random hexadecimal nonce, the monotonic
K-319 safety epoch captured for that installation, namespace, cutover session, target generation, and plan
digest. Durable fence evidence distinguishes `installing`, `installed`, `settlement_pending`, `settled`, and
`committed`. It separately records whether the exact own fence is active or settled and whether the complete
vault is operationally clear, blocked by another active fence, malformed/conflicting, or indeterminate.
Version-1, version-2, and delete-based version-3 session/fence shapes are rejected rather than synthesized or
treated as settled.

The lifecycle is:

`planned -> preflight -> activating -> activated -> confirmed`

Failures after a durable fence but before activation enter `failed_precommit_fenced`. Only an exact,
graph-validated settlement changes that state to terminal `failed`; failures before the fence enter `failed`
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
first persists that exact instance as `installing`. The K-326A/B shared key and K-326C exact-key compare/delete
protocol were both unsafe because localStorage cannot atomically compare and mutate a slot. K-326D uses two
append-only artifact classes: an exact fence under `absinthe:k326:legacy-fence:v4:` and an exact settlement under
`absinthe:k326:legacy-fence-settlement:v4:`. Both keys use the same fixed, locale-independent identity encoding
and SHA-256 suffix. Both strict canonical values bind back to their storage key and the settlement also binds the
exact fence digest. Field reordering, changed raw bytes, moved values, unknown fields, and inherited/accessor
properties are malformed evidence.

Installation double-scans all reserved artifacts, writes only a new exact fence key, reads it back, and scans
again. Historical v4 fence/settlement pairs do not block a new unique attempt; any active, malformed, orphaned,
conflicting, unsupported, unreadable, or changing evidence does. The marker is restrictive metadata only and
never claims activation succeeded. Every legacy Notes replacement/removal path consults the complete scan,
including IndexedDB save/delete/clear,
localStorage replacement/removal, persistence migration, and the synchronous Notes storage bridge. IndexedDB
replacement rechecks the marker before clear and before each put, fencing stale in-process operations. Because
localStorage is shared by same-origin tabs, other tabs observe reserved artifacts synchronously and reject legacy
writes. Operational clearance no longer means an empty physical set. It requires every discovered supported
fence to have its one exact canonical settlement, with no active fence, malformed fence/settlement, orphan,
conflict, unsupported older artifact, changing scan, or unreadable storage.

If the process stops before activation, the `activating` marker intentionally remains fail-closed until the
same explicit session is resumed or safely cancelled. A final source/authority failure after fencing records
`failed_precommit_fenced`. Recovery proves that mode remains `legacy`, the pointer remains the planned
predecessor, the migration target remains inactive, target outbox/checkpoints are empty, no restore is active,
and no competing cutover superseded the session. K-326F also runs the complete K-325 verified-evidence validator
over the current migration session, authority/root records, manifest, and exact inactive target entity set, then
requires that evidence to match the immutable K-326 plan. It then records durable `settlement_pending`, appends
the exact settlement marker, validates its read-back and the complete stable pair scan, and records terminal
`failed` only after repeating the complete K-325 and plan validation.

Fence storage and local-v2 cannot share one atomic transaction, so recovery is an explicit idempotent protocol.
The IndexedDB no-commit proof covers legacy mode, predecessor pointer, inactive target, exact K-325 session and
manifest, exact target entities and digests, source authority/root/binding evidence, empty target queues, restore
exclusion, and competing cutovers before the deterministic settlement write. Its transaction includes metadata,
generations, entities, outbox, checkpoints, migration state, and restore sessions. The physical write is read-back
checked and followed by a full stable scan before durable `settled` finalization. A crash before the write, after
the write, or before durable finalization retries the same canonical settlement value, but an existing exact
settlement never substitutes for current K-325 evidence validation. No normal recovery path deletes or overwrites
fence/settlement evidence, and K-326D performs no garbage collection.

K-326E makes that settlement mutation repository-mediated. `recoverySafetyPolicy` exposes only a pure canonical
artifact builder; it has no exported physical settlement writer. Generic cutover authorization can enter the
repository recovery operation, but cannot append settlement evidence. After the repository has re-read and
validated the exact `failed_precommit_settling` graph in its serialized `migration_state` read/write transaction,
`localFirstCutover` mints a private one-shot authority. The authority is an object branded by a module-private
symbol and registered by identity in a private `WeakMap`; no authority type, issuer, registry, or physical writer
is exported.

The private binding covers namespace, cutover session, plan digest, attempt, durable session timestamp, target,
expected predecessor, exact fence identity and storage digest, a canonical fingerprint of the freshly validated
K-325 evidence, expected `legacy` mode, and the single `precommit_settlement` purpose. The exact physical fence
and any existing settlement are checked before minting, and the authority is consumed before the first physical
mutation. Plain objects, copied fields, JSON, another process/repository instance, another
session/target/fence/evidence graph, or replay cannot create a registry entry. A storage failure consumes the
authority; retry requires a fresh durable graph proof and a newly minted authority. Capabilities are never
persisted, returned, logged, or passed to UI/application services.

Settlement and activation for an exact session serialize through the same IndexedDB read/write store transaction.
The allowed graph requires coherent legacy mode and predecessor pointer, an inactive exact verified target, zero
target outbox/checkpoint state, no active restore or competing cutover, unchanged K-325 session,
source/authority/root/binding/manifest evidence, the exact target entity set and digests, an uncommitted session,
`settlement_pending`, and the exact valid v4 fence. Immediately after append and read-back, the repository re-runs
the shared K-325 validator, reasserts the K-326 plan binding, and revalidates the complete no-commit graph in that
same transaction before recording durable `settled`; a changed graph fails closed without deleting the append-only
evidence. On restart, a corrupt target, manifest, session, or authority continues to block finalization even when
the exact settlement already exists. There is no repair or rollback. Activated, confirmed, committed, local-first,
restored, divergent, malformed, or ambiguous graphs cannot mint or complete settlement authority.

Physical `operationally_clear` remains only a structural storage classification. It is not semantic authorization
to write legacy Notes. The synchronous legacy guard cannot safely query IndexedDB runtime mode, so it deliberately
remains fail-closed whenever any K-326 fence or settlement history exists, including a structurally all-settled
history. This is a conservative availability limitation: an explicit future protocol may combine an asynchronously
validated durable `legacy` mode capability with the physical scan. It ensures a forged or manually copied
post-commit settlement can never override `local_first` mode or revive legacy writes. With no K-326 artifact,
pre-cutover production behavior remains unchanged.

Terminal `failed` recovery always reconstructs the exact v4 fence/settlement relation from storage. The original
fence remains present, so observing it after restart is the normal settled-own state rather than reappearance or
foreign ownership. A second nonce/epoch is a separate fence requiring its own settlement. Orphan settlements,
mutated values, unsupported v1/v2/v3 evidence, and foreign active fences remain fail-closed and are never repaired
or deleted. The K-319 epoch only advances, so settlement never makes pre-fence work current.
Cancellation before activation may invoke the same proof. Activated or confirmed sessions cannot be cancelled
or settled as precommit failure. Successful activation retains its active fence without a settlement; local-first
runtime mode independently keeps legacy writes blocked. A settlement observed with committed activation is an
impossible fail-closed graph, never a rollback signal. The legacy source is never deleted, rewritten, repaired,
or marked migrated by K-326.

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
canonical fence/settlement binding, same-key mutation, orphan and conflicting evidence, historical settled pairs,
multiple active fences, unsupported delete-based artifacts, bounded changing-set detection, reload recovery,
legacy-write fencing, append-only operation history, private settlement API reachability, post-commit settlement
bypass denial, post-append mutation, one-shot/restart settlement recovery, and static dormancy.
No real-browser IndexedDB, multi-tab browser, production Supabase, or real incident data was exercised in K-326.

## Residual risks

- Legacy source and `absinthe-local-v2` remain separate databases. The persisted write fence is deliberately
  established before final source recapture and activation; an interrupted attempt remains availability-blocking
  until exact-session resume/cancellation or `failed_precommit_fenced` settlement completes.
- Append-only v4 fence and settlement artifacts accumulate. K-326D intentionally includes no cleanup, compaction,
  or garbage collection.
- The opaque K-325 source root cannot cryptographically prove that an operator supplied the intended physical
  browser vault.
- Cross-tab behavior is source-proven through same-origin localStorage fencing and synthetic tests, not a real
  multi-tab browser run. Enumeration is not an atomic browser snapshot; the bounded double-scan detects a change
  during its observation window and fails closed, while every protected write performs a fresh scan.
- Process-local settlement authority assumes the private module instance and JavaScript object identity remain the
  authority boundary. Restart intentionally loses every authority and performs a fresh durable graph validation.
- Structural all-settled history remains availability-blocking to synchronous legacy writers because they cannot
  atomically consult the IndexedDB runtime graph. No reviewed durable legacy-mode permit exists in K-326E.
- Production local-first hydration, remote bootstrap, attachment asset migration, and rollback remain explicit
  future rollout requirements rather than hidden K-326 behavior.
