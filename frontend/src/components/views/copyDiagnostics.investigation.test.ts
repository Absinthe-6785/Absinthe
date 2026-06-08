// @vitest-environment happy-dom
/**
 * UX-3A copy-path investigation — answers QA questions programmatically.
 * Run: npm test -- copyDiagnostics.investigation --disable-console-intercept
 */
import { describe, expect, it } from 'vitest';
import { handleEditorCopyEvent } from './blockCopy';
import { classifyClipboardHtml } from './copyDiagnostics';
import { makeBlock, markdownToBlocks } from './blockUtils';

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

describe('copy path investigation', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;

  it('Q1/Q2: multi-select semantic path writes details HTML and preventDefault', () => {
    const ids = new Set(ejuBlocks.map(b => b.id));
    const { e, data, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, ejuBlocks, ids)!;

    // eslint-disable-next-line no-console
    console.info('\n=== PATH: multi-select full EJU ===', JSON.stringify({
      path: report.path,
      prevented: report.preventedDefault,
      htmlClassification: report.htmlClassification,
      htmlPreview: report.clipboardHtmlAfterHandler?.slice(0, 500),
    }, null, 2));

    expect(report.path).toBe('multi-select');
    expect(prevented()).toBe(true);
    expect(report.htmlClassification).toBe('semantic-details');
    expect(report.clipboardHtmlAfterHandler).toContain('<details');
    expect(report.clipboardHtmlAfterHandler).not.toContain('be-toggle-wrap');
    expect(report.clipboardHtmlAfterHandler).toBe(report.expectedHtml);
  });

  it('Q1/Q2: partial text selection falls back to browser (no preventDefault)', () => {
    const block = makeBlock('paragraph', { id: 'p1', content: 'Hello world' });
    const el = document.createElement('span');
    el.className = 'be-editable';
    el.setAttribute('data-block-id', 'p1');
    el.setAttribute('data-block-type', 'paragraph');
    el.textContent = 'Hello world';
    document.body.appendChild(el);
    el.focus();

    const range = document.createRange();
    range.setStart(el.firstChild!, 0);
    range.setEnd(el.firstChild!, 5);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const { e, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, [block], new Set())!;

    // eslint-disable-next-line no-console
    console.info('\n=== PATH: partial selection ===', report);

    expect(report.path).toBe('editable-partial-fallback');
    expect(prevented()).toBe(false);
    expect(report.expectedHtml).toBeNull();

    document.body.removeChild(el);
  });

  it('Q1/Q2: toggle header full selection uses semantic toggle path', () => {
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'Grammar Module',
      children: [makeBlock('paragraph', { content: 'child' })],
    });
    const el = document.createElement('span');
    el.className = 'be-editable';
    el.setAttribute('data-block-id', 't1');
    el.setAttribute('data-block-type', 'toggle');
    el.textContent = 'Grammar Module';
    document.body.appendChild(el);
    el.focus();

    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    const { e, prevented } = mockCopyEvent();
    const report = handleEditorCopyEvent(e, [toggle], new Set())!;

    // eslint-disable-next-line no-console
    console.info('\n=== PATH: toggle header ===', {
      path: report.path,
      prevented: report.preventedDefault,
      htmlPreview: report.clipboardHtmlAfterHandler?.slice(0, 300),
    });

    expect(report.path).toBe('editable-toggle-header');
    expect(prevented()).toBe(true);
    expect(classifyClipboardHtml(report.clipboardHtmlAfterHandler ?? '')).toBe('semantic-details');

    document.body.removeChild(el);
  });

  it('readOnly: handler not invoked — preview QA uses browser DOM copy', () => {
    // BlockEditor skips handleEditorCopyEvent when readOnly=true.
    // Simulate: no handler call → clipboard empty in mock.
    const { e, data, prevented } = mockCopyEvent();
    const report = null; // readOnly → runCopy returns null

    // eslint-disable-next-line no-console
    console.info('\n=== PATH: readOnly (no semantic handler) ===', {
      report,
      note: 'In reading/preview mode, copy listener is not registered; browser writes DOM HTML.',
    });

    expect(report).toBeNull();
    expect(prevented()).toBe(false);
    expect(data['text/html']).toBeUndefined();
  });

  it('compare expected semantic HTML vs DOM-shaped HTML for grammar toggle', () => {
    const { e, data } = mockCopyEvent();
    handleEditorCopyEvent(e, [grammarToggle], new Set([grammarToggle.id]));
    const semanticHtml = data['text/html'];

    const domShaped = `<div class="be-toggle-wrap"><div class="be-toggle-header-block"><span class="be-editable">Grammar Module</span></div><div class="be-toggle-children"><p>Particles</p></div></div>`;

    // eslint-disable-next-line no-console
    console.info('\n=== EXPECTED semantic vs DOM-shaped ===', {
      semanticClassification: classifyClipboardHtml(semanticHtml),
      domClassification: classifyClipboardHtml(domShaped),
      semanticPreview: semanticHtml.slice(0, 400),
      domPreview: domShaped.slice(0, 400),
    });

    expect(classifyClipboardHtml(semanticHtml)).toBe('semantic-details');
    expect(classifyClipboardHtml(domShaped)).toBe('dom-be-toggle');
    expect(semanticHtml).toContain('<details');
    expect(domShaped).toContain('be-toggle-wrap');
  });
});
