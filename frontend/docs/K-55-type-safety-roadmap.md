# K-55 Type Safety Roadmap

Branch: `k55-type-debt-reduction`  
Date: 2026-06-14

## Current Status

| Check | Status |
|-------|--------|
| `typecheck:editor` | PASS |
| `typecheck:undefined` | PASS (0 TS2304) |
| `typecheck:app` | **PASS (0 errors)** |
| `npm run typecheck` | **PASS** (now runs editor + undefined + app) |
| `npm run build` | PASS |
| `npm run test` | PASS (1897) |

K-55 eliminated all 87 `typecheck:app` errors. The default `typecheck` script now includes full-app checking.

---

## CI State

`.github/workflows/ci.yml` runs `npm run typecheck` — which now executes:

```bash
npm run typecheck:editor &&
npm run typecheck:undefined &&
npm run typecheck:app
```

No CI workflow change required; the `package.json` script update is sufficient.

---

## Remaining Technical Debt (non-blocking)

These items do not fail `typecheck:app` but represent future hardening opportunities for K-56+.

### 1. Import path fragility

Deep relative imports (`../../../../../../types`) in `calendar-ui` subfolders are error-prone. **K-56 target:** add `paths` alias in `tsconfig.json`:

```json
"paths": { "@/*": ["src/*"] }
```

Then migrate high-churn modules to `@/types`, `@/lib/i18n`, etc.

### 2. SWR typing gaps (low risk)

| Location | Issue |
|----------|-------|
| `useProteinData.ts` line 78 | `weeklyData` `useSWR` call lacks explicit generic |
| Various views | Some `useSWR(url, fetcher)` without `<T>` — safe via `fetcher<T>` default `unknown` but callers should narrow |

**K-56 target:** audit all `useSWR` calls in `features/health`, `features/planner`, `features/knowledge`, `hooks/useDaily.ts`, `hooks/useStatic.ts`.

### 3. NoteView complexity

`NoteView.tsx` (~3900 lines) required the most fixes. Long-term:

- Extract context-panel note guards into a `requiresActiveNote(rightPanel)` helper
- Split workspace activation ID resolution into `workspaceActivationKey(activation)` utility (partially done inline)

### 4. Domain type drift

Runtime API fields (`end_next_day`, `sort_order`, etc.) were ahead of `src/types/index.ts`. **K-56 target:** generate or sync types from API schema / OpenAPI if available.

### 5. Editor vs app scope

`tsconfig.editor.json` uses explicit globs — new block-editor files must be added manually. **K-56 target:** document in `CONTRIBUTING.md` or add a CI check that warns when new `block*.ts` files exist outside editor include globs.

### 6. Test file typecheck

Test files are excluded from `tsconfig.app.json`. Type errors in tests only surface at vitest runtime. **K-56 target:** optional `tsconfig.test.json` for test-only typecheck in CI.

---

## Recommended K-56 Targets

| Priority | Target | Effort | Impact |
|----------|--------|--------|--------|
| P1 | `@/` path aliases + migrate calendar-ui imports | Medium | Prevents TS2307 regressions |
| P2 | Full `useSWR<T>` audit across data hooks | Low | Compile-time API contract safety |
| P3 | `NoteView` panel guard utilities | Medium | Reduces nullable TS debt in largest view |
| P4 | API type sync script (backend → frontend) | High | Eliminates domain drift class |
| P5 | `tsconfig.test.json` in CI (optional job) | Low | Catches test-only type errors |
| P6 | Enable `noUnusedLocals` / `noUnusedParameters` incrementally | High | Stricter hygiene; do per-module |

---

## Regression Prevention

1. **Never remove `typecheck:app` from `npm run typecheck`** — it caught all 87 pre-K-55 errors that editor-only scope missed.
2. **Keep `typecheck:undefined`** — catches bare identifier crashes (TDZ / missing imports) at CI speed.
3. **New feature folders** under `src/` are automatically covered by `tsconfig.app.json`; no tsconfig change needed.
4. **New calendar-ui subfolder files** must use 6-level `../` to `src/` (or `@/types` after K-56 aliases).

---

## Success Criteria — Met

```text
Before:  ~87 typecheck:app errors
Goal:    < 30 errors
Result:  0 errors

build:   PASS
tests:   PASS (1897)
behavior: unchanged (type-only fixes)
```
