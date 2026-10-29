// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInlineMarkdownHtml, liveInlineHtml } from './editableRender';
import { handleReadingWikiKeyDown, serializeIdWikiLink, type WikiNoteTarget, type WikiNavigationTarget } from './wikiLinks';
import type { BlockEditorColors } from './editorTypes';

const colors = new Proxy({}, { get: () => '#555' }) as BlockEditorColors;
const target = (id: string, title: string, current = true): WikiNoteTarget => ({
  id, title, isCurrent: () => current,
});
const navigate = vi.fn<(target: WikiNavigationTarget, options?: { preferReading?: boolean }) => void>();

function mount(markdown: string, targets: (WikiNoteTarget | string)[] = []) {
  const root = document.createElement('div');
  root.innerHTML = renderInlineMarkdownHtml(markdown, colors, '', targets);
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
  });

  it('preserves legacy title navigation, including the existing missing-title action', () => {
    const root = mount('[[새 노트]]');
    const link = root.querySelector<HTMLElement>('[data-wiki]')!;
    expect(link.getAttribute('role')).toBe('link');
    expect(link.getAttribute('tabindex')).toBe('0');
    press(link);
    expect(navigate).toHaveBeenCalledWith('새 노트', { preferReading: true });
  });

  it('does not make broken ID-bound links actionable or fall back to a matching title', () => {
    const root = mount(serializeIdWikiLink('deleted-id', 'Visible title'), [target('other-id', 'Visible title')]);
    const broken = root.querySelector<HTMLElement>('.be-wikilink-broken')!;
    expect(broken.getAttribute('role')).toBeNull();
    expect(broken.getAttribute('tabindex')).toBeNull();
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
    const html = liveInlineHtml(source, colors, [target('target', '日本語'), 'Legacy']);
    expect(html).toContain(`data-note-link="${serializeIdWikiLink('target', '日本語')}"`);
    expect(html).toContain('data-wiki="Legacy"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).not.toContain('role="link"');
  });

  it.each(['한국어 노트', '日本語ノート', 'Notes 📚'])('retains Unicode link labels: %s', title => {
    const root = mount(serializeIdWikiLink('unicode-id', title), [target('unicode-id', title)]);
    expect(root.querySelector('[role="link"][tabindex="0"]')?.textContent).toBe(title);
  });
});
