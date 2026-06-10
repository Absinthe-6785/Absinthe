import type { DatabaseView } from '../databaseViews/databaseViewModels';
import { getTableConfig } from '../databaseViews/databasePresentationConfig';
import type { FormulaColumnDefinition } from './formulaModels';

/** Merge formula columns from database views — first definition wins per key */
export function buildFormulaQueryCatalog(
  views: readonly DatabaseView[],
): FormulaColumnDefinition[] {
  const byKey = new Map<string, FormulaColumnDefinition>();

  for (const view of views) {
    const table = getTableConfig(view);
    for (const column of table.formulaColumns ?? []) {
      const key = column.key.trim().toLowerCase();
      if (!key || byKey.has(key)) continue;
      byKey.set(key, column);
    }
  }

  return [...byKey.values()];
}

/** Catalog columns required to evaluate the given formula keys (includes formula→formula deps) */
export function formulaColumnsForKeys(
  catalog: readonly FormulaColumnDefinition[],
  keys: readonly string[],
): FormulaColumnDefinition[] {
  const required = new Set<string>();
  const byKey = new Map(
    catalog.map(column => [column.key.trim().toLowerCase(), column]),
  );

  const visit = (key: string) => {
    const norm = key.trim().toLowerCase();
    if (required.has(norm)) return;
    const column = byKey.get(norm);
    if (!column) return;
    required.add(norm);
    for (const input of Object.values(column.formula.inputs)) {
      if (input.type === 'formula') {
        visit(input.formulaKey);
      }
    }
  };

  for (const key of keys) {
    visit(key);
  }

  return catalog.filter(column => required.has(column.key.trim().toLowerCase()));
}
