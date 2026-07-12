# K-322 Transactional Outbox and Local Mutation Contract

K-322 extends the dormant `absinthe-local-v2` database with durable local mutation and outbox
lifecycle semantics. It does not deliver mutations, contact Supabase, run a background worker, or
activate the database in production.

## Database and upgrade

- IndexedDB name: `absinthe-local-v2`
- Database version: `2`
- Persistence schema version: `1`
- Version 2 retains every version-1 store and record, updates only the database-format metadata, and
  adds outbox indexes for status/availability, status/lease expiry, and entity/revision ordering.
- No database, store, entity, or outbox record is cleared or deleted during upgrade.

## Mutation identity and atomicity

`commitLocalMutation` is the K-322 mutation boundary. It accepts an explicit create, update, or
tombstone plus a caller-supplied deterministic clock value. It verifies the active generation and
current entity revision, derives the next entity envelope, mutation ID, idempotency key, operation,
revision relationship, and inline payload, then adds the entity and outbox record in one IndexedDB
transaction. The promise resolves only after `transaction.oncomplete`; any validation, collision,
request, or generation failure aborts both writes.

Mutation IDs are locally generated UUID identities prefixed with `mut.` and are never timestamp-only.
The deterministic idempotency key is a SHA-256 digest of an unambiguous encoding of a version marker,
namespace fingerprint, generation, domain, entity ID, local revision, and operation. Payload content is not
included. Revisions, operations, namespaces, and generations therefore produce distinct keys, and
persisted keys are recomputed during validation.

## Status state machine

The persisted states are `pending`, `claimed`, `retry_wait`, `acknowledged`, `permanent_failure`, and
`superseded`. Repository methods permit:

- `pending -> claimed`
- `retry_wait -> claimed`
- expired `claimed -> claimed` only when explicit lease recovery is requested
- `claimed -> retry_wait`
- `claimed -> acknowledged`
- `claimed -> permanent_failure`
- `permanent_failure -> pending` only through `resetPermanentFailure`

Acknowledged, superseded, and permanent-failure records are not normally claimable. Acknowledged
records are retained. No physical outbox deletion API or generic status assignment API exists.

## Claims and leases

`claimNextMutations` uses one read-write transaction across authoritative metadata, generations, and
the outbox. It takes a bounded batch size, safe ephemeral worker ID, explicit current time, and lease
duration. Eligible pending/retry records must be available at that time. Claims set the lease owner
and expiry, update `lastAttemptAt`, and increment `attemptCount` exactly once. IndexedDB transaction
serialization prevents two workers from claiming the same mutation. Expired leases remain blocked
unless `recoverExpiredClaims` is explicitly true.

Worker IDs identify an ephemeral process only. They are not user, device-owner, authentication,
cookie, token, or authorization identities and cannot change namespace or generation scope.

## Retry, acknowledgement, and failure

Transient retry delay is:

`min(maxDelayMs, baseDelayMs * 2^(attemptCount - 1))`

The exponent is safely bounded and the maximum delay is capped by caller input, itself limited to 30
days. Retry clears lease fields, retains identity/payload/attempt count, records a bounded safe error
code, and sets `availableAt`. It schedules no timer.

Acknowledgement requires the matching claimed lease owner. It records `acknowledgedAt` and the safe
ephemeral acknowledging worker identity, optionally
stores a bounded safe remote mutation reference, clears lease/error fields, and never changes the
entity. An exact repeat with the same acknowledgement timestamp and remote reference is idempotent;
a conflicting repeat fails. Permanent failure likewise requires the matching claim, retains the
record and payload, and requires a safe error code. Explicit reset clears the error and makes the
record pending immediately without resetting attempt count.

## Ordering and queries

Ordering authority is namespace, generation, domain, entity ID, and local revision. Timestamps never
select a winner. Every scoped scan validates records and requires a contiguous revision chain
beginning at revision 1; missing sequences fail with `OUTBOX_SEQUENCE_GAP`. At most one next
unsettled mutation per entity is claimable, while unrelated entities may progress independently.

Typed, bounded queries cover one mutation, status/entity lists, status counts, and next deliverable
mutations. All current queue queries are active-generation fenced and strict: one malformed record
fails the entire result. A scan safety ceiling prevents an unbounded canonical `getAll`.

## Compaction policy

Automatic compaction is deferred for safety. K-322 exposes no compaction, supersession, cleanup, or
physical deletion primitive. The `superseded` persisted shape is validated and reserved for later
explicit work, but K-322 cannot produce it. This avoids skipping acknowledged, claimed, failed, or
non-contiguous predecessors.

## Corruption, privacy, and dormancy

Persisted validation covers identity consistency, operation/payload/revision relationships, every
status-specific required and forbidden field, timestamps, scheduling, attempts, leases,
acknowledgement, failure, and supersession metadata. Corruption is never normalized or skipped and is
reported as `CORRUPT_PERSISTED_RECORD` without payload or raw namespace values.

The capability gate remains mandatory. K-322 has no production imports, network calls, Supabase or
auth dependency, timers, worker loop, service-worker registration, legacy database/localStorage
mutation, restore/import, checkpoint advancement, recovery-mode bypass, UI, or remote conflict logic.
K-323 may consume these scoped repository primitives, but delivery behavior requires separate design,
review, and activation.
