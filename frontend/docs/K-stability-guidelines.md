# Engineering Guidelines — Stability (K-60+)

Short rules for navigation, storage, effects, and hooks in Absinthe.

## useEffect Rules

1. **No self-triggering loops** — never `setState(x)` in `useEffect` when `x` is in the dependency array unless guarded by a value comparison.
2. **One-shot hydration** — load session/local storage on module init or mount once; do not re-read storage in response to your own writes.
3. **Refs for hot paths** — keyboard handlers and drag loops use refs for latest values instead of re-subscribing effects every render.
4. **Cleanup required** — `requestAnimationFrame`, `setInterval`, window listeners must cancel on unmount.

## sessionStorage Synchronization Rules

1. **Single writer** — only the module store (`notify()`) writes session keys.
2. **Mutate → notify → persist** — update in-memory state, notify subscribers, then persist.
3. **Reset clears cache** — test resets and session clears must also reset cached snapshots (e.g. navigation snapshot cache).
4. **No React → storage → React loops** — components subscribe via `useSyncExternalStore`; they do not write storage in effects reacting to the same key.

## Navigation State Rules

1. **`pushNoteNavigation`** dedupes same note at current index.
2. **`seedNoteNavigationStack`** only seeds when stack is empty (K-66).
3. **`returnFromNote`** clears `returnTab` before switching tabs — never call `openNote` inside `returnFromNote`.
4. **`getNoteNavigationSnapshot`** must return a **stable object reference** when `canBack`/`canForward` are unchanged.

## Breadcrumb State Rules

1. Set breadcrumb at navigation entry (`openNote` / `navigateToNote` / user action), not in render.
2. **`setNoteBreadcrumb`** skips notify when segment content is unchanged.
3. Breadcrumb is session-scoped; clear on explicit navigation reset (future: tie to `returnFromNote`).

## React Hook Usage Rules

1. Hooks only at top level — never inside conditions, loops, or callbacks.
2. **`useSyncExternalStore` snapshots** must be:
   - primitives (`string`, `number`, `boolean`, `null`), or
   - referentially stable objects/arrays until data changes.
3. **Never return `{ ... }` literals** from `getSnapshot` without caching.
4. Add a render-count regression test for every new external-store hook.

## PR Checklist (stability)

- [ ] New `useSyncExternalStore` has stable snapshot test
- [ ] No hardcoded `showToast` literals (`npm run lint:hardcoded-toasts`)
- [ ] `npm run typecheck && npm run test`
- [ ] Manual Notes tab load after production build
