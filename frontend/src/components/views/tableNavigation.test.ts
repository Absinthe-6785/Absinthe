import { describe, expect, it } from 'vitest';
import {
  focusAfterColDelete,
  focusAfterRowDelete,
  navigateTableCellEnter,
  navigateTableCellTab,
  navigateTableHeaderEnter,
  navigateTableHeaderTab,
} from './tableNavigation';

describe('tableNavigation', () => {
  const colCount = 3;
  const totalRows = 2;

  it('Tab moves to next column', () => {
    expect(navigateTableCellTab(0, 1, colCount, totalRows, false))
      .toEqual({ type: 'focus', cell: [0, 2] });
  });

  it('Tab wraps to next row', () => {
    expect(navigateTableCellTab(0, 2, colCount, totalRows, false))
      .toEqual({ type: 'focus', cell: [1, 0] });
  });

  it('Tab on last cell adds new row', () => {
    expect(navigateTableCellTab(1, 2, colCount, totalRows, false))
      .toEqual({ type: 'addRow', focusRow: 2 });
  });

  it('Shift+Tab moves to previous column', () => {
    expect(navigateTableCellTab(1, 1, colCount, totalRows, true))
      .toEqual({ type: 'focus', cell: [1, 0] });
  });

  it('Shift+Tab on first cell of row goes to previous row last col', () => {
    expect(navigateTableCellTab(1, 0, colCount, totalRows, true))
      .toEqual({ type: 'focus', cell: [0, 2] });
  });

  it('Shift+Tab on first data cell goes to header', () => {
    expect(navigateTableCellTab(0, 0, colCount, totalRows, true))
      .toEqual({ type: 'focus', cell: [-1, 2] });
  });

  it('Enter moves down within table', () => {
    expect(navigateTableCellEnter(0, 1, totalRows))
      .toEqual({ type: 'focus', cell: [1, 1] });
  });

  it('Enter on last row adds new row', () => {
    expect(navigateTableCellEnter(1, 0, totalRows))
      .toEqual({ type: 'addRow', focusRow: 2 });
  });

  it('header Tab moves across header', () => {
    expect(navigateTableHeaderTab(0, colCount, totalRows, false))
      .toEqual({ type: 'focus', cell: [-1, 1] });
  });

  it('header Tab from last col goes to first data cell', () => {
    expect(navigateTableHeaderTab(2, colCount, totalRows, false))
      .toEqual({ type: 'focus', cell: [0, 0] });
  });

  it('header Enter goes to first row same column', () => {
    expect(navigateTableHeaderEnter(1)).toEqual({ type: 'focus', cell: [0, 1] });
  });

  it('focusAfterRowDelete targets previous row or header', () => {
    expect(focusAfterRowDelete(2)).toEqual([1, 0]);
    expect(focusAfterRowDelete(0)).toEqual([-1, 0]);
  });

  it('focusAfterColDelete targets previous column in header', () => {
    expect(focusAfterColDelete(2)).toEqual([-1, 1]);
    expect(focusAfterColDelete(0)).toEqual([-1, 0]);
  });
});
