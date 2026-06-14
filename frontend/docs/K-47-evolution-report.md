# K-47 Evolution Report

`KnowledgeEvolutionReport.ts` generates a deterministic period summary.

## Export kinds

| Kind | Content |
|------|---------|
| `report` | Evolution report (period growth + momentum highlights) |
| `evolution` | K-46 cosmos evolution markdown |
| `activity` | Activity feed (up to 200 events) |
| `journey` | Journey steps with dates |

## Delivery

Timeline → Export menu:

- **↗** Copy to clipboard
- **↓** Download `.md` file

Filenames: `knowledge-evolution-report-YYYY-MM-DD.md`, etc.

## Report sections

- Period (last 30 days)
- Growth (+notes, +links)
- Fastest / most active / connected / improved areas
- Latest milestone
- Dormant areas
- Cosmos momentum score

## Limitations

- Milestone titles use i18n keys in export (not localized prose)
- Report period fixed to momentum snapshot period
