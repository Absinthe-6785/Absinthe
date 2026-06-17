# K-92B3C — Cosmos RenderMap & Display Position Pipeline Audit

Branch: `k92b3c-rendermap-pipeline` (audit only — no production changes)

## Objective

Determine whether `renderMap` construction and `getDisplayPos()` resolution are dominant steady-state Cosmos costs after K-92B3A + K-92B3B.

## Harness

```bash
npm test -- k92b3cCosmosRenderMap
```

Files:

- `k92b3cCosmosRenderMapAudit.ts`
- `k92b3cCosmosRenderMapAudit.test.ts`

## Out of scope

Production changes to `NoteGraphView.tsx` — implementation deferred to K-92B3C1/C2/B4.
