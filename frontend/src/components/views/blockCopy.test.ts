// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { makeBlock, type Block } from './blockUtils';
import {
  applySemanticCopy,
  blocksToCopyHtml,
  collectBlocksForCopy,
  trySemanticCopyFromBlock,
} from './blockCopy';
import { clipboardToBlocks } from './pasteOrchestrator';

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

  it('applySemanticCopy sets html and plain', () => {
    const data: Record<string, string> = {};
    applySemanticCopy([makeBlock('paragraph', { content: 'Hi' })], {
      setData: (type, val) => { data[type] = val; },
    });
    expect(data['text/html']).toContain('<p>Hi</p>');
    expect(data['text/plain']).toBe('Hi');
  });
});
