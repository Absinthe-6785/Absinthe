# K-323 Idempotent Remote Mutation API

K-323 adds a dormant authenticated server boundary for applying one K-322 Notes outbox mutation.
It does not claim local outbox records, run synchronization, advance checkpoints, pull remote data,
acknowledge local records, or activate the new persistence path in production.

## Runtime and route

- Runtime: FastAPI with the existing local Supabase JWT verifier and `supabase-py` client.
- Route: `POST /api/sync/v1/mutations`.
- Protocol: version `1` only.
- Production gate: `K323_REMOTE_MUTATION_ENABLED` defaults to `disabled`.
- Authoritative project scope: `K323_PROJECT_SCOPE` is server configuration, never a body field.
- Database authority: `SUPABASE_SERVICE_ROLE_KEY` is read only by the dormant backend route and is
  required because the RPC is not executable by public, anonymous, or authenticated client roles.
- Request ceiling: 256 KiB by `Content-Length`; canonical payload ceiling: 128 KiB.
- Existing CORS policy applies. The repository has no general rate limiter to reuse.

The route verifies the bearer token locally and obtains the authoritative owner from its `sub`
claim. Body-supplied owner, project, access token, lease, attempt, queue status, or checkpoint fields
are rejected as unknown fields. Namespace fingerprint and generation ID are routing/fencing metadata,
not authorization credentials.

## Request contract

The exact request fields are:

- `protocolVersion`, `mutationId`, and `idempotencyKey`
- `namespaceFingerprint` and `generationId`
- `domain` (`notes` only), `entityId`, and `operation` (`upsert` or `tombstone`)
- `baseRevision`, `localRevision`, `payload`, and `createdAt`

Notes snapshots use the current `NoteBase` shape with bounded title/body/metadata and UUID entity,
folder, and relation identifiers. Snapshot `record.id` must equal `entityId` and must be live.
Tombstones must match both entity ID and local revision. Revisions use JavaScript-safe positive
integers; create is `null -> 1`, and later mutations are exactly `N -> N+1`. Timestamps must be
timezone-qualified ISO values. Unknown protocol versions, fields, domains, operations, unsafe
integers, malformed payloads, revision gaps, and purge semantics fail before RPC invocation.

## Idempotency and canonical request digest

The server independently recomputes the K-322 key as SHA-256 over the compact JSON array:

```text
[
  "absinthe-outbox-v1",
  namespaceFingerprint,
  generationId,
  domain,
  entityId,
  localRevision,
  operation
]
```

The received `k322.<sha256>` value must match. The repository fixture
`protocol/k323-idempotency-vectors.json` is executed by both frontend and backend tests.

The receipt request digest separately covers protocol version, authoritative owner and project,
namespace, generation, domain, entity, mutation ID, operation, both revisions, and a canonical
payload digest. Canonical payload objects sort keys; arrays retain order; omitted optional Note
fields normalize to explicit null; strings, booleans, safe integers, arrays, objects, and null are
supported. Undefined values cannot appear in JSON. Floating and non-finite numbers are rejected to
avoid cross-runtime ambiguity. Raw payloads are not stored in receipts.

## PostgreSQL migration and storage

Migration `backend/migrations/202607120001_k323_idempotent_remote_mutation.sql` is additive and
transaction-wrapped. It:

- adds nullable `sync_revision`, `sync_namespace_fingerprint`, `sync_generation_id`, `sync_project_scope`, and
  `last_remote_mutation_ref` columns to existing Notes rows;
- adds missing optional Notes metadata columns without backfilling payloads;
- creates `remote_sync_generations` for explicit server-side generation acceptance;
- creates immutable `remote_mutation_receipts` with owner/project-scoped unique mutation and
  idempotency identities;
- stores payload/request digests and a bounded acknowledgement payload, never Note content;
- enables RLS on both new tables and grants the mutation RPC only to `service_role`.

Existing Notes rows remain readable and are not rewritten. Their nullable sync metadata is not
fabricated: a pre-existing row without a K-323 receipt/revision cannot be treated as already applied.
No migration in K-323 provisions or activates a generation. An administrator must pre-provision the
accepted generation through a separately reviewed operational procedure before enabling the route.

The repository did not previously contain a migration runner or Supabase migration directory.
Therefore this migration is delivered as a manual, reviewable PostgreSQL/Supabase artifact and was
not executed against production or a remote project in K-323.

## Transaction and revision contract

The FastAPI service performs one `apply_remote_note_mutation_v1` RPC. PostgreSQL executes the RPC
function as one statement transaction. Transaction-scoped advisory locks serialize the owner/project
idempotency key, mutation ID, and entity. The function then:

1. validates its trusted-server parameters defensively;
2. returns an immutable exact receipt when mutation ID and request digest match;
3. rejects conflicting idempotency or mutation-ID reuse;
4. locks and validates the accepted generation;
5. locks the Notes row and enforces owner/project/generation/revision state;
6. applies one create, update, or tombstone without physical deletion; and
7. inserts the immutable receipt before transaction commit.

Any entity or receipt error aborts the whole PostgreSQL transaction. PostgREST returns the function
result only after transaction completion. The backend never emulates atomicity with multiple table
requests and never acknowledges based only on the entity's current revision.

- Create requires no row, `baseRevision = null`, and `localRevision = 1`.
- Update requires a live same-owner/project/generation row at `baseRevision`.
- Tombstone has the same CAS requirement and sets `deleted_at`; it never deletes the row.
- Tombstoned rows cannot be updated or resurrected.
- Missing receipts at an apparently matching remote revision remain conflicts.

## Duplicate and conflict behavior

The first successful application stores and returns `outcome: applied`. An exact retry returns that
same stored response, including the original remote reference and committed timestamp, without
another entity write. The server intentionally does not rewrite the outcome to `already_applied`.

- Same idempotency key with a different mutation ID or request digest:
  `IDEMPOTENCY_CONFLICT`.
- Same mutation ID with different semantics: `MUTATION_ID_CONFLICT`.
- Same-base competing requests: at most one entity write. When the K-322 tuple is identical but the
  payload differs, `IDEMPOTENCY_CONFLICT` is the more specific result; otherwise the loser receives
  revision/tombstone/generation conflict.
- Sequential `N -> N+1` requests may apply; gaps fail.

## Generation and ownership

`remote_sync_generations` is keyed by authenticated owner, server project scope, namespace
fingerprint, and generation ID. Only `active` is accepted. Missing and stale values return
`UNKNOWN_GENERATION` and `STALE_GENERATION`. The endpoint cannot create, activate, merge, or migrate
generations. Cross-generation revision continuation is rejected.

Notes rows retain the namespace fingerprint as well as the generation ID, so a different device
namespace cannot continue a revision merely by reusing the same generation label.

The SQL function is callable only through the trusted service-role backend boundary. It receives the
owner resolved from the verified bearer token and still checks every Notes row's `user_id`. The
service-role key is never returned or referenced by frontend code. Cross-owner row existence returns
the same not-found result used for an absent row.

## Response and retryability

Responses contain only protocol version, outcome, mutation/idempotency identities, remote mutation
reference, applied revision, committed timestamp, bounded error code, and retryability.

- `applied`: stable success, non-retryable because exact replay is already safe.
- `revision_conflict`: permanent until explicit reconciliation; not blindly retryable.
- `rejected`: validation, ownership, generation, tombstone, or identity conflict; non-retryable.
- `TRANSACTION_FAILED`: HTTP 503 and `retryable: true`; no SQL detail or stack is returned.

No response, receipt, or K-323 log contains Note title, body, properties, relations, token, cookie, or
session data.

## Evidence and limitations

Python tests cover validation, exact retries, conflicts, owner/generation fences, synthetic rollback,
concurrent duplicate/same-base behavior, privacy, endpoint gating, and single-RPC invocation. Frontend
and backend golden vectors cover the cross-language idempotency contract. Static migration checks
cover transaction wrapping, advisory locks, row locks, immutability, RLS, restricted grants, and the
absence of physical Notes deletion.

K-323 did not connect to PostgreSQL, Supabase, a browser profile, or production data. Consequently,
the migration and PL/pgSQL transaction are source-validated but not executed against a real local or
remote PostgreSQL engine in this task. Applying the migration, provisioning a test generation, and
running real PostgreSQL concurrency/rollback integration tests remain mandatory before production
enablement.

## Future boundary

K-324/K-325 may separately design a caller that claims K-322 outbox records and maps these responses
to local lifecycle transitions. K-323 contains no runner, retry loop, timer, service worker, local
acknowledgement wiring, pull synchronization, checkpoint advancement, restore/resurrection,
attachment upload, compaction, legacy migration, or production cutover.
