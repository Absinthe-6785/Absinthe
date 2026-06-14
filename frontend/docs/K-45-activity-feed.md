# K-45 Activity Feed

`TimelineActivityFeed.tsx` renders recorded K-44 history events in the Timeline **Activity** subsection.

## Behavior

- Events sorted newest-first, grouped by calendar day (localized date labels)
- Each row: action label (i18n) + detail (note title, link pair, area, hub name)
- **Imported** badge when `metadata.imported === 'true'`
- Click navigates to the primary `noteId` when `onNavigateToNote` is provided
- Caps display at 120 events with truncation notice

## Data source

Only events from `loadKnowledgeHistoryEvents()`. No synthetic or estimated entries.

## Presentation

`presentHistoryEvent()` maps event types to i18n keys:

| Type | Label key |
|------|-----------|
| `NOTE_CREATED` | `k45EventNoteCreated` |
| `LINK_CREATED` | `k45EventLinkCreated` |
| `HUB_CREATED` | `k45EventHubCreated` |
| `DISCOVERY_RESOLVED` | action-specific (`k45EventDiscoveryLink`, etc.) |

## Limitations

- No virtualization yet (120-event cap instead)
- Drill-through opens primary note only, not related note on link events
- Deleted notes show raw id when title metadata is missing

## Future

- Virtual list when event count exceeds cap routinely
- Secondary navigation for `relatedNoteId` on links
