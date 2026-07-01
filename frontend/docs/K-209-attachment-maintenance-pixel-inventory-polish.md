# K-209 Attachment Maintenance Pixel Inventory Polish

## Scope

K-209 polishes the K-208 Attachment Maintenance pixel inventory pilot. The pilot remains limited to the manual upload queue review buckets and the shared `PixelInventory` primitives.

This is a visual and accessibility polish pass only. It does not change upload execution, recovery execution, queue classification, diagnostics computation, Google Drive OAuth/session behavior, Supabase behavior, Notes persistence, Health, or Schedule.

## What Was Polished

- Title/count spacing now uses a small readable count chip instead of crowding the title.
- Long bucket titles can wrap safely without dropping count or status text.
- Status badge padding and line height were adjusted for better readability.
- Badge vocabulary now makes the literal state primary and the pixel metaphor secondary.
- Focus-ring classes remain on the pilot upload controls.

## Vocabulary Decisions

- Ready remains `Ready`; `Inventory slot` is secondary.
- Blocked remains `Blocked`; `Locked slot` is secondary and does not imply force-run capability.
- Manual Review remains `Manual Review`; `Review slot` is secondary and does not imply automatic repair.
- Synced remains `Synced`; `Archived slot` is secondary and does not imply cleanup or deletion.
- Missing Local remains `Missing Local`; `Broken slot` is secondary.
- Recoverable remains `Recoverable`; `Remote signal` is secondary.

Literal state text must stay visible. The marker and color are supporting cues only.

## Accessibility Checks

K-209 preserves:

- visible status labels
- non-icon-only badges
- non-color-only state cues
- native checkbox and button controls
- keyboard-operable pilot controls
- visible `abs-focus-ring` focus styles on pilot controls
- disabled state on unavailable selected upload action
- normal hit target sizing

## Responsive / Overflow Checks

The pilot is expected to avoid horizontal overflow. Bucket cards use wrapping title text, a compact count chip, and contained badge text. Long attachment names must not remove action labels or status labels.

## Rollback Criteria

Revert the polish if:

- readability or contrast regresses
- status meaning becomes less clear
- badge placement hides action labels
- keyboard navigation or tab order regresses
- focus indication becomes hard to see
- cards clip text or create horizontal overflow
- upload, recovery, diagnostics, OAuth, Supabase, or persistence behavior changes
- assets, fonts, dependencies, or a broad theme system become necessary

## Non-Goals

- No broader app redesign.
- No full Attachment Maintenance redesign.
- No expansion into Notes/Cosmos, Health, Schedule, Archive, or Settings.
- No generated image assets.
- No pixel font files.
- No new dependencies.
- No upload-all, run-queue, retry-all, continue-queue, recover-all, or download-all behavior.

## Next Recommendation

Review the polished Attachment Maintenance pilot in Cursor. If the literal-state-plus-inventory-metaphor grammar reads clearly, the next safe step is a small Attachment Maintenance visual pass that stays display-only and continues to avoid behavior changes.
