import { describe, expect, it } from 'vitest';
import {
  addTableColumn,
  addTableRow,
  deleteTableColumn,
  deleteTableRow,
  updateTableCell,
  updateTableHeader,
} from './tableEditing';

describe('tableEditing', () => {
  const headers = ['A', 'B'];
  const rows = [['1', '2'], ['3', '4']];

  it('updateTableHeader replaces column header', () => {
    expect(updateTableHeader(headers, 1, 'Beta')).toEqual(['A', 'Beta']);
  });

  it('updateTableCell replaces one cell', () => {
    expect(updateTableCell(rows, 1, 0, '9')).toEqual([['1', '2'], ['9', '4']]);
  });

  it('addTableRow appends empty row', () => {
    expect(addTableRow(rows, 2)).toEqual([['1', '2'], ['3', '4'], ['', '']]);
  });

  it('addTableRow inserts after index', () => {
    expect(addTableRow(rows, 2, 0)).toEqual([['1', '2'], ['', ''], ['3', '4']]);
  });

  it('deleteTableRow keeps minimum one row', () => {
    expect(deleteTableRow([['x']], 0)).toBeNull();
    expect(deleteTableRow(rows, 1)).toEqual([['1', '2']]);
  });

  it('addTableColumn inserts column', () => {
    const result = addTableColumn(headers, rows, 0);
    expect(result.headers).toEqual(['A', 'Col 3', 'B']);
    expect(result.rows[0]).toEqual(['1', '', '2']);
  });

  it('deleteTableColumn keeps minimum one column', () => {
    expect(deleteTableColumn(['only'], [['x']], 0)).toBeNull();
    const result = deleteTableColumn(headers, rows, 1);
    expect(result?.headers).toEqual(['A']);
    expect(result?.rows).toEqual([['1'], ['3']]);
  });
});
