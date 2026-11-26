# Local Recipe Workers/D1 — integration preparation

## Product-path QA (CLOUDFLARE-INTEGRATION-PREP-01)

`integration-worker.mjs` is a Workers module entry point. It reuses the Recipe
handler and `schema.sql` from #957, but accepts only synthetic ES256 tokens.
The token issuer is reserved for the fixture; audience/role must be
`authenticated`, the subject must be a canonical UUID, and the Worker verifies
the signature and token lifetime against the configured fixture public key.
The initiating QA account header can only veto a mismatch with the signed
subject. Reads and writes also check the initiating app session at dispatch
and after the response is decoded, without changing production account
authority. QA requests reject redirects rather than following another origin.
It is loopback-only even with the test binding; no hosted verifier or
production resource bindings are present. The historical `worker.mjs`
entry remains the separate, synthetic measurement runner.

To run the supported local QA on Node 22.12+ (verified with Node 24):

```text
cd prototypes/recipe-d1-local
npm ci
npm test
npm run measure
cd ../../frontend
npm ci
npm test -- --mode recipe-worker-qa
```

The mounted QA starts Vite at `127.0.0.1:5177` and Workerd/D1 at
`127.0.0.1:8787`. It generates its own key and tokens and uses an ephemeral
D1 database. The test substitutes only synthetic session/presentation seams
and drives the actual RecipeView, authenticated request helper, SWR, draft
storage and Vite HTTP proxy. Ports must be free. This is not a browser sign-in
or a real-device test.

Normal dev and production builds do not route to this Worker. An explicit
`vite --mode recipe-worker-qa` run binds only to the separate QA origin and
forwards only `/api/recipes` and its children; every other API path has no
backend proxy. Normal `.env` files and `VITE_*` variables are not used in that
mode. Do not point a browser session at a real account: interactive QA would
need a separate local Auth fixture at `127.0.0.1:54321` signing the fixture
issuer and a matching synthetic public key in the Worker. No such sign-in
service is installed by these commands. The QA mode cannot be built or used
as a preview build.

`wrangler.jsonc` is for local tooling only. With an existing Wrangler
installation, initialize its local D1 using
`wrangler d1 execute DB --local --file schema.sql` once, and use
`wrangler dev --local` with `RECIPE_QA_PUBLIC_JWK` in an ignored local
`.dev.vars` file. Configure the exact key ID of the synthetic signer. No
Cloudflare login, hosted resource ID, production secret or `--remote` is
needed for this workflow. The checked-in binding ID is a placeholder, not
a hosted database. The automated evidence uses Miniflare, not a hosted
Worker. [Cloudflare D1 local mode](https://developers.cloudflare.com/d1/best-practices/local-development/)
· [Supabase JWT contract](https://supabase.com/docs/guides/auth/jwts).

The compatible routes are active list, exact-ID retrieval, create, conditional
PATCH, read-only trash and favorite-only PUT. Legacy content PUT remains 428;
stale edits return 409 with the winning row only to its owner; foreign
identities return 404. Soft-delete and restore remain unsupported. Confirmed saves and conflict
drafts use the unchanged Recipe product path. An unknown write response is
not retried automatically; inspect readback before a manual retry. In
particular, create has no idempotency receipt. History, recovery, pagination,
and existing backups are not qualified for cutover.

### Favorite and trash compatibility (CLOUDFLARE-RECIPE-COMPATIBILITY-01)

The favorite PUT takes an explicit boolean and updates only the active
owner's exact ID. One UPDATE … RETURNING changes the favorite and rotates
the edit revision together, even if the requested favorite is unchanged.
An editor using the old revision still receives 409. An uncertain response
is not a confirmed update; the mounted UI revalidates with GET, without an
automatic second PUT. Foreign and deleted IDs both return 404 in this QA
adapter (FastAPI can distinguish foreign IDs with 403).

Trash is read-only: it returns the full deleted rows for the signed account,
newest deletion first. The local fixture uses canonical UTC ISO timestamps
(fixed-width milliseconds); equal timestamps use an ID tie-break for stable
output, while the PostgreSQL API does not specify tie order. There is no
import or deletion writer here. Timestamp conversion and precision for real
data still need qualification.

Run `node measure-compatibility.mjs` from this directory after the frontend
and prototype installs above (it uses the pinned frontend esbuild and #961
merge-base source). Results for identical synthetic rows:

| Operation | Reference | Candidate | JSON bytes |
| --- | --- | --- | --- |
| Favorite PUT, both fixture sizes | 2 queries / 3 reads / 1 write | 1 query / 2 reads / 1 write | 336 → 336 |
| Trash, 100 total / 5 visible | 105 reads; 1 query, 0 writes | 6 reads; 1 query, 0 writes | 1,805 → 1,805 |
| Trash, 500 total / 25 visible | 525 reads; 1 query, 0 writes | 26 reads; 1 query, 0 writes | 9,040 → 9,040 |

The favorite reference is the two-statement ownership pre-read plus update
on the same local D1, not a PostgreSQL row-metering comparison. One HTTP
request is still sufficient in each path. With the partial trash index,
SQLite searches by owner and returns in deletion order without the full
scan or temporary sort. The index stores one entry per deleted row; future
delete/restore operations would have to maintain it. Favorite writes
remained at one metered row on both fixture sizes. The signed Worker bundle
grew from 4,632 to 5,815 bytes (gzip: 2,243 to 2,605), same esbuild 0.25.12
configuration. These are local operation and size measurements, not hosted
latency or workload predictions.

The signed Worker suite and the opt-in mounted `recipe-worker-qa` suite
are local checks; default hosted CI does not run either. No CI workflow or
production frontend files were changed for this compatibility work.

### Matched measurements

Rerun of the existing #957 synthetic harness on the shared handler:

| Operation | Before | With the shared D1 path | Requests and JSON |
| --- | --- | --- | --- |
| Active list, 100 seeded rows | 145 D1 reads without index | 46 D1 reads with index | 1 API, 1 query; 17,797 B unchanged |
| Active list, 500 seeded rows | 725 D1 reads without index | 226 D1 reads with index | 1 API, 1 query; 89,152 B unchanged |
| Confirmed PATCH | 2 PostgreSQL reference queries | 1 D1 query | 1 API; 321 B unchanged |
| Stale PATCH | 3 PostgreSQL reference queries | 2 D1 queries | 1 API; 374 B unchanged |

These are measured benefits carried forward, not new savings beyond #957.
The list and save JSON shapes are unchanged; fixture metrics headers are not
on the signed QA entry. With matched esbuild 0.25.12 Vite-toolchain options
(bundle, minify, ESM, ES2022), the #957 Worker was 3,337 B (1,624 B gzip);
the #961 baseline signed entry was 4,632 B (2,243 B gzip). The increase is the local auth
boundary; there are zero runtime package dependencies. Neither the counter
results nor local timings establish hosted performance.

The next separately approved step is a **synthetic staging-only connection
with the existing Auth provider contract**, including issuer/key rotation and
session lifetime tests, bounded list/body size and explicit staging binding.
Do not move product writes or production records until unsupported Recipe
features, independently verified backup/restore, and a single-authority
cutover/reconciliation exercise have passed.

## Historical scope — INFRA-FREE-TIER-TRANSITION-01

Recommendation: keep the existing PostgreSQL product path for near-term recovery. If a database move becomes necessary, evaluate a PostgreSQL-preserving route first. D1 passed the representative local contract, not production compatibility or migration readiness.

## Reproduce

From this directory with Node 22+:

```text
npm ci
npm test
npm run measure
```

`npm ci` retrieves packages from the registry; after that, tests and measurement run locally, with Miniflare's Cloudflare request-metadata fetch disabled. The original prototype uses an ephemeral D1 binding and dispatches synthetic identities to a reserved `.invalid` fixture origin. Its HTTP-only tests cover an explicit stale draft, racing CAS, lost response after a real commit, a real SQLite trigger abort and injected contradictory write acknowledgements. That prototype alone did not wire the React client.

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
3. Prove lossless mapping for exact IDs, owners/FKs, date semantics, booleans, uniqueness, tombstones/restores, history and backups. The prototype uses ISO text timestamps, UUID text, and integer booleans, has strict fixture validation (not the full Pydantic coercion/error format), and adds an exact-ID read endpoint. It does not provide delete/restore mutations or legacy backup import/export; every mutation that can change the live row must rotate revisions. D1 row/text limits and list pagination must be qualified without silently truncating client results.
4. Rehearse one-authority cutover and reversible routing with a stop-write window, exact source-to-target reconciliation, old client/draft handling, and independent backups. Do not send writes to both stores. Once writes are accepted in the target, fail back only after reconciling those writes; never silently resume on a stale source. Validate authenticated two-device readback on the primary before considering replicas. Health, Notes, and frontend authority are untouched and have no migration result from this prototype.
