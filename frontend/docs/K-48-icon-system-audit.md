# K-48 Icon System Audit

## Standard

**Lucide React** (`lucide-react`) at `size={18–24}`, `strokeWidth={2.25}` — matches Sidebar, Note, Cosmos patterns.

## By surface

| Surface | Status (K-48) | Notes |
|---------|---------------|-------|
| **Notes** | Good | Lucide throughout chrome, block editor |
| **Cosmos / Archive** | Good | Lucide in graph, timeline, archive nav |
| **Schedule** | Fixed | Category picker emoji → BookOpen, Briefcase, Dumbbell, User, Moon, Users |
| **Health** | Fixed | Protein 🥤/⚖️ → Apple, Scale; categories emoji → text+i18n |
| **Settings** | Good | Lucide Settings, Download, AlertTriangle |

## Remaining emoji (acceptable / deferred)

| Location | Usage | Action |
|----------|-------|--------|
| Callout blocks | User-selected emoji icons in notes | Intentional content |
| Workout summary clipboard | 📅 ⏱ 📍 🏃 in exported text | Plain-text export; K-49 |
| `proteinGoalSaved` legacy tests | N/A | Removed emoji from i18n |
| Knowledge badges | Concept/import badges | Domain semantics, not nav icons |

## Beta / placeholder graphics

- No user-facing **Beta** badges found in production UI.
- Settings CSV export uses disabled button (not a beta badge); label uses `comingSoon` i18n where wired.
- Archive `archiveViewUnavailable` mentions "not available yet" — product copy, not beta badge.

## Guidelines (K-49+)

1. Sidebar and workspace nav: Lucide only, no emoji labels.
2. Food/category chips: Lucide icon + translated string.
3. Empty states: Lucide `EmptyState` icon prop, not unicode symbols.
4. Do not mix Heroicons or custom SVG nav icons alongside Lucide.
