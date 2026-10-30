// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInlineMarkdownHtml, liveInlineHtml } from './editableRender';
import { handleReadingWikiClick, handleReadingWikiKeyDown, serializeIdWikiLink, type WikiNoteTarget, type WikiNavigationTarget } from './wikiLinks';
import type { BlockEditorColors } from './editorTypes';
import { getTranslator, type Language } from '../../lib/i18n';
import { getCaretOffset, readBlockText, setCaretOffset } from './editableDom';

const colors = new Proxy({}, { get: () => '#555' }) as BlockEditorColors;
const target = (id: string, title: string, current = true): WikiNoteTarget => ({
  id, title, isCurrent: () => current,
});
const navigate = vi.fn<(target: WikiNavigationTarget, options?: { preferReading?: boolean }) => void>();

function mount(markdown: string, targets: (WikiNoteTarget | string)[] = [], unavailableLabel = 'Linked note unavailable') {
  const root = document.createElement('div');
  root.innerHTML = renderInlineMarkdownHtml(markdown, colors, '', targets, unavailableLabel);
  root.addEventListener('click', event => {
    if (event.target instanceof Element) handleReadingWikiClick(event.target, navigate);
  });
  root.addEventListener('keydown', event => handleReadingWikiKeyDown(event, root, navigate));
  document.body.append(root);
  return root;
}

function press(targetNode: Element, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
  targetNode.dispatchEvent(event);
  return event;
}

afterEach(() => {
  navigate.mockClear();
  document.body.replaceChildren();
});

describe('Notes reading-mode Wiki keyboard activation', () => {
  it('exposes a valid ID link as a focusable link and activates the exact duplicate-title noteId', () => {
    const root = mount(serializeIdWikiLink('second', '동일 제목'), [
      target('first', '동일 제목'), target('second', '동일 제목'),
    ]);
    const link = root.querySelector<HTMLElement>('[data-note-link]')!;
    expect(link.getAttribute('role')).toBe('link');
    expect(link.getAttribute('tabindex')).toBe('0');

    const event = press(link);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0]).toMatchObject({ kind: 'note-id', noteId: 'second' });
    expect(navigate.mock.calls[0][1]).toEqual({ preferReading: true });

    navigate.mockClear();
    link.click();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'note-id', noteId: 'second' }), { preferReading: true });
  });

  it('preserves legacy title navigation, including the existing missing-title action', () => {
    const root = mount('[[새 노트]]');
    const link = root.querySelector<HTMLElement>('[data-wiki]')!;
    expect(link.getAttribute('role')).toBe('link');
    expect(link.getAttribute('tabindex')).toBe('0');
    press(link);
    expect(navigate).toHaveBeenCalledWith('새 노트', { preferReading: true });
    navigate.mockClear();
    link.click();
    expect(navigate).toHaveBeenCalledWith('새 노트', { preferReading: true });
  });

  it('explains an unavailable ID link while preserving its authored label and avoiding duplicate-title fallback', () => {
    const unavailable = getTranslator('en')('wikiIdLinkUnavailable');
    const root = mount(serializeIdWikiLink('deleted-id', 'Visible title'), [target('other-id', 'Visible title')], unavailable);
    const broken = root.querySelector<HTMLElement>('.be-wikilink-broken')!;
    expect(broken.textContent).toBe(`${unavailable}: Visible title`);
    expect(broken.getAttribute('role')).toBeNull();
    expect(broken.getAttribute('tabindex')).toBeNull();
    expect(broken.hasAttribute('data-note-link')).toBe(false);
    expect(broken.hasAttribute('data-wiki')).toBe(false);
    expect(root.textContent).not.toContain('deleted-id');
    expect(handleReadingWikiClick(broken, navigate)).toBe(false);
    expect(handleReadingWikiKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), root, navigate)).toBe(false);
    broken.click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['en', 'Linked note unavailable'],
    ['ko', '연결된 노트를 사용할 수 없습니다'],
    ['ja', 'リンク先ノートを利用できません'],
  ] as const)('localizes the fallback for an unavailable unlabeled link (%s)', (language: Language, expected: string) => {
    const label = getTranslator(language)('wikiIdLinkUnavailable');
    const root = mount(serializeIdWikiLink('missing-id'), [target('other-id', 'Duplicate title')], label);
    const broken = root.querySelector<HTMLElement>('.be-wikilink-broken')!;
    expect(broken.textContent).toBe(expected);
    expect(root.textContent).not.toContain('Duplicate title');
    expect(root.textContent).not.toContain('missing-id');
    expect(broken.getAttribute('role')).toBeNull();
    expect(broken.getAttribute('tabindex')).toBeNull();
    expect(broken.hasAttribute('data-note-link')).toBe(false);
    expect(broken.hasAttribute('data-wiki')).toBe(false);
  });

  it('treats stale exact-ID candidates as unavailable without exposing their title', () => {
    const unavailable = getTranslator('ko')('wikiIdLinkUnavailable');
    const root = mount(serializeIdWikiLink('stale-id'), [target('stale-id', 'Private title', false)], unavailable);
    const broken = root.querySelector<HTMLElement>('.be-wikilink-broken')!;
    expect(broken.textContent).toBe(unavailable);
    expect(root.textContent).not.toContain('Private title');
    expect(handleReadingWikiClick(broken, navigate)).toBe(false);
    expect(handleReadingWikiKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }), root, navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys, modifiers, repeated Enter, and IME composition', () => {
    const root = mount(serializeIdWikiLink('target', 'Target'), [target('target', 'Target')]);
    const link = root.querySelector<HTMLElement>('[data-note-link]')!;
    press(link, { key: 'Space' });
    press(link, { shiftKey: true });
    press(link, { repeat: true });
    press(link, { isComposing: true });
    const legacyIme = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(legacyIme, 'keyCode', { value: 229 });
    link.dispatchEvent(legacyIme);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps editing-mode Wiki tokens out of the tab order and preserves authored Markdown', () => {
    const source = serializeIdWikiLink('target', '日本語') + ' [[Legacy]]';
    const html = liveInlineHtml(source, colors, [target('target', '日本語'), 'Legacy'], '', getTranslator('ja')('wikiIdLinkUnavailable'));
    expect(html).toContain(`data-note-link="${serializeIdWikiLink('target', '日本語')}"`);
    expect(html).toContain('data-wiki="Legacy"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('role="link"');
  });

  it('marks an unavailable editing token without changing its editable Markdown text', () => {
    const source = serializeIdWikiLink('private-id');
    const unavailable = getTranslator('ja')('wikiIdLinkUnavailable');
    const container = document.createElement('div');
    container.innerHTML = liveInlineHtml(source, colors, [target('private-id', 'Private title', false)], '', unavailable);
    const chip = container.querySelector<HTMLElement>('.be-wiki-chip-broken')!;
    expect(readBlockText(container)).toBe(source);
    expect(chip.textContent).toBe(source);
    expect(chip.getAttribute('title')).toBe(unavailable);
    expect(chip.getAttribute('aria-description')).toBe(unavailable);
    expect(chip.hasAttribute('data-note-link')).toBe(false);
    expect(chip.hasAttribute('data-wiki')).toBe(false);
    expect(chip.getAttribute('role')).toBeNull();
    expect(chip.getAttribute('tabindex')).toBeNull();
    expect(chip.getAttribute('title')).not.toContain('private-id');
  });

  it('preserves the editing caret offset around an unavailable token', () => {
    const source = `before ${serializeIdWikiLink('private-id')} after`;
    const container = document.createElement('div');
    container.contentEditable = 'true';
    container.innerHTML = liveInlineHtml(source, colors, [], '', getTranslator('ko')('wikiIdLinkUnavailable'));
    container.focus();
    const caret = source.indexOf(' after');

    setCaretOffset(container, caret);

    expect(readBlockText(container)).toBe(source);
    expect(getCaretOffset(container)).toBe(caret);
  });

  it.each(['한국어 노트', '日本語ノート', 'Notes 📚'])('retains Unicode link labels: %s', title => {
    const root = mount(serializeIdWikiLink('unicode-id', title), [target('unicode-id', title)]);
    expect(root.querySelector('[role="link"][tabindex="0"]')?.textContent).toBe(title);
  });
});
