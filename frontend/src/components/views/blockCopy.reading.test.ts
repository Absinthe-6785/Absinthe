// @vitest-environment happy-dom
/**
 * UX-3A.2 — reading-mode semantic copy integration tests
 */
import { afterEach, describe, expect, it } from 'vitest';
import { handleEditorCopyEvent } from './blockCopy';
import { assertTreesEqual } from './blockCopy.test';
import { classifyClipboardHtml } from './copyDiagnostics';
import { makeBlock, markdownToBlocks } from './blockUtils';
import { clipboardToBlocks } from './pasteOrchestrator';

const EJU_NOTE_MD = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
    - nested bullet
  1. Drill set A
  2. Drill set B
  > Vocab nest
    ### Core kanji
    - 読む
    - 書く

> Reading Module
  ## Comprehension
  - Main idea questions
  - Detail matching
  1. Practice passage 1
  2. Practice passage 2

## Global review checklist
- Redo wrong answers
- Time yourself`;

function mockCopyEvent() {
  const data: Record<string, string> = {};
  let prevented = false;
  const clipboard = {
    setData: (type: string, val: string) => { data[type] = val; },
    getData: (type: string) => data[type] ?? '',
  } as DataTransfer;
  return {
    e: {
      clipboardData: clipboard,
      preventDefault: () => { prevented = true; },
    } as Pick<ClipboardEvent, 'clipboardData' | 'preventDefault'>,
    data,
    prevented: () => prevented,
  };
}

function mountReadingText(
  blockId: string,
  blockType: string,
  text: string,
  tag: keyof HTMLElementTagNameMap = 'span',
): HTMLElement {
  const el = document.createElement(tag);
  el.className = 'be-block-text';
  el.setAttribute('data-block-id', blockId);
  el.setAttribute('data-block-type', blockType);
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function selectText(el: HTMLElement, start: number, end: number): void {
  const range = document.createRange();
  const node = el.firstChild ?? el;
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

function mountToggleWrap(toggle: ReturnType<typeof makeBlock>, childSpecs: { id: string; type: string; text: string }[]) {
  const wrap = document.createElement('div');
  wrap.className = 'be-toggle-wrap';
  const header = mountReadingText(toggle.id, 'toggle', toggle.content);
  wrap.appendChild(header);
  const children = document.createElement('div');
  children.className = 'be-toggle-children';
  children.setAttribute('data-toggle-id', toggle.id);
  for (const spec of childSpecs) {
    const child = mountReadingText(spec.id, spec.type, spec.text);
    children.appendChild(child);
  }
  wrap.appendChild(children);
  document.body.appendChild(wrap);
  return wrap;
}

function readingCopyRoundTrip(blocks: ReturnType<typeof markdownToBlocks>, setup: () => void) {
  const { e, data, prevented } = mockCopyEvent();
  setup();
  const report = handleEditorCopyEvent(e, blocks, new Set())!;
  return { report, data, prevented: prevented() };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('reading-mode semantic copy (UX-3A.2)', () => {
  it('toggle — partial header selection copies full toggle subtree', () => {
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'Grammar Module',
      children: [
        makeBlock('heading2', { id: 'h1', content: 'Particles' }),
        makeBlock('bullet', { id: 'b1', content: 'は vs が' }),
      ],
    });

    mountToggleWrap(toggle, [
      { id: 'h1', type: 'heading2', text: 'Particles' },
      { id: 'b1', type: 'bullet', text: 'は vs が' },
    ]);

    const header = document.querySelector('[data-block-id="t1"]') as HTMLElement;
    selectText(header, 0, 7);

    const { e, data, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, [toggle], new Set())!;

    expect(report.path).toBe('editable-toggle-header');
    expect(prevented()).toBe(true);
    expect(classifyClipboardHtml(data['text/html'])).toBe('semantic-details');
    expect(data['text/html']).not.toContain('be-toggle-wrap');

    const pasted = clipboardToBlocks({ getData: t => data[t] ?? '' })!;
    assertTreesEqual([toggle], pasted);
  });

  it('nested toggle — selection inside inner toggle copies nested structure', () => {
    const inner = makeBlock('toggle', {
      id: 'inner',
      content: 'Vocab nest',
      children: [makeBlock('bullet', { id: 'k1', content: '読む' })],
    });
    const outer = makeBlock('toggle', {
      id: 'outer',
      content: 'Grammar Module',
      children: [inner],
    });

    const outerWrap = document.createElement('div');
    outerWrap.className = 'be-toggle-wrap';
    const outerHeader = mountReadingText('outer', 'toggle', 'Grammar Module');
    outerWrap.appendChild(outerHeader);
    const outerChildren = document.createElement('div');
    outerChildren.className = 'be-toggle-children';
    outerChildren.setAttribute('data-toggle-id', 'outer');

    const innerWrap = document.createElement('div');
    innerWrap.className = 'be-toggle-wrap';
    const innerHeader = mountReadingText('inner', 'toggle', 'Vocab nest');
    innerWrap.appendChild(innerHeader);
    const innerChildren = document.createElement('div');
    innerChildren.className = 'be-toggle-children';
    innerChildren.setAttribute('data-toggle-id', 'inner');
    innerChildren.appendChild(mountReadingText('k1', 'bullet', '読む'));
    innerWrap.appendChild(innerChildren);
    outerChildren.appendChild(innerWrap);
    outerWrap.appendChild(outerChildren);
    document.body.appendChild(outerWrap);

    selectText(innerHeader, 0, 5);

    const { e, data, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, [outer], new Set())!;

    expect(report.path).toBe('editable-toggle-header');
    expect(prevented()).toBe(true);
    assertTreesEqual([inner], clipboardToBlocks({ getData: t => data[t] ?? '' })!);
  });

  it('bullet list — full block selection uses semantic HTML', () => {
    const bullets = [
      makeBlock('bullet', { id: 'b1', content: 'は vs が' }),
      makeBlock('bullet', { id: 'b2', content: 'を particle usage' }),
    ];
    const el1 = mountReadingText('b1', 'bullet', 'は vs が');
    mountReadingText('b2', 'bullet', 'を particle usage');
    selectText(el1, 0, el1.textContent!.length);

    const { e, data, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, bullets, new Set())!;

    expect(report.path).toBe('editable-full-block');
    expect(prevented()).toBe(true);
    expect(data['text/html']).toMatch(/<ul><li>は vs が<\/li><\/ul>/);
    assertTreesEqual([bullets[0]], clipboardToBlocks({ getData: t => data[t] ?? '' })!);
  });

  it('bullet list — partial selection falls back to browser (no preventDefault)', () => {
    const bullet = makeBlock('bullet', { id: 'b1', content: 'は vs が' });
    const el = mountReadingText('b1', 'bullet', 'は vs が');
    selectText(el, 0, 3);

    const { e, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, [bullet], new Set())!;

    expect(report.path).toBe('editable-partial-fallback');
    expect(prevented()).toBe(false);
  });

  it('EJU fixture — reading-mode copy matches edit-mode semantic round-trip', () => {
    const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
      b => b.type !== 'paragraph' || b.content.trim() !== '',
    );
    const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;

    mountToggleWrap(grammarToggle, [
      { id: grammarToggle.children[0].id, type: 'heading2', text: 'Particles' },
      { id: grammarToggle.children[1].id, type: 'bullet', text: 'は vs が' },
      { id: grammarToggle.children[2].id, type: 'bullet', text: 'を particle usage' },
    ]);

    const header = document.querySelector(`[data-block-id="${grammarToggle.id}"]`) as HTMLElement;
    selectText(header, 0, grammarToggle.content.length);

    const { data, prevented } = readingCopyRoundTrip(ejuBlocks, () => {});
    expect(prevented).toBe(true);
    expect(classifyClipboardHtml(data['text/html'])).toBe('semantic-details');
    assertTreesEqual([grammarToggle], clipboardToBlocks({ getData: t => data[t] ?? '' })!);
  });

  it('EJU checklist tail — multi-block reading selection preserves block tree', () => {
    const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
      b => b.type !== 'paragraph' || b.content.trim() !== '',
    );
    const tail = ejuBlocks.slice(-3);

    const heading = mountReadingText(tail[0].id, tail[0].type, tail[0].content, 'h2');
    const b1 = mountReadingText(tail[1].id, tail[1].type, tail[1].content);
    const b2 = mountReadingText(tail[2].id, tail[2].type, tail[2].content);

    const range = document.createRange();
    range.setStart(heading.firstChild!, 0);
    range.setEnd(b2.firstChild!, b2.textContent!.length);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const { data, prevented, report } = readingCopyRoundTrip(ejuBlocks, () => {});
    expect(report.path).toBe('multi-select');
    expect(prevented).toBe(true);
    assertTreesEqual(tail, clipboardToBlocks({ getData: t => data[t] ?? '' })!);
  });
});
