# Local Recipe Workers/D1 feasibility — INFRA-FREE-TIER-TRANSITION-01

Recommendation: keep the existing PostgreSQL product path for near-term recovery. If a database move becomes necessary, evaluate a PostgreSQL-preserving route first. D1 passed the representative local contract, not production compatibility or migration readiness.

## Reproduce

From this directory with Node 22+:

```text
npm ci
npm test
npm run measure
```

`npm ci` retrieves packages from the registry; after that, tests and measurement run locally, with Miniflare's Cloudflare request-metadata fetch disabled. Miniflare runs the Worker on loopback, uses an ephemeral D1 binding, and dispatches only synthetic identities to a reserved `.invalid` fixture origin. There is no deploy configuration, real auth, remote binding, or production data access. One fixture uses two distinct client tokens sharing one owner and a third token with a different owner. Tests cover an explicit stale draft, racing CAS, lost response after a real commit, a real SQLite trigger abort and injected contradictory write acknowledgements. The HTTP client in the test retains its draft; the production React/IndexedDB client was not wired to this worker.

## Measurements

The reference uses embedded PostgreSQL with a minimal synthetic table, the repository's two Recipe migrations, and the SQL operation sequence in `backend/main.py`. It is not a running FastAPI/PostgREST benchmark. The same records, ownership, and active/trash mix feed Miniflare D1 and PostgreSQL. The script asserts exact list equality after timestamp normalization, success/conflict payload equality apart from random next revisions, and D1 indexed/unindexed equality.

| Scenario | PostgreSQL path | D1 path | JSON response |
| --- | ---: | ---: | ---: |
| List, 100 total / 45 visible | 1 query; 100 executor rows | 1 query; 145 → 46 rows read with index | 17,797 B |
| List, 500 total / 225 visible | 1 query; 500 executor rows | 1 query; 725 → 226 rows read with index | 89,152 B |
| Acknowledged PATCH (all editable fields) | 2 queries | 1 query; 2 read, 1 written | Equal |
| Stale PATCH (exact winning row) | 3 queries | 2 queries; 3 read, 0 written | Equal |

One API request per operation in both paths (modeled at the application boundary for PostgreSQL). PostgreSQL executor rows and D1 metadata counters are not the same metering unit. D1 timings include local HTTP dispatch and serialization; PostgreSQL timings are embedded SQL-path only, and neither predicts hosted latency or Worker CPU. Worker source/gzip sizes appear in the measurement output; Miniflare and PGlite are dev-only. Hosted cold start, throughput, recovery, and real account usage remain unknown.

The main savings are a partial active-list index (499 fewer D1 reads at 500 rows; no change in payload) and one fewer ownership round trip via an owner-bound conditional mutation. The second saving does not require D1: PostgreSQL could use the same predicate and RETURNING if the API contract permits not-found for another owner's ID. Current FastAPI can return 403 for that case; this prototype deliberately returns 404, with no conflicting record disclosed. There is no API request or payload saving. An illustrative day of 100 indexed lists at 500 total rows, 100 successful edits and 10 conflicts would use 210 Worker requests, approximately 22,830 D1 reads and 100 writes in these fixtures, before any other traffic or hosted metering differences.

## Free-tier choices

- Workers/D1: 100,000 Worker requests/day, 10 ms CPU per invocation on Free; D1 Free includes 5M reads and 100k writes/day, 500 MB per DB, 5 GB total, 50 queries per invocation and 7 days of Time Travel. This is quota, not a guarantee of production CPU fit or independent backup. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) · [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- Neon: Free includes 100 CU-hours/month per project, 1 GB/project, 5 GB public transfer/month/project, scale-to-zero at 5 minutes, up to 6 hours of history (1 GB of changes), one manual snapshot and no scheduled backups. Auth and API hosting are still separate integration work even though PostgreSQL SQL/types survive. Existing Render Free hosting has its own idle behavior (15 minutes), distinct from database wakeup. [Neon plans](https://neon.com/docs/introduction/plans) · [Render Free](https://render.com/docs/free)
- Current Supabase Free: 500 MB database, 50k Auth MAU, 5 GB egress, 1 GB file storage, inactivity pause; no scheduled DB backups or PITR. It preserves the current account and database contracts but needs independently verified logical backups. [Supabase pricing](https://supabase.com/pricing) · [Backups](https://supabase.com/docs/guides/platform/backups)

## Future cutover gates, not implemented

1. First obtain a complete source export and verify restore in isolation. A hosted Time Travel claim is not a substitute for a portable recovery copy. No production export or restore was attempted here.
2. Use existing Auth initially; preserve verified account UUIDs and the current issuer, expiration, signing mode and session checks. A hosted adapter must validate provider credentials with the appropriate asymmetric JWKS or server-side provider validation for legacy signing, and never trust ownership from request bodies. Scope all reads and writes independently; D1 does not inherit PostgreSQL RLS. [Supabase JWT guide](https://supabase.com/docs/guides/auth/jwts)
3. Prove lossless mapping for exact IDs, owners/FKs, date semantics, booleans, uniqueness, favorite-only operations, tombstones/restores, history and backups. The prototype uses ISO text timestamps, UUID text, and integer booleans, has strict fixture validation (not the full Pydantic coercion/error format), and adds an exact-ID read endpoint. It does not provide trash restore, atomic favorite-only operations or legacy backup import/export; every mutation that can change the live row must rotate revisions. D1 row/text limits and list pagination must be qualified without silently truncating client results.
4. Rehearse one-authority cutover and reversible routing with a stop-write window, exact source-to-target reconciliation, old client/draft handling, and independent backups. Do not send writes to both stores. Once writes are accepted in the target, fail back only after reconciling those writes; never silently resume on a stale source. Validate authenticated two-device readback on the primary before considering replicas. Health, Notes, and frontend authority are untouched and have no migration result from this prototype.
