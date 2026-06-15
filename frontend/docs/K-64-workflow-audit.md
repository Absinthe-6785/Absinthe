# K-64 Workflow Audit

## Notes Flow

| Step | Before | After (K-64) |
|------|--------|--------------|
| Create | Small `+` button, easy to miss on mobile | 44×44px create button; empty list shows CTA |
| Edit | — | Unchanged |
| Link | Wiki required Ctrl/Cmd+click in edit mode | Direct click on `[[link]]` text navigates |
| Search | Sidebar filter vs Ctrl+K palette (undiscoverable) | Documented gap; mobile context tabs enlarged |
| Open related | Relations empty was passive text | Action: create wiki link |
| Return (mobile) | Back cleared `activeNoteId` | Back only closes editor; selection preserved |

### Remaining friction (K-65)

- No note navigation stack (wiki jump has no “back to previous”)
- Two search entry points not unified
- Sort/clear header buttons still compact on desktop

## Knowledge / Cosmos Flow

| Step | Before | After |
|------|--------|-------|
| Open Cosmos | Context graph vs full graph naming unclear | Empty graph tab offers “Open full Cosmos” |
| Explore | Small moon nodes hard to tap | Touch halo (+12px min 18–22px radius) |
| Preview | Mobile relies on sheet Open button | Enter key opens note from preview |
| Open note | Double-click only on desktop | Enter from preview; mobile sheet unchanged |
| Return | Escape closes preview | Unchanged; Enter now opens and closes preview |

### Graph context dead end (fixed)

Previously: Graph tab rendered nothing when `localGraphData` was null.  
Now: `KnowledgePanelEmpty` with wiki link + full Cosmos actions.

## Schedule Flow

| Step | Status |
|------|--------|
| Create routine | Add input always visible below list |
| Complete | 44px row tap targets |
| Review | Day/week swipe from K-62 |
| Reschedule | Exception day flow unchanged |

### Gap

- Empty routine/todo states passive; add field below is implicit guidance (acceptable)

## Health Flow

| Step | Before | After |
|------|--------|-------|
| Track blocks | Empty state passive | Tap empty → open block modal |
| Edit block | Hover-only edit/delete on mobile | Visible on touch |
| Review | Compact nav tabs ~40px | `min-h-[44px]` on compact |
| Continue workout | Unchanged | — |

## Extra Clicks Eliminated

1. Mobile back → no re-select note from list
2. Wiki navigation in editor → no modifier key when clicking link
3. Cosmos preview → Enter opens note (keyboard users)
4. Empty note list → one-tap create
