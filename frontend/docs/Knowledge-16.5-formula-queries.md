# Knowledge-16.5 — Formula Queries

## Scope

Connects the Formula Engine to the Query Engine via post-filter evaluation. Formula clauses compose with existing indexed clauses using AND semantics.

## Syntax

```
formula:<key><operator><value>
```

Operators: `>`, `<`, `>=`, `<=`, `=`, `!=`

Examples:

- `formula:completionRate>80`
- `tag:japanese formula:completionRate>80`
- `status:active formula:score>=100`

## Evaluation pipeline

```
parseQuery()
  → indexed clauses → KIS evaluateQuery (tag/property/relation)
  → formula clauses → computeFormulasForNote() post-filter
  → intersect results
```

Formula definitions resolve from:

1. **Database views** — `filterByDatabaseView` passes view `formulaColumns`
2. **Global catalog** — `buildFormulaQueryCatalog(databaseViews)` for search, saved views, rule collections

## Error policy

`FormulaValue.error` never matches a predicate — note is excluded.

## Validation

Expected: `npm run typecheck` PASS · `npm test` PASS · `npm run build` PASS
