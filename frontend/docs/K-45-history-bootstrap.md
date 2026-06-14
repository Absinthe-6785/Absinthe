# K-45 History Bootstrap

`historyBootstrap.ts` seeds history for existing vaults that predate K-44 recording.

## Trigger

`maybeBootstrapKnowledgeHistory(notes, service)` runs from `NoteView` when notes load.

## Idempotency

1. Storage flag: `absinthe:knowledge-history-bootstrap:v1` → `1` when complete
2. Deterministic event ids: `bootstrap-note-{id}`, `bootstrap-link-{noteId}-{linkKey}`, etc.
3. Skips if any **non-imported** (real) history already exists

## Seeded events

| Source | Event type |
|--------|------------|
| `noteEffectiveCreatedAt` | `NOTE_CREATED` |
| `[[links]]` in body | `LINK_CREATED` |
| `area` property | `AREA_ASSIGNED` |
| Area notes (`isAreaNote`) | `HUB_CREATED` |

## Imported markers

Every bootstrap event includes:

```json
{
  "metadata": {
    "imported": "true",
    "source": "bootstrap"
  }
}
```

UI shows **Imported** badge in the activity feed and hints in evolution summary/story when history is imported-only.

## Requirements met

- Run once per vault (local flag)
- Local only (same storage as K-44)
- Idempotent (deterministic ids + flag)
- Clearly distinct from real history (`hasNonImportedHistory()`)

## Limitations

- Timestamps are inferred from `createdAt`, not true edit order
- Links seed from wikilink text, not resolved note ids
- Cannot be reversed automatically (clear history + bootstrap flag manually)

## Future

- Optional user prompt before bootstrap
- Partial re-bootstrap for new notes only (currently blocked after flag set)
