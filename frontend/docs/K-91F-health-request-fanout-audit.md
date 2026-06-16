# K-91F — Health Request Fan-Out Audit & Remediation

Branch: `k91f-health-request-fanout-remediation`

## Problem

Opening the Health tab triggers a burst of authenticated API calls. Each protected endpoint invokes `supabase.auth.get_user(token)` in `get_current_user()` with no caching. Under load this saturates the HTTP/2 connection to Supabase Auth and surfaces as:

```
Authentication failed: ConnectionTerminated
```

This is **transport saturation**, not JWT expiry or invalid credentials.

---

## Phase 1 — Instrumentation

Temporary logging is gated to **DEV** and **test** (`import.meta.env.DEV || MODE === 'test'`). In the browser console, filter for `[K-91F health-request]`.

| Module | Source label | Endpoint |
|--------|--------------|----------|
| `HealthView.tsx` | `HealthView.localWorkouts` | `/api/workouts/prev/{id}` |
| `HealthView.tsx` | `HealthView.healthRoutines` | `/api/workouts/prev/{id}` |
| `HealthView.tsx` | `HealthView.fetchPrevForBlock` | `/api/workouts/prev/{id}` |
| `useProteinData.ts` | `useProteinData` | `/api/protein_intake?date=` |

Each log line reports:

| Field | Meaning |
|-------|---------|
| `count` | Requests in the batch |
| `parallelism` | Configured concurrency cap (prev) or unbounded fan-out (protein) |
| `peakParallelism` | Observed max in-flight requests in the batch |
| `durationMs` | Wall-clock time for the batch |

### How to verify

1. Run `npm run dev`, open DevTools → Console.
2. Switch to the **Health** tab (workout section is default).
3. Observe `[K-91F health-request]` entries on first load and on date change.

---

## Measured / Expected Request Counts

### Static analysis (pre-remediation)

| Source | Pattern | Count (typical) | Peak parallelism |
|--------|---------|-----------------|------------------|
| App mount (`useDailyData`) | 5 parallel SWR keys | 5 | 5 |
| App mount (`useStaticData`) | 4 parallel SWR keys | 4 | 4 |
| `HealthView` `localWorkouts` effect | `forEach(async …)` → prev per block | N (today's exercises) | **N (unbounded)** |
| `HealthView` `healthRoutines` effect | `forEach` → `fetchPrevForBlock` | M (unique routine blocks) | **M (unbounded)** |
| `useProteinData` `fetchProteinRange` | `Promise.all` over 30 dates | 30 | **30** |
| `useProteinData` SWR (profile, sources, intake) | 3 keys | 3 | 3 |

**N** = number of non-session workouts on the selected date (often 5–15).  
**M** = union of block IDs across all health routine day templates (often 10–30, overlaps N).

`ProteinTracker` mounts in **compact** mode on the workout section, so the 30-day protein range fetch runs even when the nutrition tab is not active.

### Peak auth calls on Health tab open (before)

```
≈ 9 (app SWR) + N + M + 33 (protein) ≈ 50–70+ concurrent get_user() calls
```

With N=10, M=20 (partial overlap): **~52** distinct HTTP requests, **~40+** hitting auth at once for prev alone.

### After Phase 2 mitigation (prev only)

| Source | Count | Peak parallelism |
|--------|-------|------------------|
| `workouts/prev/{id}` (all HealthView paths) | N ∪ M (deduped) | **4** |
| `protein_intake` range | 30 | 30 (unchanged) |
| App SWR | 9 | 9 |

Prev-workout auth calls are now serialized in waves of 4. Total concurrent auth pressure drops from ~50–70 to roughly **~43** (30 protein + 9 SWR + 4 prev). The prev fan-out — the primary source of `ConnectionTerminated` on `/api/workouts/prev/{id}` — is bounded.

### Timing model (prev fetches)

Assume mean latency **L** ≈ 150–300 ms per prev request, **B** unique blocks to fetch.

| | Before | After (limit = 4) |
|--|--------|-------------------|
| Parallelism | B | min(4, B) |
| Wall time (ideal) | ~L | ~ceil(B / 4) × L |
| Example B = 20, L = 200 ms | ~200 ms (but auth fails) | ~1000 ms (reliable) |

Trade-off: prev data appears slightly later, but requests complete instead of failing with transport errors. UI behavior is unchanged — same endpoints, same response shape, same cache semantics.

---

## Phase 2 — Immediate Mitigation (implemented)

### Concurrency limiter

- **File:** `frontend/src/components/views/features/health/runWithConcurrencyLimit.ts`
- **Pool:** `createConcurrencyPool(4)` — module singleton in `prevWorkoutFetch.ts`
- **Cap:** `PREV_WORKOUT_FETCH_CONCURRENCY = 4`

All `/api/workouts/prev/{id}` traffic routes through `fetchPrevWorkoutForBlocks()`:

- `HealthView.ensurePrevData` — batch loader for `localWorkouts` and `healthRoutines` effects
- `HealthView.fetchPrevForBlock` — imperative single-block fetch (add exercise, assemble routine)

### Files changed

| File | Change |
|------|--------|
| `healthRequestInstrumentation.ts` | DEV/test batch metrics |
| `runWithConcurrencyLimit.ts` | Generic pool + worker limiter |
| `prevWorkoutFetch.ts` | Bounded prev fetch + instrumentation |
| `HealthView.tsx` | Replace `forEach(async)` with `ensurePrevData` |
| `useProteinData.ts` | Instrument 30-day range (no concurrency change) |
| `runWithConcurrencyLimit.test.ts` | Pool correctness tests |

---

## Phase 3 — Batch Endpoint Design (no implementation)

### Motivation

Even with concurrency limiting, **B** prev requests still mean **B** `get_user()` calls. A batch endpoint collapses B auth round-trips into **1**.

### API contract

```
GET /api/workouts/prev
```

**Query parameters**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `before_date` | `YYYY-MM-DD` | yes | Only sessions strictly before this date |
| `block_ids` | `string[]` (repeatable) | yes | Exercise block UUIDs to resolve |

Example:

```
GET /api/workouts/prev?before_date=2026-06-14&block_ids=uuid-a&block_ids=uuid-b
```

**Response** `200 OK`

```json
{
  "uuid-a": {
    "previousWorkout": { "prev_sets": [], "prev_date": null, "pr_kg": null },
    "previousDate": null,
    "previousSets": []
  },
  "uuid-b": {
    "previousWorkout": { "prev_sets": [...], "prev_date": "2026-06-10", "pr_kg": 100 },
    "previousDate": "2026-06-10",
    "previousSets": [...]
  }
}
```

**Response field mapping** (alias layer for frontend ergonomics; server can return the existing per-block shape keyed by ID):

| Field | Maps from current `GET /prev/{id}` |
|-------|-------------------------------------|
| `previousSets` | `prev_sets` |
| `previousDate` | `prev_date` |
| `previousWorkout` | full object `{ prev_sets, prev_date, pr_kg }` |

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | Missing `before_date` or empty `block_ids` |
| `401` | Auth failure (single `get_user` per request) |
| `413` | Too many `block_ids` (suggest cap: 50) |

**Backend query strategy (sketch)**

One `get_user()` → one DB query per block batched via `IN (block_ids)` with window function / lateral join, or N parallel Supabase queries inside a single request handler (still 1 auth call). Prefer a single SQL round-trip:

```sql
SELECT DISTINCT ON (block_id) block_id, date, sets
FROM workout_logs
WHERE user_id = $1 AND block_id = ANY($2) AND date < $3
ORDER BY block_id, date DESC;
```

PR computation reuses the existing per-block logic over the last 10 sessions per block.

### Migration path

1. **Backend:** Add `GET /api/workouts/prev` alongside existing `GET /api/workouts/prev/{block_id}` (no breaking change).
2. **Frontend:** Add `fetchPrevWorkoutBatch()` calling the new endpoint; fall back to per-id fetch if 404 (old backend).
3. **HealthView:** Replace `fetchPrevWorkoutForBlocks` loop with one batch call; remove concurrency pool once batch is deployed.
4. **Deprecate:** Mark `GET /prev/{block_id}` deprecated after production validation; remove in a later sprint.

### Expected auth call reduction

| Scenario | Per-block (today, limited) | Batch endpoint |
|----------|---------------------------|----------------|
| B = 20 blocks | 20 `get_user()` | **1** `get_user()` |
| Health tab open (prev only) | 20 auth calls in 5 waves | 1 auth call |
| Combined with protein (30) + SWR (9) | ~39 auth calls | ~**20** auth calls |

Full Health tab auth calls could drop from **~50–70** to **~20** (dominated by protein range until a separate `protein_intake/range` batch exists).

### Future work (out of scope)

| Priority | Item | Impact |
|----------|------|--------|
| A | Batch `GET /api/workouts/prev` | Highest — collapses N prev auth calls |
| D | Frontend concurrency limit (Phase 2) | Shipped — stops transport saturation |
| B | Local JWT verify / memoized auth on backend | Reduces per-request Supabase RTT |
| C | `GET /api/protein_intake/range?start=&end=` | Collapses 30 protein auth calls |

---

## Verification checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Health tab opens without `ConnectionTerminated` under repeated load (manual / staging)
- [ ] Console shows `[K-91F health-request]` with `peakParallelism ≤ 4` for prev batches

---

## References

- Backend auth: `backend/main.py` — `get_current_user()`, `GET /api/workouts/prev/{block_id}`
- Frontend loaders: `HealthView.tsx`, `useProteinData.ts`, `prevWorkoutFetch.ts`
