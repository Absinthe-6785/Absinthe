# K-46 History Export

`knowledgeHistoryExport.ts` generates deterministic Markdown locally.

## Trigger

Timeline → **Export Markdown** copies to clipboard.

## Format

```markdown
# Cosmos Evolution

## Milestones
- First Note: ...
- First Link: ...

## Current
- N Notes
- N Links
- N Hubs

## Growth
- +N notes
...

## Highlights
- Fastest growing area: ...
```

## API

- `exportCosmosEvolutionMarkdown(options)` → string
- `copyCosmosEvolutionMarkdown(markdown)` → boolean

## Limitations

- Clipboard API required (no file download in v1)
- Milestone labels use id slugs for scale milestones
- No activity feed or per-area sections yet
