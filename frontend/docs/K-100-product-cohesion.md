# K-100 — Product Cohesion & Real-Usage Polish

Branch: `k100-product-cohesion` (not committed until review)

## Summary

Post K-99 responsive polish pass focused on friction reduction, workflow cohesion, and visual consistency. No storage migrations, schema changes, or knowledge engine changes.

## Workstreams

### A — Reading & document experience

**A1 Read-mode search**
- Sticky search toolbar in reading mode
- Esc closes search (clears query, then hides bar)
- Enter / Shift+Enter match navigation
- Search term preserved across edit/read mode (`searchQuery` shared state)
- Stronger highlight styling (`.bshl`)
- Audit: `k100ReadSearchAudit.ts`

**A2 Document density**
- Desktop reading max-width 680px, tighter vertical rhythm
- Mobile padding preserved via existing `isMobile` branches

### B — Note list workflow

**B1 List interactions**
- Improved selected note visibility
- Full date display on list rows
- Virtual row height synced with list density
- Pinned / recent workspace sections collapsible (persisted)
- Audit: `k100NoteListAudit.ts`

**B2 Sorting**
- Added folder name sort + starred-first toggle
- Persisted via `absinthe-note-sort` (`noteListSortPreference.ts`)

### C — Planner UX

**C1 Calendar density** — 65/35 desktop split, larger month event chips  
**C2 Event detail** — duplicate, quick-edit title, keyboard shortcuts (E/D/Esc/Del)  
**C3 Timetable** — weekday / weekend / every-day presets  
- Audit: `k100PlannerAudit.ts`

### D — Settings cleanup

Sections: **General** → **Storage** → **Recovery** → **Export** → **Danger zone**  
- General: language, theme, default category  
- Audit: `k100SettingsAudit.ts`

### E — Empty states & feedback

- K-99 `ProductEmptyState` retained; skeleton class `.k100-skeleton-pulse`  
- Audit: `k100EmptyStateAudit.ts`

### F — Keyboard & productivity

| Shortcut | Action |
|----------|--------|
| Ctrl+F | Focus document search |
| Esc | Close search / modals |
| Enter / Shift+Enter | Next / prev search match |
| Ctrl+N / Ctrl+Shift+N | New note |
| Ctrl+Alt+T | Open or create today's daily note |

- Audit: `k100KeyboardAudit.ts`

### G — Real usage validation matrix

| Width | Profile | Notes | Planner | Health | Settings |
|-------|---------|-------|---------|--------|----------|
| 320px | Mobile | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 375px | Mobile | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 768px | Tablet | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 1024px | Desktop | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 1440px | Wide | _TODO_ | _TODO_ | _TODO_ | _TODO_ |

## Before / after

| Area | Before | After |
|------|--------|-------|
| Read search | Static bar | Sticky toolbar, Esc dismiss |
| Sort prefs | Session only | Persisted + folder/starred |
| Agenda blocks | Menu only | Click opens detail panel |
| Settings | Mixed planner card | General-first IA |
| Calendar | 70/30 sparse | 65/35 denser cards |

## Verification

```powershell
cd frontend
npm run typecheck
npm test
npm run build
npm test -- k100
```

## Review package

- `npm test -- k100` console audits (read search, note list, planner, settings, empty, keyboard)
- Screenshot matrix (section G)
- Manual spot-check: Ctrl+Alt+T daily note, agenda block click → detail panel
