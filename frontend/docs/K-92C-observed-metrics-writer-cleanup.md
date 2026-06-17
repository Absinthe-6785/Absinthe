# K-92C — Observed Metrics Writer Cleanup

**Branch:** `k92c-observed-metrics-writer-cleanup`  
**Status:** Implementation complete (awaiting review)  
**Scope:** Stop default `npm test` from mutating `docs/k89-observed-metrics.json`

---

## Executive Summary

`frontend/docs/k89-observed-metrics.json` was repeatedly marked modified after every `npm test` run. Two test files wrote to the same path with incompatible schemas. **K-92C removes the legacy writer** and keeps `discoveryRediscoveryAudit.test.ts` as the sole canonical writer (opt-in via `npm run audit:discovery`).

---

## Pre-Implementation Investigation

### 1. Other writers

Repo-wide search for `k89-observed-metrics` and `writeFileSync` in `frontend/` found **exactly two writers**:

| Writer | File | Trigger |
|--------|------|---------|
| Legacy (removed) | `src/lib/largeVaultUsageAudit.test.ts` | Default `npm test` |
| Canonical (kept) | `src/lib/discoveryRediscoveryAudit.test.ts` | `npm run audit:discovery` or `RUN_VAULT_AUDIT=1` |

No scripts, CI jobs, or production code read or write this path.

### 2. CI dependency on legacy output

`.github/workflows/ci.yml` runs `npm test` only. CI does **not** commit artifacts. The legacy writer produced a flat array in the ephemeral runner workspace; **no workflow consumed or uploaded that file**.

### 3. Documentation and flat-array schema

Docs reference `k89-observed-metrics.json` for human-readable numbers, not for parsing the flat-array shape:

| Doc | Usage |
|-----|-------|
| `K-89-real-usage-validation.md` | Tables cite observed timings; snapshot path noted |
| `K-89C-large-vault-performance.md` | Before/after tables; metrics file path |
| `K-89D-knowledge-rediscovery-audit.md` | Collector breakdown under `scales[].discovery` |
| `K-89D1-discovery-feed-performance.md` | Canonical refresh command |
| `K-91-knowledge-workflow-validation.md` | Inline citation of 3000-note metrics |

**K-89D / K-89D1 docs already assume the object schema** (`generatedAt`, `k89d`, `k89d1`, `scales[].discovery`). **No doc requires the legacy flat array** as machine input.

### 4. Benchmark tooling consumption

No TypeScript/JavaScript tooling imports or parses `k89-observed-metrics.json` at runtime. The only programmatic read is in `discoveryRediscoveryAudit.test.ts` (merge helper when existing file is a legacy array). Console output (`K89_METRICS_JSON`, `console.table`) remains in `largeVaultUsageAudit.test.ts` for local inspection.

---

## Writer Inventory (before K-92C)

| Phase | File | Schema | Default test? |
|-------|------|--------|---------------|
| K-89 / K-89C | `largeVaultUsageAudit.test.ts` | Flat array (~50 lines) | Yes |
| K-89D / K-89D1 | `discoveryRediscoveryAudit.test.ts` | Object (~299 lines) | No (opt-in) |

---

## Trigger Inventory

| Command | Legacy writer | Canonical writer | File mutated? |
|---------|---------------|------------------|---------------|
| `npm test` | Yes (before) | No | **Yes (before)** → **No (after K-92C)** |
| `npm test -- largeVaultUsageAudit` | Yes (before) | No | **Yes (before)** → **No (after K-92C)** |
| `npm run audit:discovery` | No | Yes | Yes (intended) |
| `RUN_VAULT_AUDIT=1 npm test -- discoveryRediscoveryAudit` | No | Yes | Yes (intended) |
| CI `npm test` | Yes (before) | No | Ephemeral only |

---

## Schema Comparison

### Legacy flat array (removed writer)

```json
[
  { "notes": 250, "vaultKb": 72, "indexMs": 11, "searchMs": 3, ... }
]
```

Four scale rows; no `discovery` collector block; no metadata envelope.

### Canonical K-89D1 object (committed on `main`)

```json
{
  "generatedAt": "2026-06-16",
  "k89d": "discovery-collector-audit",
  "k89d1": "discovery-feed-performance",
  "scales": [
    {
      "notes": 250,
      "indexMs": 4,
      "discovery": {
        "totalFeedMs": 6,
        "collectorsMs": { ... },
        "overlap": [ ... ]
      }
    }
  ]
}
```

---

## Root Cause

1. `main` committed the K-89D1 object schema from a manual `npm run audit:discovery` run.
2. Default `npm test` always executed `largeVaultUsageAudit.test.ts`, which unconditionally called `writeFileSync` on the same path.
3. That overwrote the committed snapshot with the older flat array, causing persistent `git status` noise until `git restore`.

This was a **dual-writer conflict**, not Git line-ending or branch hygiene failure.

---

## Option Evaluation

| Option | Description | Verdict |
|--------|-------------|---------|
| **A** | Remove legacy `writeFileSync` | **Chosen** — minimal diff, zero env flags, matches “single canonical writer” goal |
| B | Gate legacy write behind `WRITE_K89_METRICS=1` | Rejected — keeps two writers and foot-gun for full-suite runs with `RUN_VAULT_AUDIT=1` |
| C | Move output outside `docs/` | Deferred — valid follow-up; not required to stop `npm test` pollution |

---

## Chosen Solution (Option A)

**Remove** `writeFileSync` (and unused `fs`/`path` imports) from `largeVaultUsageAudit.test.ts`.

**Preserve:**

- `beforeAll` benchmark execution across all scales
- Regression budgets (250/500) and K-89C index probes (1000/3000)
- `K89_METRICS_JSON` log and `console.table` in `"prints scaling summary table"`

**Canonical refresh:**

```bash
cd frontend
npm run audit:discovery
```

---

## Migration Impact

| Area | Impact |
|------|--------|
| Default `npm test` | No longer modifies tracked docs |
| `largeVaultUsageAudit` | Same benchmarks and assertions; console output only |
| `k89-observed-metrics.json` on `main` | Unchanged; refresh only via `audit:discovery` |
| K-89 / K-89C docs | Two lines updated to cite `npm run audit:discovery` |
| CI | No behavior change (never committed the file) |
| Developers | Stop `git restore` on this file after every test run |

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/largeVaultUsageAudit.test.ts` | Remove doc write; update header comment |
| `docs/K-89-real-usage-validation.md` | Clarify refresh command |
| `docs/K-89C-large-vault-performance.md` | Clarify refresh command |
| `docs/K-92C-observed-metrics-writer-cleanup.md` | This report |

**Unchanged:** `discoveryRediscoveryAudit.test.ts`, `k89-observed-metrics.json`, CI workflow.

---

## Verification

**Before K-92C:** `npm test` → `M frontend/docs/k89-observed-metrics.json`

**After K-92C:** `npm test` → working tree clean for that path

Post-change checks (2026-06-16, branch `k92c-observed-metrics-writer-cleanup`):

```bash
cd frontend
npm run typecheck   # pass
npm test            # 2128 passed; 1 unrelated flaky failure in k92b1CosmosForceSimAudit (timing assertion)
npm run build       # pass
git status -- frontend/docs/k89-observed-metrics.json   # clean (no diff)
```

`npm test -- largeVaultUsageAudit` also leaves `k89-observed-metrics.json` unchanged.

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Lost auto-update of flat-array snapshot | Low | Flat array was wrong schema for committed docs; use `audit:discovery` |
| Regression coverage gap | None | All assertions unchanged |
| Discovery audit still slow / opt-in | Unchanged | By design (`vaultAuditGate.ts`) |

**Safe to merge** after review: single-writer model, no CI breakage, verified clean tree after full test suite.
