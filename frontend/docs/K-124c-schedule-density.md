# K-124c — Schedule Density Recovery

Restore the compact K-108–K-116 visual rhythm after the K-117 unified Schedule
workspace.

## Changes

- Empty Upcoming panels are `display:none`, preserving the section anchor
  contract without consuming a flex gap.
- Upcoming tiers and day groups use tighter vertical spacing.
- Upcoming scrolling is capped at 200px.
- Today / Upcoming receives 28% of the desktop stack and Calendar 72%.
- Routine no longer adds a second bottom margin on top of the parent gap.
- Embedded Timetable padding and populated minimum height are reduced.
- Empty embedded Timetable is a compact 64px hint; the header’s existing Add
  action remains the single CTA.

No schedule data, CRUD, projection, or navigation behavior changed.

## Verification

```powershell
npm test -- k124c
npm run typecheck
npm run build
```
