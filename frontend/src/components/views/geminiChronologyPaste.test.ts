// @vitest-environment happy-dom
/**
 * Regression: Gemini-style chronology table paste → table block → edit render.
 * Reproduces the original Plus crash path (table in edit mode) without a browser.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { renderBlockContent } from './blockRegistry';
import { applyPasteAtBlock, applyPasteBlocksAt } from './blockPaste';
import { clipboardToBlocks } from './pasteOrchestrator';
import { htmlDocumentToBlocks } from './htmlDocumentToBlocks';
import { loadValidatedBlocks } from './documentRecovery';
import { markdownToBlocks, makeBlock } from './blockUtils';
import {
  htmlTableToMarkdown,
  parseStructuredPaste,
  prepareStructuredPasteText,
} from './pasteStructure';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';

/** Typical Gemini chronology export (markdown pipe table). */
const GEMINI_CHRONOLOGY_MD = `| 연도 | 시기 | 주요 사건 |
| --- | --- | --- |
| 1392 | 조선 건국 | 위화도 회군, 조선 건국 |
| 1592 | 임진왜란 | 이순신 활약, 거북선 |
| 1910 | 일제강점기 | 국권 픠탈 |`;

/** HTML table shape often copied from Gemini chat UI. */
const GEMINI_CHRONOLOGY_HTML = `<div><table>
<thead><tr><th>연도</th><th>시기</th><th>주요 사건</th></tr></thead>
<tbody>
<tr><td>1392</td><td>조선 건국</td><td>위화도 회군</td></tr>
<tr><td>1592</td><td>임진왜란</td><td>이순신 거북선</td></tr>
</tbody>
</table></div>`;

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

function editCtx(): BlockRenderContext {
  return {
    toggleOpen: true,
    inline: s => s,
    onToggleCollapse: () => {},
    onToggleTodo: () => {},
    getBlocks: () => [],
    onChange: () => {},
    searchQuery: '',
    depth: 0,
    readOnly: false,
    wikiTargets: [],
    onSelect: () => {},
    onAddBelow: () => {},
    onSplitBlock: () => {},
    onMergeWithPrev: () => {},
    onContentChange: () => {},
    editableRef: { current: null },
    onSlashOpen: () => {},
    onSlashClose: () => {},
    onWikiOpen: () => {},
    onWikiClose: () => {},
    isMenuOpen: false,
    onToggleAddChild: () => {},
    onToggleEnter: () => {},
    onTableChange: () => {},
    onNavigateBlock: () => {},
    onConvertBlock: () => {},
    getRootBlocks: () => [],
    onRootChange: () => {},
    searchQueryFor: () => '',
  };
}

function mountTableInEditMode(block: ReturnType<typeof makeBlock>): HTMLDivElement {
  const node = renderBlockContent(block, colors, editCtx());
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  expect(() => act(() => { root.render(node); })).not.toThrow();
  return container;
}

describe('Gemini chronology table paste', () => {
  it('markdown pipe table parses to table block', () => {
    const blocks = loadValidatedBlocks(GEMINI_CHRONOLOGY_MD, markdownToBlocks);
    expect(blocks.some(b => b.type === 'table')).toBe(true);
    const table = blocks.find(b => b.type === 'table')!;
    expect(table.tableHeaders).toEqual(['연도', '시기', '주요 사건']);
    expect(table.tableRows?.length).toBeGreaterThanOrEqual(2);
  });

  it('structured paste from markdown produces table block', () => {
    const blocks = parseStructuredPaste(GEMINI_CHRONOLOGY_MD);
    expect(blocks[0]?.type).toBe('table');
  });

  it('HTML table clipboard converts and parses to table', () => {
    const md = htmlTableToMarkdown(GEMINI_CHRONOLOGY_HTML);
    expect(md).toBeTruthy();
    expect(md).toContain('| 연도 |');
    const blocks = parseStructuredPaste(md!);
    expect(blocks[0]?.type).toBe('table');
  });

  it('prepareStructuredPasteText handles HTML table DataTransfer', () => {
    const dt = {
      getData: (type: string) => {
        if (type === 'text/html') return GEMINI_CHRONOLOGY_HTML;
        if (type === 'text/plain') return GEMINI_CHRONOLOGY_MD;
        return '';
      },
    };
    const text = prepareStructuredPasteText(dt);
    const blocks = parseStructuredPaste(text);
    expect(blocks.some(b => b.type === 'table')).toBe(true);
  });

  it('paste into paragraph creates table block without render throw', () => {
    const para = makeBlock('paragraph', { id: 'p1', content: '' });
    const result = applyPasteAtBlock([para], 'p1', 0, 0, GEMINI_CHRONOLOGY_MD);
    expect(result).toBeTruthy();
    const table = result!.blocks.find(b => b.type === 'table');
    expect(table).toBeTruthy();
    const el = mountTableInEditMode(table!);
    expect(el.textContent).toContain('행 추가');
    expect(el.textContent).toMatch(/1392|1592/);
  });

  it('full pipeline: loadValidatedBlocks + edit render (Plus regression)', () => {
    const blocks = loadValidatedBlocks(GEMINI_CHRONOLOGY_MD, markdownToBlocks);
    const table = blocks.find(b => b.type === 'table')!;
    const el = mountTableInEditMode(table);
    expect(el.querySelector('table')).toBeTruthy();
  });

  it('HTML-first orchestrator preserves article around table (not table-only)', () => {
    const html = `<h1>연대기</h1><p>소개</p>${GEMINI_CHRONOLOGY_HTML}<p>각주</p>`;
    const plain = GEMINI_CHRONOLOGY_MD;
    const dt = {
      getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : ''),
    };
    const blocks = clipboardToBlocks(dt)!;
    expect(blocks.map(b => b.type)).toEqual(['heading1', 'paragraph', 'table', 'paragraph']);
    expect(blocks[0].content).toBe('연대기');
    expect(blocks[1].content).toBe('소개');
    expect(blocks[3].content).toBe('각주');
  });

  it('applyPasteBlocksAt splices HTML document into editor', () => {
    const html = `<h1>Title</h1><p>A</p><table><tr><th>X</th></tr><tr><td>1</td></tr></table><p>B</p>`;
    const pasted = htmlDocumentToBlocks(html)!;
    const para = makeBlock('paragraph', { id: 'p1', content: '' });
    const result = applyPasteBlocksAt([para], 'p1', 0, 0, pasted);
    expect(result!.blocks.map(b => b.type)).toEqual(['heading1', 'paragraph', 'table', 'paragraph']);
  });
});
