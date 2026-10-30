// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionToolbar } from './features/block-editor/features/selection/components/SelectionToolbar';
import { buildSelectedWikiInsertText } from './features/block-editor/features/selection/utils/selectionWikiLink';
import { EditableBlock } from './EditableBlock';
import { readBlockText, getCaretOffset, getSelectionOffsets, setSelectionOffsets } from './editableDom';
import { liveInlineHtml, renderInlineMarkdownHtml } from './editableRender';
import { blocksToMarkdown, markdownToBlocks, makeBlock, type BlockType } from './blockUtils';
import { parseIdWikiLink, serializeIdWikiLink, type WikiNoteTarget } from './wikiLinks';
import type { BlockEditorColors } from './editorTypes';
import { useAppStore } from '../../store/useAppStore';

const colors = { accent: '#8260db', textMuted: '#888', text: '#222', codeBg: '#eee' } as BlockEditorColors;
const target = (id: string, title = 'Duplicate'): WikiNoteTarget => ({ id, title, isCurrent: () => true });
let container: HTMLDivElement, root: Root, editor: HTMLElement;
let targets: WikiNoteTarget[], source: string, type: BlockType;
const changed = vi.fn(), split = vi.fn(), noop = vi.fn();
const getType = () => type;
const block = makeBlock('paragraph', { id: 'source-block' });
const scroll = HTMLElement.prototype.scrollIntoView;

async function render() {
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'be-editor-root' },
      React.createElement('div', { className: 'be-block', 'data-drag-id': block.id },
        React.createElement(EditableBlock, { block: { ...block, type, content: source }, colors,
          editableRef: { current: null }, isActive: true, wikiTargets: targets,
          onContentChange: changed, onSplitBlock: split, onMergeWithPrev: noop,
          onSlashOpen: noop, onSlashClose: noop, onWikiOpen: noop, onWikiClose: noop,
          isMenuOpen: false, onNavigateBlock: noop }))),
    React.createElement(SelectionToolbar, { colors, wikiTargets: targets, searchQuery: '', activeBlockId: block.id,
      getBlockType: getType, onContentChange: changed, onConvertBlock: noop }))));
  editor = container.querySelector<HTMLElement>('[contenteditable="true"]')!;
}
async function select(start = 7, end = 12) {
  await act(async () => { editor.focus(); setSelectionOffsets(editor, start, end); document.dispatchEvent(new Event('selectionchange')); });
}
async function open() {
  const button = [...container.querySelectorAll<HTMLButtonElement>('.be-selection-toolbar button')].find(el => el.textContent === '[[]]')!;
  await act(async () => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
  expect(container.querySelector('.be-wiki-menu input')).not.toBeNull();
}
async function key(key: string, extras: KeyboardEventInit = {}) {
  await act(async () => (document.activeElement ?? editor).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...extras })));
}
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); changed.mockClear(); split.mockClear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  source = 'before label after'; type = 'paragraph'; targets = [target('wrong'), target('exact/한글')];
  await render();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); window.getSelection()?.removeAllRanges(); HTMLElement.prototype.scrollIntoView = scroll; });

describe('selected text to ID Wiki link', () => {
  it('picks the exact ID with duplicate titles, preserves the label/caret, editing and Markdown reload', async () => {
    await select(); await open();
    await act(async () => container.querySelectorAll('.be-wiki-menu button')[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    const token = serializeIdWikiLink('exact/한글', 'label');
    const result = 'before ' + token + ' after';
    expect(changed).toHaveBeenLastCalledWith(block.id, result);
    expect(readBlockText(editor)).toBe(result);
    expect(document.activeElement).toBe(editor);
    expect(getCaretOffset(editor)).toBe(7 + token.length);
    const saved = blocksToMarkdown(markdownToBlocks(result));
    expect(blocksToMarkdown(markdownToBlocks(saved))).toBe(saved);
    expect(saved).toContain(result);
    const reading = document.createElement('div'); reading.innerHTML = renderInlineMarkdownHtml(result, colors, '', targets);
    expect(reading.textContent).toBe(source);
    expect(reading.querySelector('[data-note-link]')?.getAttribute('data-note-link')).toBe(token);
    editor.append('!');
    await act(async () => editor.dispatchEvent(new InputEvent('input', { bubbles: true })));
    expect(changed).toHaveBeenLastCalledWith(block.id, result + '!');
  });
  it('opens from a keyboard selection and filters targets before Enter, without splitting the block', async () => {
    targets = [target('first', 'Other'), target('second', 'Target')]; await render(); await select();
    await key('k', { ctrlKey: true, shiftKey: true });
    const input = container.querySelector<HTMLInputElement>('.be-wiki-menu input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Target');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelectorAll('.be-wiki-menu button')).toHaveLength(1);
    await key('ArrowDown'); await key('Enter');
    expect(changed).toHaveBeenLastCalledWith(block.id, 'before ' + serializeIdWikiLink('second', 'label') + ' after');
    expect(split).not.toHaveBeenCalled();
  });
  it('Escape restores the original selection without document changes', async () => {
    await select(); await open(); await key('Escape');
    expect(changed).not.toHaveBeenCalled(); expect(readBlockText(editor)).toBe(source);
    expect(getSelectionOffsets(editor)).toEqual({ start: 7, end: 12 });
    expect(document.activeElement).toBe(editor);
  });
  it('Enter picks the keyboard-focused duplicate-title result rather than the initial cursor', async () => {
    await select(); await open();
    const second = container.querySelectorAll<HTMLButtonElement>('.be-wiki-menu button')[1];
    await act(async () => second.focus()); await key('Enter');
    expect(changed).toHaveBeenLastCalledWith(block.id, 'before ' + serializeIdWikiLink('exact/한글', 'label') + ' after');
  });
  it('ignores Enter after focus leaves the picker without a pointer click', async () => {
    await select(); await open();
    const outside = document.createElement('button'); container.append(outside);
    await act(async () => outside.focus());
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(async () => outside.dispatchEvent(event));
    expect(changed).not.toHaveBeenCalled(); expect(document.activeElement).toBe(outside);
    expect(event.defaultPrevented).toBe(false); expect(readBlockText(editor)).toBe(source);
  });
  it('keeps the insertion caret after controlled-parent reconciliation and still reconciles history changes', async () => {
    let restore!: (value: string) => void;
    function ControlledHost() {
      const [content, setContent] = React.useState(source);
      restore = setContent;
      const change = React.useCallback((id: string, text: string) => { changed(id, text); setContent(text); }, []);
      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'be-editor-root' },
          React.createElement('div', { className: 'be-block', 'data-drag-id': block.id },
            React.createElement(EditableBlock, { block: { ...block, content }, colors, editableRef: { current: null },
              isActive: true, wikiTargets: targets, onContentChange: change, onSplitBlock: split, onMergeWithPrev: noop,
              onSlashOpen: noop, onSlashClose: noop, onWikiOpen: noop, onWikiClose: noop,
              isMenuOpen: false, onNavigateBlock: noop }))),
        React.createElement(SelectionToolbar, { colors, wikiTargets: targets, searchQuery: '', activeBlockId: block.id,
          getBlockType: getType, onContentChange: change, onConvertBlock: noop }));
    }
    await act(async () => root.render(React.createElement(ControlledHost)));
    editor = container.querySelector<HTMLElement>('[contenteditable="true"]')!;
    await select(); await open(); await key('Enter');
    const token = serializeIdWikiLink('wrong', 'label');
    expect(readBlockText(editor)).toBe('before ' + token + ' after');
    expect(getCaretOffset(editor)).toBe(7 + token.length);
    await act(async () => restore('restored history'));
    expect(readBlockText(editor)).toBe('restored history');
  });
  it('outside click cancels without mutation or stealing focus', async () => {
    await select(); await open();
    const input = document.createElement('input'); container.append(input);
    await act(async () => input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(container.querySelector('.be-wiki-menu')).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
  it('rejects a candidate invalidated while the menu is open, including A/B/A', async () => {
    let generation = 1;
    targets = [{ id: 'A-target', title: 'A note', isCurrent: () => generation === 1 }];
    await render(); await select(); await open();
    generation = 2; generation = 3;
    await key('Enter');
    expect(changed).not.toHaveBeenCalled(); expect(readBlockText(editor)).toBe(source);
  });
  it('closes a pending selection when the current publication is replaced', async () => {
    await select(); await open(); targets = [target('B-target', 'B note')]; await render();
    expect(container.querySelector('.be-wiki-menu')).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
  it('does not overwrite newer source edits while selecting a target', async () => {
    await select(); await open(); editor.textContent = source + ' newer'; await key('Enter');
    expect(changed).not.toHaveBeenCalled(); expect(readBlockText(editor)).toBe(source + ' newer');
  });
  it.each(['code', 'math', 'table'] as BlockType[])('rejects %s block selection', async unsupported => {
    await select(); type = unsupported;
    const button = [...container.querySelectorAll<HTMLButtonElement>('.be-selection-toolbar button')].find(el => el.textContent === '[[]]')!;
    await act(async () => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(container.querySelector('.be-wiki-menu')).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
  it.each(['before `label` after', 'before $label$ after', 'before [[label]] after'])('rejects protected inline selection in %s', async text => {
    source = text; await render(); await select(0, source.length);
    const button = [...container.querySelectorAll<HTMLButtonElement>('.be-selection-toolbar button')].find(el => el.textContent === '[[]]')!;
    await act(async () => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(container.querySelector('.be-wiki-menu')).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
  it('does not expose a toolbar for cross-block selection', async () => {
    const other = document.createElement('div'); other.contentEditable = 'true'; other.textContent = 'other'; container.querySelector('.be-editor-root')!.append(other);
    await act(async () => {
      const range = document.createRange(); range.setStart(editor.firstChild!, 0); range.setEnd(other.firstChild!, 3);
      window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(container.querySelector('.be-selection-toolbar')).toBeNull(); expect(changed).not.toHaveBeenCalled();
  });
  it('keeps existing bold formatting behavior', async () => {
    await select(); await key('b', { ctrlKey: true });
    expect(changed).toHaveBeenLastCalledWith(block.id, 'before **label** after');
  });
  it('keeps the localized unavailable-link status when formatting repaints the editor', async () => {
    const oldLanguage = useAppStore.getState().appSettings.language;
    const missing = serializeIdWikiLink('deleted', 'Retained label');
    try {
      await act(async () => useAppStore.setState(state => ({
        appSettings: { ...state.appSettings, language: 'ja' },
      })));
      source = `${missing} plain text`;
      await render();
      const start = missing.length + 1;
      await select(start, start + 5);
      expect(getSelectionOffsets(editor)).toEqual({ start, end: start + 5 });
      await key('b', { ctrlKey: true });
      const broken = editor.querySelector<HTMLElement>('.be-wiki-chip-broken')!;
      expect(broken.getAttribute('title')).toBe('リンク先ノートを利用できません');
      expect(broken.getAttribute('aria-description')).toBe('リンク先ノートを利用できません');
      expect(changed).toHaveBeenLastCalledWith(block.id, `${missing} **plain** text`);
      expect(readBlockText(editor)).toBe(`${missing} **plain** text`);
    } finally {
      await act(async () => useAppStore.setState(state => ({
        appSettings: { ...state.appSettings, language: oldLanguage },
      })));
    }
  });
});

describe('selection Wiki source preservation', () => {
  it.each(['한글 日本語', '[x] * _ ` | \\ & <img>', '$& $\''])('escapes and round-trips the exact label %s', label => {
    const result = buildSelectedWikiInsertText('before ' + label + ' after', 7, 7 + label.length, target('id/日本語'))!;
    expect(parseIdWikiLink(result.newText.slice(7, result.caret))?.label).toBe(label);
    const el = document.createElement('div'); el.innerHTML = liveInlineHtml(result.newText, colors, [target('id/日本語')]);
    expect(readBlockText(el)).toBe(result.newText);
  });
  it('rejects legacy title-only, invalid and stale targets and multiline selections', () => {
    expect(buildSelectedWikiInsertText('label', 0, 5, 'Title')).toBeNull();
    expect(buildSelectedWikiInsertText('label', 0, 5, target(''))).toBeNull();
    expect(buildSelectedWikiInsertText('label', 0, 5, { ...target('id'), isCurrent: () => false })).toBeNull();
    expect(buildSelectedWikiInsertText('a\nb', 0, 3, target('id'))).toBeNull();
    expect(buildSelectedWikiInsertText('\\label', 1, 6, target('id'))).toBeNull();
  });
});
