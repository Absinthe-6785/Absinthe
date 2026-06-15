# K-64 Cosmos Polish

## Interaction Model (unchanged)

```
Single click  → Preview panel
Double click  → Open note
Escape        → Close preview
Enter         → Open previewed note (NEW)
Arrow keys    → Cycle preview (when preview active)
```

## Readability

| Element | Change |
|---------|--------|
| Dim node labels | Opacity 0.35 → 0.55 for better contrast |
| Status bar text | `#444`/`#9CA3AF` → `#71717A`/`#6B7280` |
| Active node ring | Unchanged (pulse + stroke) |
| Moon labels | Still hidden unless active/hover/search (by design) |

## Touch UX

Added transparent hit circle behind each node:

```typescript
r={Math.max(r + 12, compactChrome ? 22 : 18)}
fill="transparent"
```

Expands tap target without changing visual node size. Most impactful for moon-tier nodes (smallest radius).

## Navigation

| Improvement | Detail |
|-------------|--------|
| Enter to open | From preview, Enter calls `onSelect` and closes preview |
| Keyboard hint | Shown when preview active (existing) |
| HUD buttons | Removed `pointerEvents: none` from Universe HUD — isolated/weak-area/discover actions now clickable |

## Context Panel Graph Tab

When note has no graph neighborhood:

- Primary: Create wiki link
- Secondary: Open full Cosmos

Replaces silent empty (previously no render when `!localGraphData`).

## Not Changed (by design)

- Cluster note counts / labels — deferred; optional per spec
- Double-click to open on mobile — preview sheet provides Open CTA
- Full graph redesign — out of scope

## K-65 Candidates

- Show truncated label on keyboard-focused nodes regardless of tier
- Responsive search input width
- Note navigation stack when opening from Cosmos
