# Knowledge-16 — Formula Foundation

## Scope

Implements Phase 1 Formula Engine: arithmetic expressions, property/rollup/formula/metadata inputs, dependency graph evaluation, database table columns, and view controls UX.

## Deliverables

| Component | Description |
| --------- | ----------- |
| `computeFormula.ts` | Phase 1 expression parser + evaluator |
| `computeFormulas.ts` | Batch evaluation, topological order, per-render memo |
| `formulaModels.ts` | Types, normalization, dependency graph (K-16.0) |
| `DatabaseTableConfig.formulaColumns` | Presentation config extension |
| `databaseViewOperations.ts` | Add/remove/visibility for formula columns |
| `DatabaseTableView` | Formula column rendering |
| `DatabaseViewControls` | Formula column authoring UX |

## Phase 1 language

- Arithmetic: `+`, `-`, `*`, `/`
- Grouping: `()`
- Input references bound via `FormulaDefinition.inputs`

## Evaluation pipeline

```
filterNotes()
  → computeRollup() (per rollup column)
  → computeFormulasForNote() (topological formula order)
  → render table cells
```

## Validation

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS
