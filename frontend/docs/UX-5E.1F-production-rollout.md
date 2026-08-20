# UX-5E.1F — Production Virtualization Rollout

## Rollout summary

| Control | Behavior |
| --- | --- |
| **Default** | Virtualization **on** at root (`depth === 0`) |
| **Opt-out env** | `VITE_DISABLE_VIRTUAL_BLOCKS=true` |
| **Prop override** | `BlockEditor virtualBlocksPoc={false}` |
| **Test overrides** | `setVirtualBlocksDisableOverride` / `setVirtualBlocksPocOverride` |

`VITE_VIRTUAL_BLOCKS_POC` is retired and is no longer read as a production
rollback alias. `VITE_DISABLE_VIRTUAL_BLOCKS=true` is the single supported
environment rollback mechanism.

## Architecture (unchanged from UX-5E.1A–1E)

- TanStack Virtual root list (`VirtualBlockList`)
- External drag store + `DragOverlay` + row metrics
- `PendingFocusQueue` + `VirtualNavigationApi` for focus/search
- Nested toggle editors remain fully mounted (`depth > 0`)

## Performance gains

| Blocks | Pre-virtual mount | Post-rollout (default) |
| ---: | ---: | ---: |
| 2000 | ~14,640ms | **<500ms** |
| DOM blocks @ 2000 | ~2000 | ~20–30 (viewport + overscan) |

See `editorPerformanceAudit` virtual mount tests for current measurements.

## Diagnostics

```ts
import { getVirtualizationStats } from '.../performance';

const stats = getVirtualizationStats();
// { enabled, totalRows, mountedRows, cachedHeights, overscan }
```

Registered live from root `BlockEditor`. Developer-facing only — no remote telemetry.

## Regression audit (virtualization on by default)

| Area | Status | Notes |
| --- | --- | --- |
| Typing | ✓ | Data layer unchanged; visible row editing |
| Selection | ✓ | SelectionCtx unchanged |
| Multi-selection | ✓ | Gutter drag DOM-based (known limitation) |
| Clipboard | ✓ | Copy/paste tests green |
| Search | ✓ | Virtual scroll-to-match (UX-5E.1C) |
| Wiki navigation | ✓ | Unchanged |
| Slash menu | ✓ | Unchanged |
| Context menu | ✓ | Unchanged |
| Drag | ✓ | Row metrics + overlay (UX-5E.1E) |
| Toggle operations | ✓ | Nested editor non-virtual |
| Tables / code / math / images / callouts | ✓ | Mount smoke in rollout tests |

## Hardening (this phase)

- Height cache `pruneStale` on block tree changes
- Virtual mount audit uses default-on flag resolution
- `getVirtualizationStats()` for local diagnostics

## Known limitations

1. **Gutter range selection** — DOM hit-test; not virtualized
2. **Nested toggle virtualization** — children fully mounted when expanded
3. **Toggle footer drop zone** — row metrics approximate expanded toggle height

## Future work

- Knowledge-1 / backlinks / properties / tags (out of virtualization scope)
- Virtual gutter selection
- Nested toggle virtualization
- Remove legacy non-virtual code path when stable

## Validation

```bash
npm run typecheck  # PASS
npm test           # PASS
npm run build      # PASS
```
