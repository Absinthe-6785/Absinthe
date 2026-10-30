// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { WikiMenu } from './features/block-editor/features/menus/components/WikiMenu';
import { useEditorMenus } from './features/block-editor/features/menus/hooks/useEditorMenus';
import { EditableBlock } from './EditableBlock';
import { ReferenceExplorerPanel } from './features/knowledge/components/ReferenceExplorerPanel';
import { extractNoteReferenceSummary } from './features/knowledge/references/extractNoteReferenceSummary';
import type { NoteChromeColors } from './noteEditorTheme';
import { parseIdWikiLink, parseIdWikiLinks, serializeIdWikiLink, type WikiNoteTarget } from './wikiLinks';
import { buildWikiInsertText, findWikiLinkAtOffset } from './features/block-editor/features/menus/utils/wikiNavigation';
import { filterWikiTargets } from './features/block-editor/features/menus/utils/wikiSearch';
import { liveInlineHtml, renderInlineMarkdownHtml } from './editableRender';
import { readBlockText, setCaretOffset, getCaretOffset } from './editableDom';
import { markdownToBlocks, blocksToMarkdown, makeBlock, type Block } from './blockUtils';
import { extractLinks, type NoteBase } from './noteUtils';
import { KnowledgeIndexService } from './features/knowledge/KnowledgeIndexService';
import { buildBacklinkIndex, getPageReferences } from './features/knowledge/backlinks/buildBacklinkIndex';
import { buildGlobalGraphData } from './features/knowledge/graph/buildGlobalGraphData';
import { buildNoteNeighborhood } from './features/knowledge/graph/buildNoteNeighborhood';
import { extractLinkContexts } from './features/knowledge/linkContext/linkContextOffsetIndex';
import { parseNoteMarkdown, serializeNoteMarkdown } from './features/knowledge/properties/noteProperties';
import { backupEntryToNote } from '../../lib/importVaultBackup';
import { buildVaultBackupManifest } from '../../lib/exportVaultBackup';
import type { BlockEditorColors } from './editorTypes';
import { useAppStore } from '../../store/useAppStore';

const colors = { accent: '#8260db', textMuted: '#888', text: '#222', codeBg: '#eee' } as BlockEditorColors;
const note = (id: string, title: string, body = ''): NoteBase =>
  ({ id, title, body, updatedAt: 1, folderId: null, deletedAt: null });
const candidate = (id: string, title: string): WikiNoteTarget => ({ id, title, isCurrent: () => true });

describe('ID Wiki source contract', () => {
  it.each(['note-123', '노트/日本語?#()', 'space id'])('round-trips exact encoded ID %s', id => {
    const raw = serializeIdWikiLink(id);
    expect(parseIdWikiLink(raw)?.noteId).toBe(id);
    expect(parseIdWikiLink(raw)?.label).toBe('');
  });
  it('preserves plain Unicode labels and Markdown punctuation', () => {
    const label = '한글 日本語 [label] *bold* _x_ `code` | \\ & <img>';
    expect(parseIdWikiLink(serializeIdWikiLink('id', label))?.label).toBe(label);
    expect(parseIdWikiLink('[keep \\q](absinthe-note:id)')?.label).toBe('keep \\q');
  });
  it.each(['[](absinthe-note:)', '[](absinthe-note:%ZZ)', '[](absinthe-note:id', '[incomplete', '[](https://example.com)'])('leaves malformed/other source alone: %s', raw => {
    expect(parseIdWikiLinks(raw)).toEqual([]);
  });
  it('does not reinterpret legacy title strings as permanent IDs', () => {
    expect(extractLinks('[[note:id|label]] [[Same]]')).toEqual(['note:id|label', 'Same']);
    expect(parseIdWikiLinks('[[note:id|label]]')).toEqual([]);
    expect(parseIdWikiLinks('[[literal [](absinthe-note:id)]]')).toEqual([]);
  });
  it('keeps original offsets after escaped currency and Unicode text', () => {
    const raw = serializeIdWikiLink('target');
    const source = '한글 price \\$5 ' + raw;
    const link = parseIdWikiLinks(source)[0];
    expect(link.raw).toBe(raw);
    expect(link.start).toBe(source.indexOf(raw));
    expect(renderInlineMarkdownHtml(source, colors, '', [candidate('target', 'Target')])).toContain('data-note-link=');
  });
  it.each(['\n', '\n\n', '\n# ', '\n- ', '\n> '])('does not join inline code across persisted block boundary %j', boundary => {
    const raw = serializeIdWikiLink('target');
    const source = 'Before `' + boundary + raw + '\n\nAfter `';
    expect(parseIdWikiLinks(source).map(link => link.noteId)).toEqual(['target']);
    const service = new KnowledgeIndexService();
    service.buildFromNotes([note('source', 'Source', source), note('target', 'Target')]);
    expect(service.getIncomingForNote('target').map(ref => ref.noteId)).toEqual(['source']);
    const renderedBlocks = markdownToBlocks(source).map(block =>
      renderInlineMarkdownHtml(block.content, colors, '', [candidate('target', 'Target')])).join('');
    expect(renderedBlocks).toContain('data-note-link=');
    expect(buildGlobalGraphData({ service }).edges.some(edge => edge.targetId === 'target')).toBe(true);
  });
  it.each(['# Heading `', '- Item `', '> Quote `', 'Paragraph `'])('ends source inline context at the existing %s block boundary', before => {
    const source = before + '\n[](absinthe-note:target)\nAfter `';
    expect(parseIdWikiLinks(source).map(link => link.noteId)).toEqual(['target']);
    const service = new KnowledgeIndexService();
    service.buildFromNotes([note('source', 'Source', source), note('target', 'Target')]);
    expect(service.getIncomingForNote('target').map(ref => ref.noteId)).toEqual(['source']);
    expect(markdownToBlocks(source).some(block => renderInlineMarkdownHtml(block.content, colors, '', [candidate('target', 'Target')]).includes('data-note-link='))).toBe(true);
  });
  it('does not combine backticks across table cells in the body index', () => {
    const source = '| A | B | C |\n| --- | --- | --- |\n| ` | [](absinthe-note:target) | ` |';
    expect(parseIdWikiLinks(source).map(link => link.noteId)).toEqual(['target']);
    const table = markdownToBlocks(source)[0];
    expect(table.tableRows?.[0][1]).toBe('[](absinthe-note:target)');
    expect(blocksToMarkdown([table])).toContain('[](absinthe-note:target)');
  });
  it.each([
    '`line\n[](absinthe-note:target)\nend`',
    '``line ` inner\n[](absinthe-note:target)\nend``',
    '```md\n[](absinthe-note:target)',
  ])('excludes multiline and varying-backtick code: %s', source => {
    expect(parseIdWikiLinks(source, 'inline')).toEqual([]);
    expect(renderInlineMarkdownHtml(source, colors, '', [candidate('target', 'Target')])).not.toContain('data-note-link=');
    const service = new KnowledgeIndexService();
    service.buildFromNotes([note('source', 'Source', source), note('target', 'Target')]);
    const reparsedBlocks = markdownToBlocks(source);
    const expectedIds = reparsedBlocks.flatMap(block => block.type === 'code' || block.type === 'math' ? [] : parseIdWikiLinks(block.content, 'inline').map(link => link.noteId));
    expect(service.getOutgoingTargetIds('source')).toEqual([...new Set(expectedIds)]);
  });
  it('does not invent tilde-fence support absent from the existing block parser', () => {
    const source = '~~~~md\n[](absinthe-note:target)\n~~~~~';
    expect(markdownToBlocks(source).some(block => block.type === 'code')).toBe(false);
    expect(parseIdWikiLinks(source).map(link => link.noteId)).toEqual(['target']);
    expect(renderInlineMarkdownHtml(source, colors, '', [candidate('target', 'Target')])).toContain('data-note-link=');
  });
  it('excludes code, math, images and escaped links', () => {
    const raw = serializeIdWikiLink('id');
    for (const body of [`\`${raw}\``, `\`\`\`md\n${raw}\n\`\`\``, `$$\n${raw}\n$$`, `\\[\n${raw}\n\\]`, `!${raw}`, `\\${raw}`]) {
      expect(parseIdWikiLinks(body), body).toEqual([]);
    }
  });
  it('inserts the selected ID despite duplicate titles and preserves the caret', () => {
    const targets = [candidate('first', 'Same'), candidate('second', 'Same')];
    expect(filterWikiTargets('Same', targets)).toEqual(targets);
    const inserted = buildWikiInsertText('before [[Sa', 11, targets[1])!;
    expect(inserted.newText).toBe('before [](absinthe-note:second)');
    expect(inserted.caret).toBe(inserted.newText.length);
    expect(findWikiLinkAtOffset(inserted.newText, 15)).toMatchObject({ kind: 'note-id', noteId: 'second' });
    expect(buildWikiInsertText('[[', 2, { ...targets[0], isCurrent: () => false })).toBeNull();
  });
});

describe('ID Wiki reading and editing', () => {
  it.each(["$&", "$'", "$`", "$$"])('preserves replacement metacharacters in label %s', label => {
    const raw = serializeIdWikiLink('target', label);
    const el = document.createElement('div');
    el.innerHTML = liveInlineHtml(raw, colors, [candidate('target', 'Target')]);
    expect(readBlockText(el)).toBe(raw);
    el.innerHTML = renderInlineMarkdownHtml(raw, colors, '', [candidate('target', 'Target')]);
    expect(el.textContent).toBe(label);
  });
  it('leaves normal and Shift editing clicks alone, but allows explicit Ctrl/Cmd navigation', async () => {
    const raw = serializeIdWikiLink('target');
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const navigate = vi.fn();
    const noop = vi.fn();
    try {
      await act(async () => root.render(React.createElement(EditableBlock, {
        block: makeBlock('paragraph', { content: raw }), colors, editableRef: { current: null },
        onSplitBlock: noop, onMergeWithPrev: noop, onContentChange: noop,
        onSlashOpen: noop, onSlashClose: noop, onWikiOpen: noop, onWikiClose: noop,
        isMenuOpen: false, onNavigateBlock: noop, onWikiNavigate: navigate,
        wikiTargets: [candidate('target', 'Target')], isActive: true,
      })));
      const link = container.querySelector<HTMLElement>('[data-note-link]')!;
      expect(link).not.toBeNull();
      await act(async () => {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true, shiftKey: true }));
      });
      expect(navigate).not.toHaveBeenCalled();
      await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true, cancelable: true })));
      expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'note-id', noteId: 'target' }));
      expect(noop).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
  it('keeps broken ID references inert while legacy broken references retain creation', async () => {
    const source = note('source', 'Source', serializeIdWikiLink('deleted', 'Same') + ' [[Legacy missing]]');
    const summary = extractNoteReferenceSummary(source, [source]);
    expect(summary.outgoing.find(link => link.idLink)?.idLink?.noteId).toBe('deleted');
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const navigate = vi.fn(), create = vi.fn();
    try {
      await act(async () => root.render(React.createElement(ReferenceExplorerPanel, {
        colors: {} as NoteChromeColors, summary, mentioning: [], onNavigateToNote: navigate, onNavigateToWiki: create,
      })));
      const rows = [...container.querySelectorAll<HTMLElement>('.bbl')];
      const broken = rows.find(row => row.textContent?.includes('Same'))!;
      expect(broken.getAttribute('role')).toBeNull();
      await act(async () => broken.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      expect(navigate).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      await act(async () => rows.find(row => row.textContent?.includes('Legacy missing'))!.click());
      expect(create).toHaveBeenCalledWith('Legacy missing');
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
  it('inserts an exact-ID token through the mounted autocomplete menu and keeps the caret', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const targets = [candidate('wrong', 'Duplicate'), candidate('selected', 'Duplicate')];
    const missing = serializeIdWikiLink('deleted', 'Existing label');
    const editorText = `${missing} [[Du`;
    const changed = vi.fn();
    function MenuHost() {
      const menu = useEditorMenus({ getBlocks: () => [], onChange: vi.fn(), onFocusCmd: vi.fn(),
        colors, wikiTargets: targets, searchQuery: '', onContentChange: changed });
      useEffect(() => menu.setWikiMenu({ blockId: 'block', query: 'Du', anchorX: 0, anchorY: 0 }), []);
      return React.createElement(React.Fragment, null,
        React.createElement('div', { contentEditable: true, tabIndex: 0, 'data-editor': '', suppressContentEditableWarning: true }, editorText),
        menu.wikiMenu && React.createElement(WikiMenu, { ...menu.wikiMenu, targets, colors,
          onSelect: menu.handleWikiSelect, onClose: menu.closeWikiMenu }));
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const scroll = HTMLElement.prototype.scrollIntoView;
    const oldLanguage = useAppStore.getState().appSettings.language;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    try {
      await act(async () => useAppStore.setState(state => ({
        appSettings: { ...state.appSettings, language: 'ko' },
      })));
      await act(async () => root.render(React.createElement(MenuHost)));
      const editor = container.querySelector<HTMLElement>('[data-editor]')!;
      editor.focus();
      setCaretOffset(editor, editorText.length);
      await act(async () => container.querySelectorAll('button')[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
      const raw = `${missing} ${serializeIdWikiLink('selected')}`;
      expect(changed).toHaveBeenCalledWith('block', raw);
      expect(readBlockText(editor)).toBe(raw);
      expect(getCaretOffset(editor)).toBe(raw.length);
      const broken = editor.querySelector<HTMLElement>('.be-wiki-chip-broken')!;
      expect(broken.getAttribute('title')).toBe('연결된 노트를 사용할 수 없습니다');
      expect(broken.getAttribute('aria-description')).toBe('연결된 노트를 사용할 수 없습니다');
    } finally {
      await act(async () => root.unmount());
      container.remove();
      HTMLElement.prototype.scrollIntoView = scroll;
      await act(async () => useAppStore.setState(state => ({
        appSettings: { ...state.appSettings, language: oldLanguage },
      })));
    }
  });
  it('uses the current title only for empty labels; custom labels remain plain text', () => {
    const target = candidate('id', 'Renamed');
    const el = document.createElement('div');
    el.innerHTML = renderInlineMarkdownHtml(serializeIdWikiLink('id'), colors, '', [target]);
    expect(el.textContent).toBe('Renamed');
    el.innerHTML = renderInlineMarkdownHtml(serializeIdWikiLink('id', '*표시* <img>'), colors, '', [target]);
    expect(el.textContent).toBe('*표시* <img>');
    expect(el.querySelector('img, em, strong')).toBeNull();
    expect(el.querySelector('[data-note-link]')?.getAttribute('data-note-link')).toBe(serializeIdWikiLink('id', '*표시* <img>'));
  });
  it('renders missing/deleted/unauthorized IDs without a navigation attribute', () => {
    const el = document.createElement('div');
    el.innerHTML = renderInlineMarkdownHtml(serializeIdWikiLink('id'), colors, '', [candidate('other', 'Same'), { ...candidate('id', 'Private'), isCurrent: () => false }]);
    expect(el.textContent).not.toContain('Private');
    expect(el.querySelector('[data-note-link]')).toBeNull();
    expect(el.querySelector('.be-wikilink-broken')).not.toBeNull();
  });
  it('recovers the entire authored token from contentEditable DOM without mutation', () => {
    const raw = 'before ' + serializeIdWikiLink('id', '한글 [x] * _ \\') + ' after';
    const el = document.createElement('div');
    el.contentEditable = 'true';
    el.innerHTML = liveInlineHtml(raw, colors, [candidate('id', 'Title')]);
    expect(readBlockText(el)).toBe(raw);
    const blocks = markdownToBlocks(raw);
    const saved = blocksToMarkdown(blocks);
    const reloaded = markdownToBlocks(saved);
    expect(blocksToMarkdown(reloaded)).toBe(saved);
    expect(saved).toContain(raw);
  });
  it('preserves default and ordinary-label tokens in table Markdown without changing the table parser', () => {
    const raw = '| A | B |\n| --- | --- |\n| [](absinthe-note:id) | [표시](absinthe-note:id) |';
    expect(blocksToMarkdown(markdownToBlocks(raw))).toContain('| [](absinthe-note:id) | [표시](absinthe-note:id) |');
    // Literal pipe labels remain outside this slice's table compatibility claim.
  });
  it('preserves source in Markdown and Vault import without remapping missing targets', () => {
    const source = note('source', 'Source', serializeIdWikiLink('missing', '라벨'));
    const markdown = serializeNoteMarkdown(source);
    expect(parseNoteMarkdown(markdown).body).toBe(source.body);
    const manifest = buildVaultBackupManifest([source], []);
    expect(manifest.notes[0].markdown).toBe(markdown);
    const restored = backupEntryToNote(manifest.notes[0], 'new-source-id');
    expect(restored.id).toBe('new-source-id');
    expect(restored.body).toBe(source.body);
    expect(parseIdWikiLinks(restored.body)[0].noteId).toBe('missing');
  });
});

describe('ID Wiki index and Cosmos consistency', () => {
  describe('P2 boundary regressions', () => {
    const fixtures = [
      ['math stays inside its table cell', '| A | B | C |\n| --- | --- | --- |\n| $x_1 | [](absinthe-note:target) | y$ |'],
      ['toggle-child code stays excluded', '> Toggle\n  ```\n  [](absinthe-note:hidden)\n  ```\n  [](absinthe-note:target)'],
      ['fences inside display math do not consume later text', '$$\n```\n$$\n[](absinthe-note:target)'],
      ['nested heading/closed toggles retain source offsets', '#> Outer\n  >! Inner\n    ```\n    [](absinthe-note:hidden)\n    ```\n    [](absinthe-note:target)'],
      ['ordinary indentation does not invent a code block', '  ```\n  [](absinthe-note:target)\n  ```'],
      ['math inside one cell remains excluded', '| A | B | C |\n| --- | --- | --- |\n| $x_1 + [](absinthe-note:hidden)$ | [](absinthe-note:target) | tail |'],
      ['math markers inside code remain excluded', '```\n$$\n[](absinthe-note:hidden)\n$$\n```\n[](absinthe-note:target)'],
      ['callout continuation is one inline code context', '> [!note] `start\n> [](absinthe-note:hidden)\n> end`\n[](absinthe-note:target)'],
      ['callout continuation cannot become a toggle', '> [!note] `start\n> Toggle\n  ```\n  [](absinthe-note:target)\n  ```\n> end`'],
      ['nested callout preserves deindented offsets', '#> Group\n  > [!note] `start\n  > [](absinthe-note:hidden)\n  > end`\n  [](absinthe-note:target)'],
      ['callout summary trimming preserves link offsets', '> [!note]   [](absinthe-note:target) `start  \n> [](absinthe-note:hidden)\n> end`'],
    ];
    it.each(fixtures)('%s', (_name, region) => {
      const body = '[](absinthe-note:before)\n\n' + region + '\n\n[](absinthe-note:after) [[Legacy]]';
      const source = { ...note('source', 'Source', body), relations: { related: ['legacy'] } };
      const targets = ['before', 'target', 'after', 'hidden', 'legacy'].map(id => note(id, id === 'legacy' ? 'Legacy' : id));
      const links = parseIdWikiLinks(body);
      expect(links.map(link => link.noteId)).toEqual(['before', 'target', 'after']);
      for (const link of links) expect(body.slice(link.start, link.end)).toBe(link.raw);
      const visibleIds = (blocks: Block[]): string[] => blocks.flatMap(block => {
        if (block.type === 'code' || block.type === 'math') return [];
        const texts = block.type === 'table'
          ? [...(block.tableHeaders ?? []), ...(block.tableRows ?? []).flat()]
          : [block.content];
        return [...texts.flatMap(text => parseIdWikiLinks(text, 'inline').map(link => link.noteId)), ...visibleIds(block.children)];
      });
      expect(visibleIds(markdownToBlocks(body))).toEqual(links.map(link => link.noteId));
      const full = new KnowledgeIndexService();
      full.buildFromNotes([source, ...targets]);
      const incremental = new KnowledgeIndexService();
      incremental.buildFromNotes([note('source', 'Source'), ...targets]);
      incremental.updateNote(source);
      const pure = buildBacklinkIndex([source, ...targets]);
      for (const target of targets) {
        expect(incremental.getPageReferences(target, [source, ...targets])).toEqual(full.getPageReferences(target, [source, ...targets]));
        expect(getPageReferences(pure, target, [source, ...targets]).incoming).toEqual(full.getIncomingForNote(target.id));
      }
      expect(full.getIncomingForNote('hidden')).toEqual([]);
      expect(full.getOutgoingTargetIds('source')).toEqual(expect.arrayContaining(['before', 'target', 'after', 'legacy']));
      const edges = buildGlobalGraphData({ service: full }).edges.filter(edge => edge.sourceId === 'source');
      expect(edges.filter(edge => edge.relationshipType === 'backlink').map(edge => edge.targetId).sort()).toEqual(['after', 'before', 'legacy', 'target']);
      expect(full.getOutgoingRelations('source').map(edge => edge.targetId)).toEqual(['legacy']);
      expect(extractLinks(body)).toEqual(['Legacy']);
      expect(source.body).toBe(body);
    });
    it.each(['$$\n```\n$$\n', '```md\n$$\n[](absinthe-note:hidden)\n```\n$$\n'])('retains a live-block link after math/code regions: %s', prefix => {
      const raw = serializeIdWikiLink('target');
      const body = prefix + raw;
      expect(parseIdWikiLinks(body, 'inline').map(link => link.noteId)).toEqual(['target']);
      const element = document.createElement('div');
      element.innerHTML = liveInlineHtml(body, colors, [candidate('target', 'Target')]);
      expect(element.querySelector('[data-note-link]')?.getAttribute('data-note-link')).toBe(raw);
      element.innerHTML = renderInlineMarkdownHtml(body, colors, '', [candidate('target', 'Target')]);
      expect(element.querySelector('[data-note-link]')?.textContent).toBe('Target');
    });
  });
  it('keeps full/incremental backlinks and graph edges stable through rename, delete and restore', () => {
    const source = { ...note('source', 'Source', serializeIdWikiLink('target', 'Alias') + ' [[Legacy]]'), relations: { related: ['legacy'] } };
    let target = note('target', 'Old');
    const legacy = note('legacy', 'Legacy');
    const service = new KnowledgeIndexService();
    service.buildFromNotes([source, target, legacy]);
    target = { ...target, title: 'New' };
    service.updateNote(target);
    const full = new KnowledgeIndexService();
    full.buildFromNotes([source, target, legacy]);
    expect(service.getPageReferences(target, [source, target, legacy])).toEqual(full.getPageReferences(target, [source, target, legacy]));
    expect(service.getIncomingForNote('target').map(ref => ref.noteId)).toEqual(['source']);
    const pure = getPageReferences(buildBacklinkIndex([source, target, legacy]), target, [source, target, legacy]);
    expect(pure.incoming).toEqual(service.getIncomingForNote('target'));
    const graph = () => buildGlobalGraphData({ service });
    expect(graph().edges.some(edge => edge.sourceId === 'source' && edge.targetId === 'target')).toBe(true);
    expect(buildNoteNeighborhood(service, 'target', 'New').edges.some(edge => edge.sourceId === 'source' && edge.targetId === 'target')).toBe(true);
    expect(service.getOutgoingRelations('source')[0].targetId).toBe('legacy');
    expect(extractLinkContexts('New', [source, target], { targetNoteId: 'target' })[0].noteId).toBe('source');
    service.removeNote('target');
    expect(graph().edges.some(edge => edge.targetId === 'target')).toBe(false);
    service.updateNote(target);
    expect(service.getIncomingForNote('target').map(ref => ref.noteId)).toEqual(['source']);
    service.updateNote({ ...source, body: '' });
    expect(service.getIncomingForNote('target')).toEqual([]);
    expect(source.body).toContain('absinthe-note:target');
  });
});
