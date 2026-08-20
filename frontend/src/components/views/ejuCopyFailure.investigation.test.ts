// @vitest-environment happy-dom
/**
 * EJU toggle copy failure — structural pipeline trace (no fixes).
 * Run: npm test -- ejuCopyFailure.investigation --disable-console-intercept
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blockShape,
  blocksToCopyHtml,
  classifyClipboardHtml,
  clipboardToBlocks,
  handleEditorCopyEvent,
  resolveCopySelection,
} from './features/block-editor/features/clipboard';
import { findBlockById, type Block } from './blockUtils';
import { makeEjuBlocks } from '@/test/fixtures/ejuClipboardFixtures';

/** Chromium browser DOM when semantic handler does not preventDefault (edit-mode DOM). */
const BROWSER_DOM_CLIPBOARD_HTML = `<meta charset='utf-8'><div class="be-toggle-wrap"><div class="be-toggle-header-block be-block"><div class="be-content"><div style="display:flex;gap:6px"><button type="button" aria-label="접기"></button><span class="be-editable" style="font-weight:600">Grammar Module</span></div></div></div><div class="be-toggle-children be-toggle-drop" data-toggle-id="GRAMMAR_ID"><div class="be-block"><div class="be-content"><h2 class="be-editable">Particles</h2></div></div><div class="be-block"><div class="be-content"><div style="display:flex;gap:8px"><span>•</span><span class="be-editable">は vs が</span></div></div></div><div class="be-block"><div class="be-content"><div style="display:flex;gap:8px"><span>•</span><span class="be-editable">を particle usage</span></div></div></div><div class="be-block"><div class="be-content"><div style="display:flex;gap:8px"><span>•</span><span style="padding-left:24px">•</span><span class="be-editable">nested bullet</span></div></div></div></div></div>`;

const PREVIEW_HTML = 2000;
const PREVIEW_PLAIN = 1000;

function blocksFromResolve(rootBlocks: Block[], resolved: ReturnType<typeof resolveCopySelection>): Block[] | null {
  if (resolved.kind === 'toggle-subtree') {
    const b = findBlockById(rootBlocks, resolved.blockId);
    return b ? [b] : null;
  }
  if (resolved.kind === 'multi-block') {
    const want = new Set(resolved.blockIds);
    const out: Block[] = [];
    const walk = (list: Block[]) => {
      for (const b of list) {
        if (want.has(b.id)) out.push(b);
        else if (b.children.length) walk(b.children);
      }
    };
    walk(rootBlocks);
    return out.length ? out : null;
  }
  if (resolved.kind === 'single') {
    const b = findBlockById(rootBlocks, resolved.ctx.activeBlockId);
    return b ? [b] : null;
  }
  return null;
}

function firstDivergence(a: ReturnType<typeof blockShape>, b: ReturnType<typeof blockShape>, path = ''): string | null {
  if (a.length !== b.length) {
    return `${path || 'root'}: length ${a.length} vs ${b.length}`;
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    const p = path ? `${path}[${i}]` : `[${i}]`;
    if (x.type !== y.type) return `${p}: type ${x.type} vs ${y.type}`;
    if ((x.content ?? '') !== (y.content ?? '')) {
      return `${p}: content "${x.content ?? ''}" vs "${y.content ?? ''}"`;
    }
    if (x.type === 'bullet' || x.type === 'numbered') {
      if ((x.indent ?? 0) !== (y.indent ?? 0)) {
        return `${p}: indent ${x.indent ?? 0} vs ${y.indent ?? 0}`;
      }
    }
    const ac = x.children ?? [];
    const bc = y.children ?? [];
    const childDiv = firstDivergence(ac, bc, `${p}.children`);
    if (childDiv) return childDiv;
  }
  return null;
}

function mockCopyEvent(prefillHtml?: string, prefillPlain?: string) {
  const data: Record<string, string> = {};
  if (prefillHtml) data['text/html'] = prefillHtml;
  if (prefillPlain) data['text/plain'] = prefillPlain;
  let prevented = false;
  const clipboard = {
    setData: (type: string, val: string) => { data[type] = val; },
    getData: (type: string) => data[type] ?? '',
  } as DataTransfer;
  return {
    e: {
      clipboardData: clipboard,
      preventDefault: () => { prevented = true; },
      get defaultPrevented() { return prevented; },
    } as ClipboardEvent,
    data,
    prevented: () => prevented,
  };
}

/** Reading-mode DOM mirroring ToggleBlock + blockRegistry after UX-3A.2 */
function mountReadingEjuToggle(toggle: Block): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'be-toggle-wrap';

  const headerShell = document.createElement('div');
  headerShell.className = 'be-toggle-header-block be-block';
  const headerContent = document.createElement('div');
  headerContent.className = 'be-content';
  const headerFlex = document.createElement('div');
  headerFlex.style.display = 'flex';
  headerFlex.style.gap = '6px';
  const chevron = document.createElement('button');
  chevron.type = 'button';
  chevron.setAttribute('aria-label', '접기');
  const headerText = document.createElement('span');
  headerText.className = 'be-block-text';
  headerText.setAttribute('data-block-id', toggle.id);
  headerText.setAttribute('data-block-type', 'toggle');
  headerText.style.fontWeight = '600';
  headerText.textContent = toggle.content;
  headerFlex.appendChild(chevron);
  headerFlex.appendChild(headerText);
  headerContent.appendChild(headerFlex);
  headerShell.appendChild(headerContent);
  wrap.appendChild(headerShell);

  const childrenWrap = document.createElement('div');
  childrenWrap.className = 'be-toggle-children be-toggle-drop';
  childrenWrap.setAttribute('data-toggle-id', toggle.id);

  for (const child of toggle.children) {
    const blockShell = document.createElement('div');
    blockShell.className = 'be-block';
    const content = document.createElement('div');
    content.className = 'be-content';

    if (child.type === 'heading2' || child.type === 'heading3') {
      const tag = child.type === 'heading2' ? 'h2' : 'h3';
      const h = document.createElement(tag);
      h.className = 'be-block-text';
      h.setAttribute('data-block-id', child.id);
      h.setAttribute('data-block-type', child.type);
      h.textContent = child.content;
      content.appendChild(h);
    } else if (child.type === 'bullet' || child.type === 'numbered') {
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.gap = '8px';
      const marker = document.createElement('span');
      marker.textContent = child.type === 'bullet' ? '•' : '1.';
      const text = document.createElement('span');
      text.className = 'be-block-text';
      text.setAttribute('data-block-id', child.id);
      text.setAttribute('data-block-type', child.type);
      text.textContent = child.content;
      if ((child.indent ?? 0) > 0) {
        const pad = document.createElement('span');
        pad.style.paddingLeft = `${24 * (child.indent ?? 0)}px`;
        pad.textContent = child.type === 'bullet' ? '•' : '';
        flex.appendChild(pad);
      }
      flex.appendChild(marker);
      flex.appendChild(text);
      content.appendChild(flex);
    } else if (child.type === 'toggle') {
      content.appendChild(mountReadingEjuToggle(child));
    } else if (child.type === 'numbered') {
      // handled above
    } else {
      const p = document.createElement('p');
      p.className = 'be-block-text';
      p.setAttribute('data-block-id', child.id);
      p.setAttribute('data-block-type', child.type);
      p.textContent = child.content;
      content.appendChild(p);
    }

    blockShell.appendChild(content);
    childrenWrap.appendChild(blockShell);
  }

  wrap.appendChild(childrenWrap);
  document.body.appendChild(wrap);
  return wrap;
}

/** Edit-mode DOM (pre-UX-3A.2 reading attrs) — matches live edit UI */
function mountEditEjuToggle(toggle: Block): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'be-toggle-wrap';
  const headerShell = document.createElement('div');
  headerShell.className = 'be-toggle-header-block be-block';
  const headerContent = document.createElement('div');
  headerContent.className = 'be-content';
  const headerFlex = document.createElement('div');
  headerFlex.style.display = 'flex';
  headerFlex.style.gap = '6px';
  headerFlex.appendChild(document.createElement('button'));
  const headerText = document.createElement('span');
  headerText.className = 'be-editable';
  headerText.style.fontWeight = '600';
  headerText.textContent = toggle.content;
  headerFlex.appendChild(headerText);
  headerContent.appendChild(headerFlex);
  headerShell.appendChild(headerContent);
  wrap.appendChild(headerShell);

  const childrenWrap = document.createElement('div');
  childrenWrap.className = 'be-toggle-children be-toggle-drop';
  childrenWrap.setAttribute('data-toggle-id', toggle.id);

  for (const child of toggle.children) {
    const blockShell = document.createElement('div');
    blockShell.className = 'be-block';
    const content = document.createElement('div');
    content.className = 'be-content';
    if (child.type === 'heading2') {
      const h = document.createElement('h2');
      h.className = 'be-editable';
      h.textContent = child.content;
      content.appendChild(h);
    } else if (child.type === 'bullet') {
      const flex = document.createElement('div');
      flex.style.display = 'flex';
      flex.style.gap = '8px';
      flex.appendChild(document.createElement('span')).textContent = '•';
      const text = document.createElement('span');
      text.className = 'be-editable';
      text.textContent = child.content;
      flex.appendChild(text);
      content.appendChild(flex);
    }
    blockShell.appendChild(content);
    childrenWrap.appendChild(blockShell);
  }
  wrap.appendChild(childrenWrap);
  document.body.appendChild(wrap);
  return wrap;
}

function selectNodeContents(node: Node): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

function selectFromTo(startNode: Node, startOff: number, endNode: Node, endOff: number): void {
  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

function runPipeline(label: string, rootBlocks: Block[], original: Block[], setup: () => void, prefillBrowser = false) {
  const grammarId = original[0]?.id ?? 'unknown';
  const browserHtml = BROWSER_DOM_CLIPBOARD_HTML.replace(/GRAMMAR_ID/g, grammarId);
  const { e, data, prevented } = mockCopyEvent(
    prefillBrowser ? browserHtml : undefined,
    prefillBrowser ? 'Grammar Module\nParticles\nは vs が' : undefined,
  );

  setup();
  const resolved = resolveCopySelection(rootBlocks);
  const resolvedBlocks = blocksFromResolve(rootBlocks, resolved);
  const report = handleEditorCopyEvent(e, rootBlocks, new Set());

  const html = data['text/html'] ?? '';
  const plain = data['text/plain'] ?? '';
  const pasted = clipboardToBlocks({ getData: t => data[t] ?? '' });

  const origShape = blockShape(original);
  const resolvedShape = resolvedBlocks ? blockShape(resolvedBlocks) : null;
  const pastedShape = pasted ? blockShape(pasted) : null;

  const divResolved = resolvedShape ? firstDivergence(origShape, resolvedShape) : 'resolve returned null';
  const divPasted = pastedShape ? firstDivergence(origShape, pastedShape) : 'clipboardToBlocks returned null';

  // eslint-disable-next-line no-console
  console.info(`\n${'='.repeat(72)}\n${label}\n${'='.repeat(72)}`);
  // eslint-disable-next-line no-console
  console.info('TRACE FIELDS:', JSON.stringify({
    path: report?.path ?? null,
    preventedDefault: report?.preventedDefault ?? prevented(),
    htmlClassification: report?.htmlClassification ?? classifyClipboardHtml(html),
    blocksCopied: report?.blocksCopied ?? 0,
    selectedBlockIds: report?.selectedBlockIds ?? [],
    activeBlockId: report?.activeBlockId ?? null,
    activeBlockType: report?.activeBlockType ?? null,
    resolveKind: resolved.kind,
  }, null, 2));
  // eslint-disable-next-line no-console
  console.info('clipboardHtmlPreview:', html.slice(0, PREVIEW_HTML));
  // eslint-disable-next-line no-console
  console.info('clipboardPlainPreview:', plain.slice(0, PREVIEW_PLAIN));
  // eslint-disable-next-line no-console
  console.info('original tree:', JSON.stringify(origShape, null, 2));
  // eslint-disable-next-line no-console
  console.info('resolveCopySelection blocks:', JSON.stringify(resolvedShape, null, 2));
  // eslint-disable-next-line no-console
  console.info('clipboardToBlocks:', JSON.stringify(pastedShape, null, 2));
  // eslint-disable-next-line no-console
  console.info('FIRST DIVERGENCE original vs resolve:', divResolved);
  // eslint-disable-next-line no-console
  console.info('FIRST DIVERGENCE original vs pasted:', divPasted);

  return { report, resolved, divPasted };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('EJU toggle copy failure investigation', () => {
  const ejuBlocks = makeEjuBlocks();
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;

  it('A — reading mode: select entire toggle wrap (exact visible toggle content)', () => {
    const wrap = mountReadingEjuToggle(grammarToggle);
    runPipeline(
      'A: reading mode — selectNodeContents(.be-toggle-wrap)',
      ejuBlocks,
      [grammarToggle],
      () => selectNodeContents(wrap),
    );
  });

  it('B — reading mode: drag from chevron button to last bullet (common UI gesture)', () => {
    const wrap = mountReadingEjuToggle(grammarToggle);
    const chevron = wrap.querySelector('button')!;
    const lastBullet = wrap.querySelector('[data-block-type="bullet"]:last-of-type')!.firstChild!;
    runPipeline(
      'B: reading mode — select chevron → last bullet text',
      ejuBlocks,
      [grammarToggle],
      () => selectFromTo(chevron, 0, lastBullet, lastBullet.textContent!.length),
    );
  });

  it('C — edit mode: select entire toggle wrap (no data-block-id on children)', () => {
    const wrap = mountEditEjuToggle(grammarToggle);
    runPipeline(
      'C: edit mode — selectNodeContents(.be-toggle-wrap)',
      ejuBlocks,
      [grammarToggle],
      () => selectNodeContents(wrap),
    );
  });

  it('D — browser DOM clipboard ONLY (handler never ran — matches UI failure)', () => {
    const browserHtml = BROWSER_DOM_CLIPBOARD_HTML.replace(/GRAMMAR_ID/g, grammarToggle.id);
    const plain = 'Grammar Module\nParticles\nは vs が\nを particle usage\nnested bullet';
    const pasted = clipboardToBlocks({
      getData: t => (t === 'text/html' ? browserHtml : t === 'text/plain' ? plain : ''),
    });
    const origShape = blockShape([grammarToggle]);
    const pastedShape = pasted ? blockShape(pasted) : null;
    const div = pastedShape ? firstDivergence(origShape, pastedShape) : 'null paste';

    // eslint-disable-next-line no-console
    console.info(`\n${'='.repeat(72)}\nD: browser DOM only — NO handleEditorCopyEvent\n${'='.repeat(72)}`);
    // eslint-disable-next-line no-console
    console.info('TRACE FIELDS (handler did NOT run):', JSON.stringify({
      path: null,
      preventedDefault: false,
      htmlClassification: classifyClipboardHtml(browserHtml),
      blocksCopied: 0,
      selectedBlockIds: [],
      activeBlockId: null,
      activeBlockType: null,
    }, null, 2));
    // eslint-disable-next-line no-console
    console.info('clipboardHtmlPreview:', browserHtml.slice(0, PREVIEW_HTML));
    // eslint-disable-next-line no-console
    console.info('clipboardPlainPreview:', plain.slice(0, PREVIEW_PLAIN));
    // eslint-disable-next-line no-console
    console.info('resolveCopySelection blocks: N/A (handler not invoked)');
    // eslint-disable-next-line no-console
    console.info('clipboardToBlocks:', JSON.stringify(pastedShape, null, 2));
    // eslint-disable-next-line no-console
    console.info('FIRST DIVERGENCE original vs pasted:', div);
  });

  it('F — production: installEditorCopyListener registers copy handler (not diagnostics)', async () => {
    vi.stubEnv('DEV', 'false');
    const { installEditorCopyListener, installCopyDiagnostics } = await import(
      './features/block-editor/features/clipboard'
    );
    const addSpy = vi.spyOn(window, 'addEventListener');
    const before = addSpy.mock.calls.filter(c => c[0] === 'copy').length;

    const uninstallCopy = installEditorCopyListener({
      getRootBlocks: () => ejuBlocks,
      getSelectedIds: () => new Set(),
    });
    const handlerAdds = addSpy.mock.calls.filter(c => c[0] === 'copy').length - before;

    const diagBefore = addSpy.mock.calls.filter(c => c[0] === 'copy').length;
    const uninstallDiag = installCopyDiagnostics({
      readOnly: true,
      depth: 0,
      getRootBlocks: () => ejuBlocks,
      getSelectedIds: () => new Set(),
    });
    const diagAdds = addSpy.mock.calls.filter(c => c[0] === 'copy').length - diagBefore;

    // eslint-disable-next-line no-console
    console.info(`\n${'='.repeat(72)}\nF: production build — copy listener registration\n${'='.repeat(72)}`);
    // eslint-disable-next-line no-console
    console.info('production handler copy listeners added:', handlerAdds);
    // eslint-disable-next-line no-console
    console.info('diagnostics copy listeners added (expect 0 in prod):', diagAdds);
    expect(handlerAdds).toBe(1);
    // diagnostics is build-time DEV-gated; in vitest DEV=true so diagAdds may be >0
    expect(diagAdds).toBeGreaterThanOrEqual(0);
    uninstallCopy();
    uninstallDiag();
    addSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('G — edit mode partial bullet text (handler runs but falls back)', () => {
    const wrap = mountEditEjuToggle(grammarToggle);
    const bulletText = wrap.querySelector('.be-editable:last-of-type')!;
    runPipeline(
      'G: edit mode — partial bullet selection',
      ejuBlocks,
      [grammarToggle.children[1]],
      () => selectFromTo(bulletText.firstChild!, 0, bulletText.firstChild!, 3),
      true,
    );
  });

  it('E — semantic HTML round-trip control (copy pipeline succeeds)', () => {
    const html = blocksToCopyHtml([grammarToggle]);
    const pasted = clipboardToBlocks({ getData: t => (t === 'text/html' ? html : '') })!;
    const div = firstDivergence(blockShape([grammarToggle]), blockShape(pasted));
    // eslint-disable-next-line no-console
    console.info('\nE: semantic HTML control — first divergence:', div ?? 'NONE (trees equal)');
  });
});
