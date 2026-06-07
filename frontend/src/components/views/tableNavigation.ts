/** Pure keyboard navigation targets for table cells. row=-1 is header row. */

export type TableCellCoord = [number, number];

export type TableNavAction =
  | { type: 'focus'; cell: TableCellCoord }
  | { type: 'addRow'; focusRow: number };

export function navigateTableCellTab(
  row: number,
  col: number,
  colCount: number,
  totalRows: number,
  shiftKey: boolean,
): TableNavAction {
  if (!shiftKey) {
    if (col < colCount - 1) return { type: 'focus', cell: [row, col + 1] };
    if (row < totalRows - 1) return { type: 'focus', cell: [row + 1, 0] };
    return { type: 'addRow', focusRow: totalRows };
  }
  if (col > 0) return { type: 'focus', cell: [row, col - 1] };
  if (row > 0) return { type: 'focus', cell: [row - 1, colCount - 1] };
  return { type: 'focus', cell: [-1, colCount - 1] };
}

export function navigateTableCellEnter(
  row: number,
  col: number,
  totalRows: number,
): TableNavAction {
  if (row < totalRows - 1) return { type: 'focus', cell: [row + 1, col] };
  return { type: 'addRow', focusRow: totalRows };
}

export function navigateTableHeaderTab(
  col: number,
  colCount: number,
  totalRows: number,
  shiftKey: boolean,
): TableNavAction {
  if (!shiftKey) {
    if (col < colCount - 1) return { type: 'focus', cell: [-1, col + 1] };
    return { type: 'focus', cell: [0, 0] };
  }
  if (col > 0) return { type: 'focus', cell: [-1, col - 1] };
  return { type: 'focus', cell: [totalRows - 1, colCount - 1] };
}

export function navigateTableHeaderEnter(col: number): TableNavAction {
  return { type: 'focus', cell: [0, col] };
}

/** Focus target after deleting a row */
export function focusAfterRowDelete(deletedRow: number): TableCellCoord {
  const targetRow = deletedRow > 0 ? deletedRow - 1 : -1;
  return [targetRow, 0];
}

/** Focus target after deleting a column */
export function focusAfterColDelete(colIndex: number): TableCellCoord {
  return [-1, Math.max(0, colIndex - 1)];
}
