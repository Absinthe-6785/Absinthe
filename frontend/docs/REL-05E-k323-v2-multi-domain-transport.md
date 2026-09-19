# REL-05E K-323 v2 multi-domain transport

REL-05E establishes a dormant authenticated transport and adapter boundary. It
does not change production Notes or Health persistence, start a worker, or make
any new domain authoritative.

## K-323 v1 characterization

The existing `POST /api/sync/v1/mutations` path is Notes-only and disabled by
default. FastAPI verifies the Supabase JWT locally and passes only the verified
`sub` owner plus server-configured project scope to one
`apply_remote_note_mutation_v1` RPC. PostgreSQL serializes owner/project-scoped
idempotency, mutation, and entity identities with transaction advisory locks,
checks an explicitly provisioned active generation, applies Notes CAS, and
records an immutable receipt in the same statement transaction. Exact replay
returns the stored receipt; conflicting replay identities fail closed.

The reusable invariants are authenticated owner authority, account-scoped
identity uniqueness, one-transaction entity/receipt execution, deterministic
request binding, immutable receipts, and response-loss-safe exact replay. The
v1 limitations are its Notes-specific payload/table/RPC, absence of pull and
restore contracts, and coupling of local revision to remote revision.

No production frontend code calls the v1 route. Its feature flag remains
disabled by default.

## V2 bounded domains and dormancy

V2 adds these explicitly allowlisted reference handlers:

- `reference_alpha`: `{ id, label, ordinal }`
- `reference_beta`: `{ id, metric, value, observedAt }`

They exist to prove multi-domain dispatch without creating production Notes or
Health authority. Unknown domains and unsupported operations fail before RPC.
The route is `POST /api/sync/v2/mutations`; pull is
`GET /api/sync/v2/changes`. Both require JWT authentication and the separate
`K323_V2_TRANSPORT_ENABLED=enabled` flag, which defaults to disabled.

No App, Notes, Health, startup, focus, online, timer, or worker path constructs
the v2 client. Exporting the pure contracts and client factory does not activate
transport.

## Mutation and replay contract

The request binds protocol version, durable mutation and idempotency identities,
namespace, generation, device, allowlisted domain, entity, explicit operation,
server base revision, local bookkeeping revision, canonical payload,
`payloadHash`, and creation time. Account identity is never accepted from the
body.

The server independently verifies:

- canonical payload SHA-256;
- REL-05D `absinthe-outbox-v2` idempotency identity;
- REL-05D `absinthe-mutation-v2` mutation identity;
- owner/project-bound request digest;
- domain-specific record shape and operation/payload relationship.

The wire canonical contract accepts null, strings, booleans, arrays, objects,
and JavaScript-safe integers. Object keys are sorted, array order is retained,
and floats, non-finite numbers, unsupported values, secret-bearing keys, and
token-shaped strings fail closed. The shared golden vectors in
`protocol/k323-v2-identity-vectors.json` run in frontend and backend tests.

`baseRevision` is the remote server CAS revision. `localRevision` is carried
only for client bookkeeping and replay identity. PostgreSQL advances
`serverRevision` from remote state, never from `localRevision` or timestamps.

`restore` is explicit. It requires an existing tombstone at the supplied server
base revision and creates the next server revision. A tombstone retains the
last record and revision history; absence is never interpreted as deletion.

## Durable storage and pull contract

Migration `202609180001_k323_v2_multi_domain_transport.sql` reuses the existing
owner/project-scoped immutable `remote_mutation_receipts` ledger. It adds v2
protocol/device/change metadata and broadens its checks only for the two
reference domains and explicit restore operation. Existing v1 rows retain
`protocol_version = 1`.

The migration adds three isolated reference-only objects:

- `remote_reference_entities_v2`: current revisioned reference state;
- `remote_reference_changes_v2`: append-only logical change stream;
- `remote_reference_streams_v2`: owner/project server epoch and retention floor.

The mutation RPC performs generation fencing, CAS, entity/tombstone/restore
write, change append, and immutable receipt insertion in one transaction.
Owner/project/domain/entity and replay identities are advisory-locked. Tables
use RLS, and an immutable trigger makes the change log append-only. Only the
service role may execute the RPCs. The RPCs run as
`SECURITY INVOKER`; explicit least-privilege grants cover only their required
table and sequence operations. Receipt reads rely on the existing deterministic
idempotency/mutation advisory locks and therefore do not require row-update
privilege. Mutation and pull generation reads hold a shared advisory lock; a
generation status-change/delete trigger takes the matching exclusive lock so a
generation cannot become stale concurrently after an operation passes its
fence. A per-owner/project stream lock serializes
change-sequence allocation through commit so a pull cursor cannot skip a late
commit with an earlier sequence.

Pull responses contain ordered sequence values, a next cursor, server epoch,
retention floor, domain/entity identity, explicit operation, remote revision,
tombstone state, record snapshot, and immutable remote mutation reference. An
epoch mismatch or cursor below the retention floor returns
`full_resync_required` with no changes. This signal never means “clear the local
database.”

## REL-05D adapters

The dormant frontend module provides pure mappings for:

- durable outbox plus explicit server base revision to v2 mutation request;
- fully bound applied receipt to REL-05D acknowledgement input;
- validated pull page to one REL-05D atomic remote entity/checkpoint batch.

The response context captures account, namespace, generation, device, and
domain. Any mismatch with the currently active scope fails before local
acknowledgement or remote-batch construction. Repeated changes for one entity in
a page collapse to the latest ordered server state so the REL-05D batch retains
one CAS entry per entity while advancing the matching checkpoint.

Network failure after sending a mutation is represented as an ambiguous
response. This includes a bound retryable HTTP 5xx returned when the backend
cannot know whether its database RPC committed. The caller must replay the
identical durable request; it must not infer that the server failed or mint a
new identity. Bound deterministic 409 responses remain ordinary protocol
receipts.

## Deferred production work

REL-05E deliberately does not provide production Notes or Health handlers,
data migration, outbox draining, automatic lifecycle triggers, global sync UI,
Health routine aggregates, Notes cutover, or full-snapshot reconciliation.
Production domain handlers require their own authority and convergence reviews
before being added to the allowlist.
