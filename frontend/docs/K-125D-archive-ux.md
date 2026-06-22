# K-125D — Archive UX & Navigation Cleanup

Improve Archive workspace usability through single-expand accordion behavior,
tighter layout density, and centered max-width. Layout and interaction only.

## Accordion behavior

Major sections share single-expand accordion:

1. Recent activity (`ArchiveHistorySection`)
2. Deleted notes (`ArchiveDeletedSection`)
3. Snapshots (`ArchiveSnapshotsSection`)
4. Timeline (`ArchiveTimelineSection`)

**Default:** recent activity expanded; others collapsed.

**Rules:** expanding one section collapses the others via `toggleMajor` in
`useArchiveSectionPrefs`. Secondary sections (restore tools, browse, areas)
keep independent toggles.

## Layout

- Centered `max-w-[1200px]` (was 1320px)
- Single-column major stack (replaces 2-column desktop grid)
- Compact section padding (`p-3 lg:p-3.5`)
- `scroll-mt-2` on sections to reduce scroll jumps when toggling

## Empty states

- Compact empty hints (`data-k125d-empty-compact`, `py-1`)
- Snapshots section uses shared `ArchiveCollapsibleSection` empty handling

## Files

| File | Change |
|------|--------|
| `ArchiveUnifiedView.tsx` | Accordion wiring, width, single column |
| `ArchiveShell.tsx` | Tighter horizontal padding |
| `useArchiveSectionPrefs.ts` | `toggleMajor` accordion |
| `archiveSectionPrefs.ts` | Default collapsed state |
| `ArchiveCollapsibleSection.tsx` | Compact density + major markers |
| `ArchiveHistorySection.tsx` | Major flag, tighter spacing |
| `ArchiveDeletedSection.tsx` | Major flag, tighter spacing |
| `ArchiveSnapshotsSection.tsx` | Uses shared collapsible, compact cards |
| `ArchiveTimelineSection.tsx` | Major flag, tighter spacing |

No archive data, snapshot schema, restore pipeline, storage keys, or
hydration changes.

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm test -- k125d k121ArchiveLayout k120Scroll k119EmptyState
```
