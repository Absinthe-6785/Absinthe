# K-210 Attachment Pixel Item Row Overflow Hardening

## Scope

K-210 hardens the Attachment Maintenance Pixel Inventory pilot item rows introduced in K-208 and polished in K-209.

This is a visual and accessibility hardening pass only. It does not change upload execution, recovery execution, queue classification, diagnostics computation, Google Drive OAuth/session behavior, Supabase behavior, Notes persistence, Health, or Schedule.

## What Changed

- Manual upload queue review rows allow their text lane to shrink with `min-width: 0`.
- Long item labels and unbroken strings can break with `overflow-wrap: anywhere`.
- Per-item action buttons keep their visible labels and do not shrink into unreadable controls.
- Pixel status badges keep literal state text visible.
- Custom status badge labels override only the visible label; the state motif remains tied to the badge state.

## Manual QA

1. Open Notes.
2. Open Attachment Maintenance.
3. Refresh diagnostics if needed.
4. Confirm Pixel Inventory cards and buckets render.
5. Confirm Ready / Blocked / Manual Review / Synced labels remain literal and readable.
6. Confirm long attachment text does not create horizontal overflow.
7. Confirm Upload selected / Upload this item / explicit actions remain visible.
8. Confirm status badges do not overlap action buttons.
9. Confirm keyboard tab navigation reaches controls.
10. Confirm the focus ring is visible.
11. Confirm forbidden bulk controls are absent: Upload all, Run queue, Retry all, Continue queue, Recover all, Download all.
12. Smoke Health and Schedule.
13. Confirm no upload, recovery, or diagnostics behavior changed.

## Accessibility Notes

- Status labels remain text-visible and are not icon-only or color-only.
- Buttons remain native buttons with visible labels.
- Checkbox and button focus classes are preserved.
- Disabled states remain visible through native control behavior.
- No tiny icon-only hit targets were introduced.

## Non-Goals

- No full Attachment Maintenance redesign.
- No broader Pixel UI rollout.
- No generated assets, fonts, or dependencies.
- No upload-all, run-queue, retry-all, continue-queue, recover-all, or download-all behavior.
