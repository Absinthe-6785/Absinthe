# K-92A1 — Render Optimization

Branch: `k92a1-render-optimization`  
Reference: [K-92A Editor Performance Audit](./K-92A-editor-performance-audit.md)  
Status: Implementation complete — **not committed**

---

## Executive Summary

K-92A identified TOC scroll spy as the P0 render propagation bottleneck. K-92A1 **isolates scroll-driven TOC state** from `NoteView` React state using an external store (same pattern as `dragStateStore`).

**Result:** Scroll at a fixed heading no longer invalidates `NoteView`, `useNoteViewChildPropInput`, or context panel props. Only `NoteContextTocOutline` rerenders when the active heading changes.

---

## Render Propagation Diagrams

### Before (K-92A)

```text
Scroll
  ↓
useTocScrollSpy (rAF)
  ↓
setActiveTocIdx (React state in NoteView)
  ↓
NoteView rerender (~1400 LOC hook chain)
  ↓
childPropInput useMemo invalidates (highlightedTocIdx dep)
  ↓
contextPanelProps / editorAreaProps rebuild
  ↓
NoteContextPanelBody + sidebar re-evaluate
  ↓
Links / Discover / Properties / Relations / Cosmos JSX paths run
```

### After (K-92A1)

```text
Scroll
  ↓
useTocScrollSpy (rAF, index dedup)
  ↓
setTocScrollActiveIdx (tocScrollStore)
  ↓
NoteContextTocOutline (useSyncExternalStore) — TOC tab only
  ↓
OutlinePanel highlight update

NoteView: no rerender on scroll
Context panels (non-TOC tabs): no rerender on scroll
NoteViewEditorArea / BlockEditor: unchanged during scroll
```

---

## Objective A — TOC Isolation

### Where state lived (before)

| State | Location | Consumers |
|-------|----------|-----------|
| `activeTocIdx` | `useNoteViewState` | `useTocScrollSpy`, `highlightedTocIdx`, keyboard nav |
| `highlightedTocIdx` | Derived in `NoteView` | `contextEditorContext` → all context panel prop paths |
| `tocKeyboardIdx` | `useNoteViewState` | Keyboard j/k/Enter (unchanged) |

### Where state lives (after)

| State | Location | Consumers |
|-------|----------|-----------|
| Scroll active index | `tocScrollStore.ts` | `useTocScrollSpy`, `NoteContextTocOutline` |
| Keyboard focus | `tocKeyboardIdx` in NoteView | `NoteContextTocOutline` only (TOC tab) |

### Removed from NoteView scroll path

- `activeTocIdx` React state (deleted)
- `highlightedTocIdx` from `contextEditorContext` and `childPropInput` deps

---

## Objective B — Render Boundary Audit

| Component | Scroll at same heading (before) | Scroll at same heading (after) | Heading boundary cross |
|-----------|--------------------------------|-------------------------------|------------------------|
| `NoteView` | React setState scheduled each rAF* | **No rerender** | **No rerender** |
| `NoteViewEditorArea` | Prop memo stable unless NoteView rerenders | **No rerender** | **No rerender** |
| `NoteContextPanelBody` | Rerenders with NoteView | **No rerender** | **No rerender** |
| Links / Discover / … panels | JSX re-evaluated on NoteView rerender | **No rerender** | **No rerender** |
| `NoteContextTocOutline` | Via parent | **No rerender** | **Rerenders** (expected) |
| `BlockEditor` | `React.memo` — usually skipped | **No rerender** | **No rerender** |

\*React 18 bails out if `activeTocIdx` unchanged, but `setState` is still invoked every rAF until hook-level dedup was added.

### Expected rerender (unchanged)

- `tocKeyboardIdx` change (j/k keys) → NoteView rerender → TOC outline updates
- Note body edit → store sync → existing paths
- Tab switch → existing paths

---

## Objective C — Prop Stability

| Change | Justification |
|--------|---------------|
| Remove `highlightedTocIdx` from `NoteContextEditorContext` | Was forcing context prop object identity change on every heading cross |
| Replace with `tocKeyboardIdx` only | Changes on keyboard nav (infrequent), not scroll |
| Stable `setTocScrollActiveIdx` reference | Module-level store setter — `useTocScrollSpy` effect deps stable |
| Hook-level index dedup in `useTocScrollSpy` | Avoids store emit when probe unchanged between frames |
| Store-level dedup in `setTocScrollActiveIdx` | Defense in depth |

No additional `useMemo`/`useCallback` cargo-culting on panel builders — vault-scoped memos unchanged.

---

## Objective D — Instrumentation (DEV)

| Module | Purpose |
|--------|---------|
| `renderDiagnostics.ts` | `useRenderDiagnostic(label)` — render/rerender counts |
| `tocScrollStore.ts` | `getTocScrollDiagnostics()` — update vs deduped counts |

### DEV usage

```javascript
// Browser console while scrolling a large note
import { logRenderDiagnostics } from '...'; // or expose via window in dev
// Labels: NoteView, NoteContextPanelBody, NoteContextTocOutline
```

Filter console for `[K-92A1 render]` after calling `logRenderDiagnostics()` from a dev hook if wired.

---

## Measured Metrics

### Automated (vitest)

| Scenario | Before (model) | After (measured) |
|----------|----------------|------------------|
| 100 scroll frames, same heading index | Up to 100 `setState` calls → NoteView work | **1 store update**, 99 deduped |
| Heading crosses 0→0→0→1→1→2→2→2 | 3 NoteView rerenders + full prop rebuild | **3 store updates**, 0 NoteView rerenders |
| `useTocScrollSpy` callback invocations (60 frames @ idx 3, then 4) | 60 calls | **2 calls** (hook dedup) |

Tests: `tocScrollStore.test.ts`, `k92a1RenderPropagation.test.ts`

### Component render counts (expected manual DEV)

| Component | Continuous scroll (same section) | Per heading boundary |
|-----------|-------------------------------|---------------------|
| `NoteView` | Before: 0–N (setState overhead) → After: **0** | Before: 1 → After: **0** |
| `NoteContextPanelBody` | Before: 0–N → After: **0** | Before: 1 → After: **0** |
| `NoteContextTocOutline` | **0** | **1** |

Manual validation: open 1000+ block note, scroll continuously, run `getRenderDiagnostics()` in React DevTools or console hook — `NoteView` rerender count should not increase during scroll-only interaction.

---

## File Inventory

| File | Change |
|------|--------|
| `frontend/src/components/views/noteview/tocScrollStore.ts` | **New** — external scroll TOC index store |
| `frontend/src/components/views/noteview/tocScrollStore.test.ts` | **New** — store dedup tests |
| `frontend/src/components/views/noteview/NoteContextTocOutline.tsx` | **New** — isolated outline with `useSyncExternalStore` |
| `frontend/src/components/views/noteview/renderDiagnostics.ts` | **New** — DEV render counters |
| `frontend/src/components/views/noteview/k92a1RenderPropagation.test.ts` | **New** — propagation model tests |
| `frontend/src/components/views/useTocScrollSpy.ts` | Hook-level index dedup before callback |
| `frontend/src/components/views/NoteView.tsx` | Store wiring; remove `activeTocIdx`; DEV diagnostic |
| `frontend/src/components/views/noteview/useNoteViewState.ts` | Remove `activeTocIdx` state |
| `frontend/src/components/views/noteview/NoteContextPanelBody.tsx` | Use `NoteContextTocOutline`; DEV diagnostic |
| `frontend/docs/K-92A1-render-optimization.md` | **New** — this report |

---

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✓ Pass |
| `npm test` | ✓ 2105 passed |
| `npm run build` | ✓ Pass |

### Manual checklist (staging)

- [ ] 1000+ block note — continuous scroll feels smoother
- [ ] TOC highlight tracks scroll correctly
- [ ] TOC keyboard j/k/Enter still works
- [ ] Links / Discover / Properties / Relations / Cosmos tabs functional
- [ ] Note switch resets TOC highlight

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| TOC highlight desync | Low | Store reset on `activeNoteId`; `scrollToHeading` writes store |
| Keyboard vs scroll priority | Low | `tocKeyboardIdx ?? scrollActiveIdx` preserved in `NoteContextTocOutline` |
| Stale store on hot reload | Low | DEV HMR may need note re-open; production N/A |
| Multiple notes / tabs | Low | Single global store — reset on note switch (same as prior `setActiveTocIdx(null)`) |
| Remaining scroll jank | Medium | DOM probe in scroll spy + virtual `measureElement` still run — **K-92A2** scope |

---

## Deferred (out of scope)

- Throttle / idle-callback for heading DOM probe
- Context panel tab-level `React.memo` splits (less critical after NoteView isolation)
- Search highlight fan-out (K-92A4 / separate)
- Nested toggle virtualization (K-92A2)

---

## Commit Recommendation

Ready for review. Suggested message:

```text
K-92A1: isolate TOC scroll state to stop NoteView rerenders during scroll.

Move scroll-driven active heading index to tocScrollStore; render highlight
via NoteContextTocOutline useSyncExternalStore. Context panels no longer
invalidate on scroll.
```

**Do not merge until manual scroll QA on a 1000+ block note confirms TOC tracking.**
