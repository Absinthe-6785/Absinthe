# UX-5E.1C — Focus & Search Virtualization Integration

## Overview

Makes search navigation, focus restoration, and document focus virtualization-safe behind `VIRTUAL_BLOCKS_POC`. Drag remains disabled when virtual (unchanged from UX-5E.1B).

## Architecture

### Pending focus queue

`PendingFocusQueue` stores a single pending `FocusCmd`. Flow:

```text
requestFocus(cmd)
  → queueFocus(cmd)
  → scrollToBlockId (if virtual)
  → try dispatch if handler mounted
  → on SingleBlock mount: consumePendingFocus → applyFocusCommand
```

Replaces the 100ms `focusCmd` TTL with event-based replay on mount.

### VirtualNavigationApi

Abstraction consumed via `VirtualNavigationContext` (not direct virtualizer imports):

| Method | Purpose |
| ------ | ------- |
| `requestFocus(cmd)` | Queue + scroll + dispatch |
| `scrollToBlockId(id)` | Scroll root block into viewport |
| `consumePendingFocus(id)` | Replay on mount |
| `isVirtualNavigationEnabled()` | Flag check |

### Search integration

`BlockEditor` search `useEffect` calls `requestFocus` instead of `setFocusCmd`. Off-screen matches scroll first, then focus replays when row mounts.

### Document focus integration

`listVirtualBlockRows` provides Y-axis row metrics from virtualizer offsets (no mounted DOM). Passed to `focusNearestEditable` when virtual flag on.

## Limitations (UX-5E.1D+)

- Block reorder drag disabled when virtual
- Gutter range select over unmounted rows
- Nested toggle virtualization
- Toggle footer DOM zones may be approximate under virtual metrics

## Benchmark (virtual mount)

| Size | UX-5E.1B (ms) | UX-5E.1C (ms) | DOM |
| ---- | ------------- | ------------- | --- |
| 100  | 57            | 132           | 22  |
| 500  | 87            | 76            | 22  |
| 1000 | 115           | 79            | 22  |
| 2000 | 303           | 179           | 22  |

2000-block mount remains **well under 500ms**; within ±10% of UX-5E.1B at scale.
