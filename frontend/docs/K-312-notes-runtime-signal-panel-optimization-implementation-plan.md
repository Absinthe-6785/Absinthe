# K-312 Notes Runtime / Signal Panel Optimization Implementation Plan

## Purpose

K-312 plans a possible optimization for the Notes Runtime / Signal Panel.

K-312 follows K-311 Notes Runtime / Signal Panel Optimization Source Facts Audit.

K-312 is docs/plan plus audit test only.

K-312 does not implement selector optimization.

K-312 does not implement memoization.

K-312 does not change runtime behavior.

K-312 does not change container code.

K-312 does not change layout.

K-312 does not change Signal Panel UI.

K-312 does not change store, schema, persistence, auth, Supabase, provider, sync, backup, graph, Cosmos, Health, or Schedule behavior.

K-312 chooses the next K-313 path from source facts and evidence thresholds.

## Files Inspected

- `frontend/docs/K-311-notes-runtime-signal-panel-optimization-source-facts-audit.md`.
- `frontend/src/lib/notesRuntimeSignalPanelOptimizationSourceFactsAudit.test.ts`.
- `frontend/docs/K-310-notes-overview-signal-panel-authenticated-visual-qa-closure.md`.
- `frontend/docs/K-309-notes-overview-signal-panel-runtime-mount-closure-audit.md`.
- `frontend/docs/K-307-notes-overview-signal-panel-runtime-mount-plan.md`.
- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx`.
- `frontend/src/components/notes/NotesOverviewSignalPanelContainer.test.ts`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.ts`.
- `frontend/src/components/notes/notesOverviewSignalPanelAdapter.test.ts`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.tsx`.
- `frontend/src/components/notes/NotesOverviewSignalPanel.test.ts`.
- `frontend/src/components/views/noteview/NoteViewSidebar.tsx`.
- `frontend/src/components/views/features/knowledge/components/WorkspaceDashboardView.tsx`.
- `frontend/src/lib/notesOverviewSignalPanelRuntimeMountBoundaryAudit.test.ts`.
- `frontend/src/lib/notesOverviewSignalPanelRuntimeMountClosureAudit.test.ts`.
- `frontend/src/store/useNotesStore.ts`.
- `frontend/src/lib/notePersistence.ts`, inspection only.
- `frontend/src/lib/noteIndexedDb.ts`, inspection only.

## K-311 Source Facts Recap

The current runtime mount path remains:

```text
NoteViewSidebar -> WorkspaceDashboardView signalPanel slot -> NotesOverviewSignalPanelContainer -> notesOverviewSignalPanelAdapter -> NotesOverviewSignalPanel
```

`NotesOverviewSignalPanelContainer` subscribes to:

- `useNotesStore(state => state.notes)`.
- `useNotesStore(state => state.activeNoteId)`.

The container maps the full local notes array into adapter-safe metadata whenever the `notes` array reference or `activeNoteId` changes.

The mapped metadata is limited to:

- `id`.
- `title`.
- `updatedAt`.
- `createdAt`.
- `deletedAt`.
- `starred`.

The adapter remains pure.

The Signal Panel remains props-only and read-only.

There is no AppContent wiring.

There is no NoteViewEditorArea wiring.

There is no Supabase, provider, sync, backup, graph, or Cosmos connection.

Authenticated protected-shell visual QA remains a release/manual QA gap from K-310.

Existing Vite chunk and dynamic-import warnings are not directly attributed to Signal Panel from available source facts.

Optimization remains a future candidate, not a current blocker.

## Optimization Decision Criteria

Optimization is needed only when evidence shows one or more of these conditions:

- Large note count causes measurable render delay in the Notes workspace.
- Repeated unnecessary re-renders occur from unrelated note fields such as body/content-only edits.
- Users can see visual lag while opening Notes Overview or switching the active note.
- React DevTools or browser performance tools show avoidable recomputation in `NotesOverviewSignalPanelContainer`.
- Authenticated protected-shell QA shows sluggish panel behavior with a realistic local vault.
- Tests can demonstrate avoidable metadata remapping without changing behavior.

Optimization is not needed when:

- Small or medium note counts behave well.
- No visual lag appears in authenticated QA.
- No measurable rerender or recomputation issue is observed.
- The only concern is theoretical.
- The change would add complexity without proof.
- The available evidence is only unrelated Vite chunk or dynamic-import warnings.

## Candidate Optimization Strategies

### 1. Keep Current Full Notes Array Subscription Until Evidence

Scope: no runtime change.

Benefit: preserves current behavior and avoids complexity.

Risk: large vaults may keep remapping more metadata than needed.

Files touched: none, or docs/audit only.

Test requirements: closure audit only.

Recommended now: acceptable if authenticated QA and performance evidence remain unavailable.

### 2. Narrow Selector In Container

Scope: update `NotesOverviewSignalPanelContainer` to select only local Signal Panel metadata plus `activeNoteId`.

Benefit: reduces selected shape and makes the runtime boundary explicit.

Risk: if implemented with plain array creation inside a Zustand selector, it may still create a new array per store change and may require equality handling or local memoization.

Files touched: container and container tests only, plus narrow boundary audit updates.

Test requirements: metadata-only selector, unchanged empty/recent/deleted/starred behavior, no store writes, no forbidden imports.

Recommended now: best narrow K-313 implementation candidate if implementation is approved despite incomplete QA evidence.

### 3. Memoize Metadata Mapping

Scope: keep current store selectors but memoize mapping more carefully around stable inputs.

Benefit: may reduce adapter input churn when note metadata is unchanged.

Risk: stale data if memoization compares mutable objects unsafely or ignores active note changes.

Files touched: container and tests only.

Test requirements: rerender/mapping stability tests and unchanged behavior tests.

Recommended now: only if tests can prove low-risk reduction. Do not add global caches.

### 4. Store-level Derived Metadata Selector

Scope: add a store-side or exported selector helper for Signal Panel metadata.

Benefit: reusable and potentially easier to test as a selector.

Risk: increases store coupling and may be mistaken for new derived state or persistence behavior.

Files touched: likely store or new selector module plus tests.

Test requirements: stronger store boundary tests.

Recommended now: defer until evidence shows container-local selection is insufficient.

### 5. Adapter-level Memoization

Scope: cache `createNotesOverviewSignalPanelProps` output.

Benefit: could avoid repeated sorting/formatting for identical input.

Risk: weak fit because the adapter is intentionally pure and deterministic; cache invalidation would add hidden behavior.

Files touched: adapter and adapter tests.

Test requirements: determinism, cache invalidation, no stale output, no mutation.

Recommended now: no.

### 6. Runtime Split Between Active Note Selector And Notes Metadata Selector

Scope: keep `activeNoteId` selected separately and select local metadata through a dedicated selector/helper.

Benefit: preserves source-grounded active note ownership and keeps route/nav out of the container.

Risk: still needs careful equality or memoization if the metadata array is freshly created on every store update.

Files touched: container and tests only.

Test requirements: active note behavior unchanged, missing/deleted active note behavior unchanged.

Recommended now: yes as part of a narrow container-local K-313 implementation if implemented.

### 7. Virtualization Or List Truncation

Scope: limit rendering or virtualize visible Signal Panel rows.

Benefit: useful for very large rendered lists.

Risk: current rendered panel already caps recent notes to five, so virtualization does not address the current source fact.

Files touched: Signal Panel UI/component tests.

Test requirements: browser/layout QA.

Recommended now: no.

### 8. Broad Store Or Schema Change

Scope: alter store structure, schema, persistence, or hydration to maintain derived Signal Panel metadata.

Benefit: could be powerful later.

Risk: too broad for the current evidence and violates this line's local-first preservation posture.

Files touched: store, persistence, schema, hydration, tests.

Test requirements: broad regression testing.

Recommended now: no.

## Recommended Default

Do not jump to broad store, schema, persistence, or architecture changes.

If K-313 implements anything, choose a narrow container-local selector/mapping plan only.

Avoid adapter-level cache unless future profiling proves the adapter itself is the bottleneck.

Avoid store-level derived state until evidence shows container-local selection is insufficient.

## Narrow Metadata Selector Shape

A future K-313 implementation may use this source-grounded metadata shape:

```ts
type NotesSignalPanelMetadata = {
  id: string;
  title?: string | null;
  updatedAt?: string | number | null;
  createdAt?: string | number | null;
  deletedAt?: string | number | null;
  starred?: boolean;
};
```

Rules:

- Include only fields needed by the adapter and panel.
- Avoid full note body.
- Avoid content-heavy fields.
- Avoid tags, properties, relations, editor state, and graph edges.
- Avoid remote/provider/sync/backup fields.
- Keep `deletedAt` handling aligned with current K-308 behavior.
- Keep `starred` available because it is part of the current container metadata boundary even if the adapter does not currently surface a starred badge.
- Keep `activeNoteId` separate from the note metadata array.

## activeNoteId Plan

`activeNoteId` is currently source-grounded in `useNotesStore`.

If K-313 implements selection, `activeNoteId` should be selected separately and read-only.

Do not derive `activeNoteId` from route state.

Do not derive `activeNoteId` from navigation state.

Do not introduce route or navigation ownership into `NotesOverviewSignalPanelContainer`.

Do not mutate active note state from the Signal Panel.

Do not call `setActiveNoteId` from the Signal Panel path.

## Memoization Plan

Memoization should be container-local if needed.

Memoization must not change adapter purity.

Memoization must not add global caches.

Memoization must not hide stale data.

Memoization must not depend on mutable object identity unless tests prove it is safe.

Memoization should use stable input only if tests support the stability contract.

Memoization must not add dependencies.

Memoization must be justified by evidence or by a clear low-risk reduction in avoidable rerenders.

## useNotesStore Boundary

`useNotesStore` import remains allowed only in the runtime container or selected Notes owner.

`NotesOverviewSignalPanel` remains store-free.

`notesOverviewSignalPanelAdapter` remains store-free.

Any selector must be read-only.

No store writes are allowed.

No persistence changes are allowed.

No schema changes are allowed.

No direct IndexedDB imports are allowed.

No remote fallback is allowed.

## Persistence And Local-first Boundary

IndexedDB remains the underlying local persistence source for Notes.

K-313 must not import IndexedDB directly.

K-313 must not change note persistence.

K-313 must not change schema or migrations.

K-313 must not make Supabase the source of truth.

K-313 must not introduce remote-first hydration.

K-313 must not couple the Signal Panel to backup, provider, import, export, restore, or preflight systems.

The Signal Panel should continue to consume already-available local store state.

## Supabase Provider Sync Graph Boundary

Optimization must not introduce Supabase imports.

Optimization must not introduce `authFetch`.

Optimization must not introduce provider or sync imports.

Optimization must not introduce backup, export, import, restore, preflight, or attachment provider imports.

Optimization must not introduce graph or Cosmos imports.

Optimization must not replace `NoteGraphView`.

Optimization must not add network traffic.

Vite warnings must not be used as Signal Panel evidence without source proof.

Remote systems remain support layers.

## K-313 Implementation Boundary

Primary recommendation:

```text
K-313 Notes Runtime / Signal Panel Selector Optimization Implementation
```

K-313 may implement a narrow container-local metadata selector/mapping if the team accepts the small runtime touch before authenticated performance evidence.

K-313 scope:

- Modify only `frontend/src/components/notes/NotesOverviewSignalPanelContainer.tsx` if implementation is approved.
- Update only focused container tests and boundary audits needed for that implementation.
- Preserve adapter input/output compatibility.
- Keep `activeNoteId` separate and read-only.
- Keep Signal Panel UI unchanged.
- Keep adapter behavior unchanged.
- Keep `NoteViewSidebar`, `WorkspaceDashboardView`, `AppContent`, `NoteView`, and `NoteViewEditorArea` unchanged unless a test import requires a tiny audit-only adjustment.
- Do not change store, schema, persistence, hydration, Supabase, provider, sync, backup, graph, Cosmos, auth, Health, or Schedule behavior.

Alternative recommendation if evidence is considered insufficient:

```text
K-313 Notes Runtime / Signal Panel Optimization Closure Audit
```

Alternative K-313 scope:

- docs/source closure audit plus audit test only.
- keep the current implementation.
- require authenticated QA and performance evidence before any optimization.

K-312 chooses the primary K-313 selector optimization implementation plan because source facts show a narrow and reversible runtime target, but K-313 must stay container-local and must not broaden the architecture.

## K-313 Tests

If K-313 implements the narrow selector, tests should verify:

- Container uses a narrowed metadata shape.
- Full note body is not selected or mapped.
- Tags, properties, relations, editor state, graph data, provider data, sync data, and backup data are not selected or mapped.
- Adapter still receives compatible input.
- Empty notes behavior is unchanged.
- Recent notes behavior is unchanged.
- Deleted notes behavior is unchanged.
- Starred metadata handling remains compatible with current K-308 behavior.
- Active note behavior is unchanged for active, missing, and deleted active notes.
- No store writes occur while rendering.
- No direct IndexedDB import is added.
- No Supabase, provider, sync, backup, graph, or Cosmos imports are added.
- Adapter tests remain unchanged or continue to pass.
- Signal Panel component tests remain unchanged or continue to pass.
- Runtime mount tests remain unchanged or continue to pass.
- Boundary audit allowlists are updated only narrowly.

If K-313 defers implementation, tests should verify:

- Closure audit doc exists.
- No runtime files changed.
- Current full notes-array subscription remains acknowledged.
- Authenticated QA and performance evidence remain required before optimization.

## QA And Performance Evidence Plan

Authenticated protected-shell visual QA remains a release/manual gap until a real Supabase-authenticated session is used.

Performance evidence should use realistic or proportional local note counts.

Record the note count.

Record whether notes include large body/content fields.

Record viewport size.

Record local machine/browser environment.

Record visible render lag or absence of lag.

Record React DevTools render observations if available.

Record browser performance observations if available.

Record whether body-only edits cause avoidable Signal Panel recomputation.

Do not optimize based solely on unrelated Vite build warnings.

Do not claim authenticated QA or performance evidence unless it is actually performed.

## Non-goals

- no selector optimization implementation in K-312.
- no memoization implementation in K-312.
- no container code change in K-312.
- no layout change.
- no Signal Panel UI change.
- no adapter behavior change.
- no store, schema, persistence, or hydration change.
- no IndexedDB direct import.
- no Supabase, provider, or sync connection.
- no graph or Cosmos connection.
- no auth bypass.
- no backup, export, import, restore, preflight, or attachment provider behavior change.
- no Health or Schedule change.
- no assets, fonts, dependencies, package changes, scripts, Vite config changes, env files, storageState, or generated artifacts.

## Closure Statement

K-312 defines optimization decision criteria and implementation boundary only.

No optimization is implemented.

No memoization is implemented.

The current Signal Panel runtime mount remains unchanged.

The full notes-array subscription remains a narrow K-313 candidate, acceptable pending evidence.

The local-first boundary remains preserved.

Future optimization must be evidence-based and narrow.

Remote systems remain support layers.
