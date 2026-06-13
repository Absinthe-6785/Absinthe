import React, { useState, useRef, useCallback, type ReactNode, type CSSProperties } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import {
  addTableColumn,
  addTableRow,
  deleteTableColumn,
  deleteTableRow,
  tableCellKey,
  updateTableCell,
  updateTableHeader,
} from './tableEditing';
import {
  focusAfterColDelete,
  focusAfterRowDelete,
  navigateTableCellEnter,
  navigateTableCellTab,
  navigateTableHeaderEnter,
  navigateTableHeaderTab,
  type TableNavAction,
} from './tableNavigation';

export interface TableBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  searchQuery: string;
  inline: (s: string) => ReactNode;
  onTableChange: (blockId: string, headers: string[], rows: string[][]) => void;
}

export function TableBlock({ block, colors: c, readOnly, inline, onTableChange }: TableBlockProps) {
  const { t } = useTranslation();
  const headers = block.tableHeaders ?? [];
  const rows = block.tableRows ?? [];
  const colCount = headers.length;

  const [focusedCell, setFocusedCell] = useState<[number, number] | null>(null);
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerCell = useCallback((r: number, ci: number, el: HTMLElement | null) => {
    const k = tableCellKey(r, ci);
    if (el) cellRefs.current.set(k, el);
    else cellRefs.current.delete(k);
  }, []);

  const focusCell = useCallback((r: number, ci: number) => {
    const el = cellRefs.current.get(tableCellKey(r, ci));
    if (el) { el.focus(); setFocusedCell([r, ci]); }
  }, []);

  const applyNavAction = useCallback((action: TableNavAction) => {
    if (action.type === 'focus') {
      const [r, ci] = action.cell;
      focusCell(r, ci);
      return;
    }
    const next = addTableRow(rows, colCount);
    onTableChange(block.id, headers, next);
    requestAnimationFrame(() => focusCell(action.focusRow, 0));
  }, [block.id, headers, rows, colCount, onTableChange, focusCell]);

  const updateHeader = useCallback((ci: number, val: string) => {
    onTableChange(block.id, updateTableHeader(headers, ci, val), rows);
  }, [block.id, headers, rows, onTableChange]);

  const updateCell = useCallback((r: number, ci: number, val: string) => {
    onTableChange(block.id, headers, updateTableCell(rows, r, ci, val));
  }, [block.id, headers, rows, onTableChange]);

  const addRow = useCallback((afterIdx?: number) => {
    const next = addTableRow(rows, colCount, afterIdx);
    onTableChange(block.id, headers, next);
    const newRowIdx = afterIdx !== undefined ? afterIdx + 1 : next.length - 1;
    requestAnimationFrame(() => focusCell(newRowIdx, 0));
  }, [block.id, headers, rows, colCount, onTableChange, focusCell]);

  const deleteRow = useCallback((r: number) => {
    const next = deleteTableRow(rows, r);
    if (!next) return;
    onTableChange(block.id, headers, next);
    requestAnimationFrame(() => {
      const [targetRow, col] = focusAfterRowDelete(r);
      focusCell(targetRow, col);
    });
  }, [block.id, headers, rows, onTableChange, focusCell]);

  const addCol = useCallback((afterIdx: number) => {
    const { headers: nextHeaders, rows: nextRows } = addTableColumn(headers, rows, afterIdx);
    onTableChange(block.id, nextHeaders, nextRows);
    requestAnimationFrame(() => focusCell(-1, afterIdx + 1));
  }, [block.id, headers, rows, onTableChange, focusCell]);

  const deleteCol = useCallback((ci: number) => {
    const result = deleteTableColumn(headers, rows, ci);
    if (!result) return;
    onTableChange(block.id, result.headers, result.rows);
    requestAnimationFrame(() => {
      const [r, col] = focusAfterColDelete(ci);
      focusCell(r, col);
    });
  }, [block.id, headers, rows, onTableChange, focusCell]);

  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    r: number, ci: number,
  ) => {
    const totalRows = rows.length;

    if (e.key === 'Tab') {
      e.preventDefault();
      applyNavAction(navigateTableCellTab(r, ci, colCount, totalRows, e.shiftKey));
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      applyNavAction(navigateTableCellEnter(r, ci, totalRows));
    }

    if (e.key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
      setFocusedCell(null);
    }
  }, [rows.length, colCount, applyNavAction]);

  const handleHeaderKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLElement>,
    ci: number,
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      applyNavAction(navigateTableHeaderTab(ci, colCount, rows.length, e.shiftKey));
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      applyNavAction(navigateTableHeaderEnter(ci));
    }
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
      setFocusedCell(null);
    }
  }, [colCount, rows.length, applyNavAction]);

  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  if (!colCount) return <div style={{ color: c.textFaint, fontSize: 13 }}>{t('blockEmptyTable')}</div>;

  if (readOnly) {
    return (
      <div style={{ overflowX: 'auto', margin: '4px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
          <thead>
            <tr>{headers.map((h, i) => (
              <th key={i} style={{ border: `1px solid ${c.border}`, padding: '7px 12px', background: c.toolbar, color: c.text, fontWeight: 700, textAlign: 'left' }}>
                {inline(h)}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} style={{ background: r % 2 === 0 ? 'transparent' : c.card }}>
                {headers.map((_, ci) => (
                  <td key={ci} style={{ border: `1px solid ${c.border}`, padding: '6px 12px', color: c.text }}>
                    {inline(row[ci] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const cellEditStyle = (focused: boolean): CSSProperties => ({
    outline: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minWidth: 60,
    width: '100%',
    background: focused ? c.accentBg : 'transparent',
    transition: 'background .1s',
    borderRadius: 3,
    padding: '1px 2px',
    margin: '-1px -2px',
  });

  const thStyle = (ci: number): CSSProperties => ({
    border: `1px solid ${c.border}`,
    padding: '6px 10px',
    background: c.toolbar,
    color: c.text,
    fontWeight: 700,
    textAlign: 'left',
    position: 'relative',
    minWidth: 80,
  });

  const tdStyle = (r: number): CSSProperties => ({
    border: `1px solid ${c.border}`,
    padding: '5px 10px',
    color: c.text,
    background: r % 2 === 0 ? 'transparent' : c.card,
    position: 'relative',
    minWidth: 80,
  });

  const iconBtn = (onClick: () => void, title: string, content: ReactNode, danger = false): ReactNode => (
    <button
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        background: danger ? `${c.danger}18` : c.card,
        border: `1px solid ${danger ? c.danger + '60' : c.border}`,
        borderRadius: 4, padding: '1px 4px', cursor: 'pointer',
        color: danger ? c.danger : c.textMuted,
        fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center',
      }}
    >{content}</button>
  );

  return (
    <div style={{ overflowX: 'auto', margin: '4px 0' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 14, tableLayout: 'auto' }}>
        <thead>
          <tr>
            <td style={{ width: 24, padding: 0, border: 'none' }}/>
            {headers.map((h, ci) => (
              <th
                key={ci}
                style={thStyle(ci)}
                onMouseEnter={() => setHoveredCol(ci)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                {hoveredCol === ci && (
                  <div style={{
                    position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 2, zIndex: 10, background: c.card,
                    border: `1px solid ${c.border}`, borderRadius: 5, padding: '2px 3px',
                    boxShadow: '0 2px 8px #00000018',
                  }}>
                    {iconBtn(() => addCol(ci), t('blockAddColumnRight'), <Plus size={10}/>)}
                    {iconBtn(() => deleteCol(ci), t('blockDeleteColumn'), <Trash2 size={10}/>, true)}
                  </div>
                )}
                <span
                  ref={el => registerCell(-1, ci, el)}
                  contentEditable
                  suppressContentEditableWarning
                  style={cellEditStyle(
                    focusedCell !== null && focusedCell[0] === -1 && focusedCell[1] === ci,
                  )}
                  onFocus={() => setFocusedCell([-1, ci])}
                  onBlur={e => {
                    updateHeader(ci, e.currentTarget.innerText.replace(/\n$/, ''));
                    setFocusedCell(null);
                  }}
                  onKeyDown={e => handleHeaderKeyDown(e, ci)}
                  onPaste={e => {
                    e.preventDefault();
                    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                  }}
                  dangerouslySetInnerHTML={{ __html: h }}
                />
              </th>
            ))}
            <th style={{ border: 'none', padding: '4px 6px', background: 'transparent', width: 28 }}>
              <button
                onMouseDown={e => { e.preventDefault(); addCol(headers.length - 1); }}
                title={t('blockAddColumn')}
                style={{
                  background: 'none', border: `1px dashed ${c.border}`,
                  borderRadius: 4, padding: '3px 5px', cursor: 'pointer',
                  color: c.textFaint, fontSize: 11, lineHeight: 1,
                }}
              ><Plus size={10}/></button>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, r) => (
            <tr
              key={r}
              onMouseEnter={() => setHoveredRow(r)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td style={{ width: 24, padding: '0 2px', border: 'none', verticalAlign: 'middle' }}>
                {hoveredRow === r && (
                  <button
                    onMouseDown={e => { e.preventDefault(); deleteRow(r); }}
                    title={t('blockDeleteRow')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: c.danger, padding: '2px', opacity: 0.7, lineHeight: 1,
                      display: 'flex', alignItems: 'center',
                    }}
                  ><Trash2 size={11}/></button>
                )}
              </td>
              {headers.map((_, ci) => (
                <td
                  key={ci}
                  style={tdStyle(r)}
                  onMouseEnter={() => setHoveredCol(ci)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <span
                    ref={el => registerCell(r, ci, el)}
                    contentEditable
                    suppressContentEditableWarning
                    style={cellEditStyle(
                      focusedCell !== null && focusedCell[0] === r && focusedCell[1] === ci,
                    )}
                    onFocus={() => setFocusedCell([r, ci])}
                    onBlur={e => {
                      updateCell(r, ci, e.currentTarget.innerText.replace(/\n$/, ''));
                      setFocusedCell(null);
                    }}
                    onKeyDown={e => handleCellKeyDown(e, r, ci)}
                    onPaste={e => {
                      e.preventDefault();
                      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                    }}
                    dangerouslySetInnerHTML={{ __html: row[ci] ?? '' }}
                  />
                </td>
              ))}
              <td style={{ border: 'none', width: 28 }}/>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={colCount + 2} style={{ border: 'none', padding: '4px 0 2px' }}>
              <button
                onMouseDown={e => { e.preventDefault(); addRow(); }}
                title={t('blockAddRow')}
                style={{
                  background: 'none', border: `1px dashed ${c.border}`,
                  borderRadius: 5, padding: '3px 12px', cursor: 'pointer',
                  color: c.textFaint, fontSize: 12, display: 'flex',
                  alignItems: 'center', gap: 4,
                }}
              >
                <Plus size={11}/> {t('blockAddRow')}
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
