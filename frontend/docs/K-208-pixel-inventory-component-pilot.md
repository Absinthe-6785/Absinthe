# K-208 Pixel Inventory Component Pilot

## Scope

K-208 introduces a narrow pixel inventory visual pilot for Attachment Maintenance. The pilot validates K-207's pixel panel, card, and badge grammar against a real low-risk surface: the manual upload queue review buckets.

This is a visual/component pilot only. It does not change upload execution, recovery execution, queue classification, diagnostics computation, Google Drive OAuth/session behavior, Supabase behavior, Notes persistence, Health, or Schedule.

## Files Changed

- `frontend/src/components/common/PixelInventory.tsx`
- `frontend/src/components/common/PixelInventory.test.ts`
- `frontend/src/components/views/noteview/EmbeddedAttachmentMigrationReviewPanel.tsx`
- `frontend/src/components/views/noteview/EmbeddedAttachmentMigrationReviewPanel.test.ts`
- `frontend/docs/K-207-pixel-ui-direction-grammar-spec.md`
- `frontend/docs/K-208-pixel-inventory-component-pilot.md`

## Visual Primitives

The pilot adds two small primitives:

- `PixelInventoryCard`: a restrained inventory-slot frame with a subtle stepped/pixel border cue.
- `PixelStatusBadge`: a text-first badge with a small marker and readable state label.

Supported pilot states:

- Ready / Inventory slot
- Blocked / Locked slot
- Manual Review / Review slot
- Synced / Archived slot
- Missing Local / Broken slot
- Recoverable / Remote signal
- Inventory / Neutral slot

Status remains text-first. The pixel marker is a secondary cue, not the only state indicator.

## Pilot Surface

The manual upload queue review buckets now use the inventory card treatment:

- Ready for manual upload
- Blocked
- Needs manual review
- Already synced

The existing native checkbox and button controls remain in place. The pilot adds visible focus-ring classes to the limited upload selection checkbox, per-item upload button, and selected upload button.

## Accessibility Checks

K-208 preserves:

- readable state labels
- icon/text rather than icon-only status
- non-color state cues
- native checkbox and button controls
- keyboard-operable controls
- visible focus ring via `abs-focus-ring`
- normal hit target sizing
- disabled state on unavailable selected upload action

## Rollback Criteria

Revert the pilot if:

- readability or contrast regresses
- keyboard navigation or tab order regresses
- focus ring becomes hard to see
- state labels become harder to understand
- blocked/disabled states look clickable
- cards clip text or create horizontal overflow
- upload, recovery, diagnostics, OAuth, Supabase, or persistence behavior changes
- assets, fonts, dependencies, or a broad theme system become necessary

## Next Recommendation

Keep the pilot in Attachment Maintenance until the grammar is reviewed in Cursor and CI. If accepted, K-209 can either refine the Attachment Maintenance pixel treatment or extract a slightly broader token/component contract. Do not expand into Notes/Cosmos, Health, or Schedule until the inventory pilot is judged readable and reversible.

## K-209 Polish Note

K-209 polishes spacing, vocabulary, badge placement, responsive wrapping, and focus acceptance for the same Attachment Maintenance pilot. The literal state remains primary while the pixel inventory metaphor stays secondary. K-209 does not change upload, recovery, queue, diagnostics, OAuth, Supabase, persistence, Health, or Schedule behavior.
