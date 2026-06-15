# Stability Audit — K-60 ~ K-67

## Phase 1 — React Error #185 Reproduction

### Error

```text
React Error #185
Maximum update depth exceeded
```

### Reproduction (verified via code path + hook test)

**Environment:** production build (`npm run build` + `npx vite preview`)

**Steps:**

1. Sign in to Absinthe (Notes tab is default after login).
2. App mounts `NoteView` → `useNoteKeyboardActions` → `useNoteNavigationStack`.
3. React enters an infinite re-render loop immediately (no extra click required).

**Affected view:** Notes (`NoteView` / `NoteViewEditorArea` chrome)

**Triggering interaction:** Opening the authenticated app on the Notes tab (default landing tab).

**Stack trace pattern:** React internal `useSyncExternalStore` rerender loop; production build minifies to error #185.

**Automated reproduction:** `src/hooks/useNoteNavigationStack.test.tsx` — fails without fix when `renderCount > 50`.

**Preview note:** `npm run preview` script is not in `package.json`; use `npx vite preview` instead.

---

## Phase 2 — Root Cause

| Field | Value |
|-------|-------|
| **Component** | `useNoteNavigationStack` (consumer: `useNoteKeyboardActions` → `NoteView`) |
| **File** | `frontend/src/lib/noteNavigationStack.ts` |
| **Line** | `getNoteNavigationSnapshot()` (was returning a new object literal every call) |
| **Introduced** | K-65 (`useSyncExternalStore` navigation hook) |

### Why React entered infinite updates

```ts
// BEFORE (broken)
export function getNoteNavigationSnapshot() {
  return { canBack: index > 0, canForward: ... }; // new reference every call
}
```

`useSyncExternalStore` compares snapshots with `Object.is`. A new object on every `getSnapshot()` call means the snapshot always "changed", so React schedules another render → another snapshot check → infinite loop → Error #185.

### Fix applied

Cache snapshot object; only allocate when `canBack` / `canForward` values change.

---

## Phase 3 — React Hooks Audit

| Hook | Risk | Finding |
|------|------|---------|
| `useNoteNavigationStack` | **Critical** | Unstable `getSnapshot` object — **fixed** |
| `useNoteReturnTab` | Low | Snapshot is primitive (`TabId \| null`) — safe |
| `useNoteBreadcrumb` | Low | Snapshot is stable array ref until `setNoteBreadcrumb` — safe |
| `useDragStateSnapshot` | Low | Returns cached `snapshot` ref from store — safe |
| `useNoteKeyboardActions` | Low | No conditional hooks; effect deps OK |
| `useVaultRestoreFlow` | Low | No effects; callback-driven only |

**No hook-order violations found** in K-65–K-67 hooks.

---

## Phase 4 — K60–K67 System Audit

### Navigation — **Critical (fixed)**

- `noteNavigationStack.ts`: unstable snapshot (root cause)
- `noteNavigation.ts`: no loops; `returnFromNote` clears tab once
- `useNoteReturnTab.ts`: safe primitive snapshot

### Breadcrumb — **Medium (hardened)**

- `setNoteBreadcrumb` wrote + notified even when segments unchanged → rerender storm risk
- **Fix:** equality guard before `notify()`

### Workspace Continuity — **Low**

- `WorkspaceContextBanner`: render-only hints, no effects
- Cross-tab `openNote` / `returnFromNote`: no circular calls found
- `seedNoteNavigationStack(activeNoteId)`: runs once per id when stack empty

### Search — **Low**

- `NoteViewSidebar`: no effects; memoized lists
- Workspace search opens notes via one-shot handlers

### Cosmos — **Medium (pre-existing, not #185)**

- `NoteGraphView`: `requestAnimationFrame` loop with cleanup on unmount — OK
- `setTick` throttled during simulation — bounded, not infinite React updates

### Backup / Restore — **Low**

- `useVaultRestoreFlow`: no auto-restore effects; user-triggered only
- No hydration recursion found

---

## Phase 5 — Risk Classification

| ID | Severity | System | Issue | Status |
|----|----------|--------|-------|--------|
| R1 | **Critical** | Navigation | Unstable `getNoteNavigationSnapshot` → React #185 | **Fixed** |
| R2 | Medium | Breadcrumb | Redundant `setNoteBreadcrumb` notifies | **Fixed** |
| R3 | Medium | Cosmos | rAF tick + `setTick` during long simulations | Monitor |
| R4 | Low | Navigation | `seedNoteNavigationStack` on every `activeNoteId` change (no-op after first) | Accept |
| R5 | Low | NoteView | `useEffect` without deps in keyboard actions (intentional ref sync) | Accept |
| R6 | Low | Tooling | No `preview` npm script | Doc only |

---

## Phase 6 — Hardening Recommendations

### Navigation Hardening

- `getSnapshot` for `useSyncExternalStore` must return **referentially stable** values when data unchanged.
- Add render-loop regression test for every external-store hook.

### Breadcrumb Hardening

- Skip notify when segment content is equal (implemented).
- Clear breadcrumb on `returnFromNote` (future K-68).

### Storage Synchronization Rules

- Write storage only inside `notify()` after state mutation.
- Never call storage write from React effects that subscribe to the same store.

### React Effect Rules

- Never `setState` in an effect that depends on that same state without a guard.
- Prefer event handlers for navigation mutations.

### Session Persistence Rules

- Module-level stores hydrate once on import.
- `reset*` helpers must reset cached snapshots too.

### React Hook Usage Rules

- All hooks at top level; no conditional hook calls (current code complies).
- `useSyncExternalStore`: primitives or cached object refs only.

### Test Coverage Gaps (addressed)

- `useNoteNavigationStack.test.tsx` — infinite render guard
- `noteNavigationStack.test.ts` — stable snapshot reference
- `noteBreadcrumb.test.ts` — dedupe notify

---

## Phase 7 — Stress Testing

Manual checklist (post-fix):

- [ ] Login → Notes tab loads without crash
- [ ] Open note → back → forward
- [ ] Schedule → countdown note → return
- [ ] Health → day log → return
- [ ] Archive → milestone → return
- [ ] Cosmos graph select
- [ ] Discovery / Timeline panel navigation
- [ ] Page refresh preserves session stack
- [ ] Vault restore modal open/close

Automated stress: hook render-loop test + full vitest suite.

---

## Verification

```bash
cd frontend
npm run typecheck   # PASS
npm run build       # PASS
npm run test        # PASS (includes new stability tests)
npx vite preview    # manual smoke after login
```

---

## Preventive Rules

See [K-stability-guidelines.md](./K-stability-guidelines.md).

---

## K-68 Roadmap Adjustments

1. **Stability gate before features** — render-loop tests for all `useSyncExternalStore` stores.
2. Add `npm run preview` script to package.json.
3. Clear breadcrumb on cross-workspace return.
4. Defer clickable breadcrumb segments until stress E2E exists.
5. Optional: dev auth bypass fixture for automated preview smoke tests.
