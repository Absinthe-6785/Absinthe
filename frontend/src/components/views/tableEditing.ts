import type { CSSProperties } from 'react';
import type { BlockEditorColors } from './editorTypes';

export const tableCellKey = (row: number, col: number) => `${row},${col}`;

export function updateTableHeader(
  headers: string[],
  colIndex: number,
  value: string,
): string[] {
  const next = [...headers];
  next[colIndex] = value;
  return next;
}

export function updateTableCell(
  rows: string[][],
  rowIndex: number,
  colIndex: number,
  value: string,
): string[][] {
  return rows.map((row, ri) =>
    ri === rowIndex ? row.map((cell, cj) => cj === colIndex ? value : cell) : row,
  );
}

export function addTableRow(
  rows: string[][],
  colCount: number,
  afterIdx?: number,
): string[][] {
  const emptyRow = Array(colCount).fill('');
  return afterIdx !== undefined
    ? [...rows.slice(0, afterIdx + 1), emptyRow, ...rows.slice(afterIdx + 1)]
    : [...rows, emptyRow];
}

export function deleteTableRow(rows: string[][], rowIndex: number): string[][] | null {
  if (rows.length <= 1) return null;
  return rows.filter((_, ri) => ri !== rowIndex);
}

export function addTableColumn(
  headers: string[],
  rows: string[][],
  afterIdx: number,
): { headers: string[]; rows: string[][] } {
  const nextHeaders = [
    ...headers.slice(0, afterIdx + 1),
    `Col ${headers.length + 1}`,
    ...headers.slice(afterIdx + 1),
  ];
  const nextRows = rows.map(row => [
    ...row.slice(0, afterIdx + 1),
    '',
    ...row.slice(afterIdx + 1),
  ]);
  return { headers: nextHeaders, rows: nextRows };
}

export function deleteTableColumn(
  headers: string[],
  rows: string[][],
  colIndex: number,
): { headers: string[]; rows: string[][] } | null {
  if (headers.length <= 1) return null;
  return {
    headers: headers.filter((_, i) => i !== colIndex),
    rows: rows.map(row => row.filter((_, i) => i !== colIndex)),
  };
}

export function tableHeaderBtnStyle(c: BlockEditorColors): CSSProperties {
  return {
    background: c.card,
    border: `1px solid ${c.border}`,
    borderRadius: c.radiusBtn ?? 8,
    padding: '3px 4px',
    cursor: 'pointer',
    color: c.textMuted,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  };
}
