// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { makeBlock, type Block } from '../../../../../blockUtils';
import {
  applySemanticCopy,
  blocksToCopyHtml,
  collectBlocksForCopy,
  handleEditorCopyEvent,
  trySemanticCopyFromBlock,
} from './blockCopy';
import { classifyClipboardPayloadVariant } from './copyClipboardVerification';
import { classifyClipboardHtml } from './copyDiagnostics';
import { clipboardToBlocks } from '../paste/pasteOrchestrator';
import { makeEjuBlocks } from '@/test/fixtures/ejuClipboardFixtures';

type TreeShape = { type: string; content?: string; checked?: boolean; collapsed?: boolean; indent?: number; children?: TreeShape[] };

function blockShape(blocks: Block[]): TreeShape[] {
  return blocks.map(b => ({
    type: b.type,
    content: b.content,
    ...(b.type === 'todo' ? { checked: b.checked } : {}),
    ...(b.type === 'toggle' ? { collapsed: b.collapsed } : {}),
    ...(b.type === 'bullet' || b.type === 'numbered' ? { indent: b.indent } : {}),
    children: b.children?.length ? blockShape(b.children) : undefined,
  }));
}

export function assertTreesEqual(a: Block[], b: Block[]): void {
  expect(shapesEqual(blockShape(a), blockShape(b))).toBe(true);
}

function shapesEqual(a: TreeShape[], b: TreeShape[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((block, i) => {
    const other = b[i];
    if (block.type !== other.type) return false;
    if ((block.content ?? '') !== (other.content ?? '')) return false;
    if (block.type === 'todo' && block.checked !== other.checked) return false;
    if (block.type === 'toggle' && (block.collapsed ?? false) !== (other.collapsed ?? false)) return false;
    if ((block.type === 'bullet' || block.type === 'numbered') && (block.indent ?? 0) !== (other.indent ?? 0)) return false;
    const ac = block.children ?? [];
    const bc = other.children ?? [];
    return shapesEqual(ac, bc);
  });
}

function roundTrip(blocks: Block[]): Block[] {
  const html = blocksToCopyHtml(blocks);
  const dt = {
    getData: (t: string) => (t === 'text/html' ? html : ''),
    setData: () => {},
  };
  return clipboardToBlocks(dt)!;
}

describe('blockCopy semantic round-trip', () => {
  it('toggle → copy → paste → identical structure', () => {
    const original = [
      makeBlock('toggle', {
        content: 'Toggle title',
        children: [makeBlock('paragraph', { content: 'Inside' })],
      }),
    ];
    expect(shapesEqual(blockShape(original), blockShape(roundTrip(original)))).toBe(true);
  });

  it('bullet → copy → paste → identical structure', () => {
    const original = [makeBlock('bullet', { content: 'List item', indent: 0 })];
    expect(shapesEqual(blockShape(original), blockShape(roundTrip(original)))).toBe(true);
  });

  it('nested toggle → copy → paste → identical structure', () => {
    const original = [
      makeBlock('toggle', {
        content: 'Outer',
        children: [
          makeBlock('paragraph', { content: 'Outer child' }),
          makeBlock('toggle', {
            content: 'Inner',
            children: [makeBlock('paragraph', { content: 'Deep' })],
          }),
        ],
      }),
    ];
    expect(shapesEqual(blockShape(original), blockShape(roundTrip(original)))).toBe(true);
  });

  it('todo → copy → paste → identical structure', () => {
    const original = [
      makeBlock('todo', { content: 'Task A', checked: false }),
      makeBlock('todo', { content: 'Task B', checked: true }),
    ];
    expect(shapesEqual(blockShape(original), blockShape(roundTrip(original)))).toBe(true);
  });

  it('emits details/summary HTML for toggles', () => {
    const html = blocksToCopyHtml([
      makeBlock('toggle', { content: 'T', children: [makeBlock('paragraph', { content: 'c' })] }),
    ]);
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).not.toContain('be-toggle-wrap');
  });

  it('emits ul/li for bullets not flex spans', () => {
    const html = blocksToCopyHtml([makeBlock('bullet', { content: 'Item' })]);
    expect(html).toMatch(/<ul><li>Item<\/li><\/ul>/);
  });

  it('trySemanticCopyFromBlock copies full toggle from partial header offsets', () => {
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'Header',
      children: [makeBlock('paragraph', { content: 'child' })],
    });
    const data: Record<string, string> = {};
    const ok = trySemanticCopyFromBlock([toggle], 't1', 2, 4, {
      setData: (type, val) => { data[type] = val; },
    });
    expect(ok).toBe(true);
    expect(data['text/html']).toContain('<details');
    const parsed = clipboardToBlocks({ getData: t => data[t] ?? '' })!;
    expect(parsed[0].type).toBe('toggle');
    expect(parsed[0].children[0].content).toBe('child');
  });

  it('trySemanticCopyFromBlock returns false for partial paragraph selection', () => {
    const p = makeBlock('paragraph', { id: 'p1', content: 'Hello world' });
    let called = false;
    const ok = trySemanticCopyFromBlock([p], 'p1', 0, 5, {
      setData: () => { called = true; },
    });
    expect(ok).toBe(false);
    expect(called).toBe(false);
  });

  it('collectBlocksForCopy preserves document order', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const collected = collectBlocksForCopy([a, b], new Set(['b', 'a']));
    expect(collected.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('collectBlocksForCopy dedupes toggle header + child to single toggle', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'child' });
    const toggle = makeBlock('toggle', { id: 't', content: 'toggle', children: [child] });
    const collected = collectBlocksForCopy([toggle], ['t', 'c']);
    expect(collected).toHaveLength(1);
    expect(collected[0]?.id).toBe('t');
    expect(collected[0]?.children).toHaveLength(1);
  });

  it('applySemanticCopy sets html and plain', () => {
    const data: Record<string, string> = {};
    applySemanticCopy([makeBlock('paragraph', { content: 'Hi' })], {
      setData: (type, val) => { data[type] = val; },
    });
    expect(data['text/html']).toContain('<p>Hi</p>');
    expect(data['text/plain']).toBe('Hi');
  });

  it('table block copies as HTML table with TSV-style plain fallback (UX-5B.1)', () => {
    const table = makeBlock('table', {
      tableHeaders: ['Name', 'Score'],
      tableRows: [['Alice', '95'], ['Bob', '88']],
    });
    const data: Record<string, string> = {};
    applySemanticCopy([table], {
      setData: (type, val) => { data[type] = val; },
    });
    expect(data['text/html']).toContain('<table>');
    expect(data['text/html']).toContain('<th>Name</th>');
    expect(data['text/html']).toContain('<td>Alice</td>');
    expect(data['text/plain']).toContain('| Name | Score |');
    expect(data['text/plain']).toContain('| Alice | 95 |');
  });

  it('table block round-trips through clipboard paste', () => {
    const table = makeBlock('table', {
      tableHeaders: ['H'],
      tableRows: [['cell']],
    });
    const parsed = roundTrip([table]);
    expect(parsed[0].type).toBe('table');
    expect(parsed[0].tableHeaders).toEqual(['H']);
    expect(parsed[0].tableRows).toEqual([['cell']]);
  });

  it('isolated indented bullet does not emit empty ul', () => {
    const html = blocksToCopyHtml([makeBlock('bullet', { content: 'nested', indent: 1 })]);
    expect(html).not.toBe('<ul></ul>');
    expect(html).toContain('nested');
    assertTreesEqual(
      [makeBlock('bullet', { content: 'nested', indent: 1 })],
      roundTrip([makeBlock('bullet', { content: 'nested', indent: 1 })]),
    );
  });

  it('EJU toggle subtree — tree equality after semantic copy round-trip', () => {
    const original = [
      makeBlock('toggle', {
        content: 'Grammar Module',
        children: [
          makeBlock('heading2', { content: 'Particles' }),
          makeBlock('bullet', { content: 'は vs が', indent: 0 }),
          makeBlock('bullet', { content: 'を particle usage', indent: 0 }),
          makeBlock('bullet', { content: 'nested bullet', indent: 1 }),
          makeBlock('numbered', { content: 'Drill set A', indent: 0 }),
          makeBlock('numbered', { content: 'Drill set B', indent: 0 }),
          makeBlock('toggle', {
            content: 'Vocab nest',
            children: [
              makeBlock('heading3', { content: 'Core kanji' }),
              makeBlock('bullet', { content: '読む', indent: 0 }),
              makeBlock('bullet', { content: '書く', indent: 0 }),
            ],
          }),
        ],
      }),
    ];
    assertTreesEqual(original, roundTrip(original));
  });

  it('full EJU note — tree equality after semantic copy round-trip', () => {
    const original = makeEjuBlocks();
    assertTreesEqual(original, roundTrip(original));
  });
});

function mockCopyWithSelection(
  blockId: string,
  blockType: string,
  text: string,
  start: number,
  end: number,
) {
  const el = document.createElement('span');
  el.className = 'be-editable';
  el.setAttribute('data-block-id', blockId);
  el.setAttribute('data-block-type', blockType);
  el.textContent = text;
  document.body.appendChild(el);
  el.focus();
  const range = document.createRange();
  range.setStart(el.firstChild!, start);
  range.setEnd(el.firstChild!, end);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);

  const data: Record<string, string> = {};
  let prevented = false;
  const clipboard = {
    setData: (type: string, val: string) => { data[type] = val; },
    getData: (type: string) => data[type] ?? '',
  } as DataTransfer;
  const e = {
    clipboardData: clipboard,
    preventDefault: () => { prevented = true; },
  } as Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>;

  return { e, data, prevented: () => prevented, cleanup: () => { document.body.innerHTML = ''; } };
}

describe('UX-3A.4 — toggle selection overrides partial text fallback', () => {
  const grammarToggle = makeBlock('toggle', {
    id: 'grammar',
    content: 'Grammar Module',
    children: [
      makeBlock('heading2', { id: 'h2-particles', content: 'Particles' }),
      makeBlock('bullet', { id: 'bullet-ha', content: 'は vs が' }),
    ],
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('toggle selected + partial header text → semantic full toggle', () => {
    const { e, data, prevented, cleanup } = mockCopyWithSelection(
      grammarToggle.id, 'toggle', 'Grammar Module', 0, 7,
    );
    const report = handleEditorCopyEvent(e, [grammarToggle], new Set([grammarToggle.id]))!;
    cleanup();

    expect(report.path).not.toBe('single-gutter-partial-fallback');
    expect(report.path).toBe('single-gutter-full-block');
    expect(prevented()).toBe(true);
    expect(classifyClipboardPayloadVariant(data['text/html'])).toBe('A-semantic-details-summary');
    expect(classifyClipboardHtml(data['text/html'])).toBe('semantic-details');
    const parsed = clipboardToBlocks({ getData: t => data[t] ?? '' })!;
    expect(parsed[0].type).toBe('toggle');
    expect(parsed[0].children).toHaveLength(2);
  });

  it('toggle selected + partial child text → semantic full toggle', () => {
    const child = grammarToggle.children[0];
    const { e, data, prevented, cleanup } = mockCopyWithSelection(
      child.id, 'heading2', 'Particles', 0, 5,
    );
    const report = handleEditorCopyEvent(e, [grammarToggle], new Set([grammarToggle.id]))!;
    cleanup();

    expect(report.path).toBe('single-gutter-full-block');
    expect(prevented()).toBe(true);
    expect(classifyClipboardPayloadVariant(data['text/html'])).toBe('A-semantic-details-summary');
    const parsed = clipboardToBlocks({ getData: t => data[t] ?? '' })!;
    expect(parsed[0].type).toBe('toggle');
    expect(parsed[0].content).toBe('Grammar Module');
    expect(parsed[0].children[0].type).toBe('heading2');
  });

  it('paragraph selected + partial text → partial fallback unchanged', () => {
    const para = makeBlock('paragraph', { id: 'p1', content: 'Hello world' });
    const { e, prevented, cleanup } = mockCopyWithSelection('p1', 'paragraph', 'Hello world', 0, 5);
    const report = handleEditorCopyEvent(e, [para], new Set(['p1']))!;
    cleanup();

    expect(report.path).toBe('single-gutter-partial-fallback');
    expect(prevented()).toBe(false);
    expect(report.blocksCopied).toBe(0);
  });

  it('bullet selected + partial text → partial fallback unchanged', () => {
    const bullet = makeBlock('bullet', { id: 'b1', content: 'は vs が' });
    const { e, prevented, cleanup } = mockCopyWithSelection('b1', 'bullet', 'は vs が', 0, 3);
    const report = handleEditorCopyEvent(e, [bullet], new Set(['b1']))!;
    cleanup();

    expect(report.path).toBe('single-gutter-partial-fallback');
    expect(prevented()).toBe(false);
    expect(report.blocksCopied).toBe(0);
  });
});
