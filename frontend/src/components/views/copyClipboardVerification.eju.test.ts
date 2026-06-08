// @vitest-environment happy-dom
/**
 * UX-3A.2 live clipboard verification — production copy path, EJU toggle.
 * Run: npm test -- copyClipboardVerification.eju --disable-console-intercept
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blocksToCopyHtml } from './blockCopy';
import {
  classifyClipboardPayloadVariant,
  firstByteDifference,
  getLastCopyClipboardVerification,
} from './copyClipboardVerification';
import { installEditorCopyListener } from './copyListener';
import { blocksToMarkdown, markdownToBlocks } from './blockUtils';

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

function mountReadingEjuToggle(toggle: ReturnType<typeof markdownToBlocks>[0]) {
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
  headerText.className = 'be-block-text';
  headerText.setAttribute('data-block-id', toggle.id);
  headerText.setAttribute('data-block-type', 'toggle');
  headerText.style.fontWeight = '600';
  headerText.textContent = toggle.content;
  headerFlex.appendChild(headerText);
  headerContent.appendChild(headerFlex);
  headerShell.appendChild(headerContent);
  wrap.appendChild(headerShell);
  const childrenWrap = document.createElement('div');
  childrenWrap.className = 'be-toggle-children be-toggle-drop';
  childrenWrap.setAttribute('data-toggle-id', toggle.id);
  wrap.appendChild(childrenWrap);
  document.body.appendChild(wrap);
  return wrap;
}

function selectToggleWrap(wrap: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(wrap);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('UX-3A.2 live clipboard verification — EJU production copy path', () => {
  const ejuBlocks = markdownToBlocks(EJU_NOTE_MD).filter(
    b => b.type !== 'paragraph' || b.content.trim() !== '',
  );
  const grammarToggle = ejuBlocks.find(b => b.type === 'toggle' && b.content === 'Grammar Module')!;

  beforeEach(() => {
    vi.stubEnv('DEV', 'true');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('production path — sync clipboard matches blocksToCopyHtml (variant A)', () => {
    const expectedHtml = blocksToCopyHtml([grammarToggle]);
    const expectedPlain = blocksToMarkdown([grammarToggle]);
    const wrap = mountReadingEjuToggle(grammarToggle);
    selectToggleWrap(wrap);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const uninstall = installEditorCopyListener({
      getRootBlocks: () => ejuBlocks,
      getSelectedIds: () => new Set(),
    });

    window.dispatchEvent(new ClipboardEvent('copy', {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true,
    }));

    const v = getLastCopyClipboardVerification()!;

    // eslint-disable-next-line no-console
    console.info('\n========== EJU LIVE CLIPBOARD VERIFY (production path) ==========');
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({
      path: v.path,
      preventedDefault: v.preventedDefault,
      payloadVariant: v.payloadVariant,
      htmlMatchesExpected: v.htmlMatchesExpected,
      plainMatchesExpected: v.plainMatchesExpected,
      firstHtmlDiff: v.firstHtmlDiff,
      parserRoute: v.parserRoute,
      parsedFirstBlockType: v.parsedFirstBlockType,
    }, null, 2));
    // eslint-disable-next-line no-console
    console.info('\n--- EXPECTED HTML (FULL) ---\n', v.expectedHtml);
    // eslint-disable-next-line no-console
    console.info('\n--- ACTUAL HTML (FULL) ---\n', v.actualHtml);
    // eslint-disable-next-line no-console
    console.info('\n--- EXPECTED PLAIN (FULL) ---\n', v.expectedPlain);
    // eslint-disable-next-line no-console
    console.info('\n--- ACTUAL PLAIN (FULL) ---\n', v.actualPlain);

    expect(v.path).toBe('editable-toggle-header');
    expect(v.preventedDefault).toBe(true);
    expect(v.payloadVariant).toBe('A-semantic-details-summary');
    expect(v.htmlMatchesExpected).toBe(true);
    expect(v.plainMatchesExpected).toBe(true);
    expect(v.firstHtmlDiff).toBeNull();
    expect(v.parsedFirstBlockType).toBe('toggle');
    expect(classifyClipboardPayloadVariant(v.actualHtml)).toBe('A-semantic-details-summary');

    uninstall();
    warnSpy.mockRestore();
  });

  it('control — variant B (h3.btsummary) reproduces heading3 parse route', () => {
    const expectedHtml = blocksToCopyHtml([grammarToggle]);
    const actualHtml = `<h3 class="btsummary">Grammar Module</h3><div class="btbody"><h2>Particles</h2></div>`;
    const diff = firstByteDifference(expectedHtml, actualHtml);

    // eslint-disable-next-line no-console
    console.info('\n========== CONTROL B: h3.btsummary ==========');
    // eslint-disable-next-line no-console
    console.info('variant:', classifyClipboardPayloadVariant(actualHtml));
    // eslint-disable-next-line no-console
    console.info('firstHtmlDiff:', diff);

    expect(classifyClipboardPayloadVariant(actualHtml)).toBe('B-h3-btsummary');
    expect(diff?.index).toBe(1);
    expect(diff?.expectedChar).toBe('d');
    expect(diff?.actualChar).toBe('h');
    expect(expectedHtml.startsWith('<details')).toBe(true);
    expect(actualHtml.startsWith('<h3')).toBe(true);
  });

  it('control — variant C (be-toggle-wrap DOM) byte diff from semantic', () => {
    const expectedHtml = blocksToCopyHtml([grammarToggle]);
    const actualHtml = `<div class="be-toggle-wrap"><span class="be-editable">Grammar Module</span><div class="be-toggle-children"><h2 class="be-editable">Particles</h2></div></div>`;
    const diff = firstByteDifference(expectedHtml, actualHtml);

    // eslint-disable-next-line no-console
    console.info('\n========== CONTROL C: be-toggle-wrap DOM ==========');
    // eslint-disable-next-line no-console
    console.info('variant:', classifyClipboardPayloadVariant(actualHtml));
    // eslint-disable-next-line no-console
    console.info('firstHtmlDiff:', diff);

    expect(classifyClipboardPayloadVariant(actualHtml)).toBe('C-dom-be-toggle-wrap');
    expect(diff?.index).toBe(2);
    expect(diff?.expectedChar).toBe('e');
    expect(diff?.actualChar).toBe('i');
    expect(expectedHtml.startsWith('<details')).toBe(true);
    expect(actualHtml.startsWith('<div')).toBe(true);
  });
});
