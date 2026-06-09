import { describe, expect, it } from 'vitest';
import {
  TURN_INTO_TYPES,
  SLASH_PINNED_TYPES,
  filterBlockMenu,
  makeBlock,
  convertBlock,
  markdownToBlocks,
} from './blockUtils';
import { applyDragDrop } from './blockTree';
import { applyToggleChildEnter } from './toggleNesting';
import {
  exitEmptyListBlock,
  listSplitExtras,
  renumberNumberedLists,
  blockLayoutIndentPx,
} from './listBlocks';
import {
  adaptPastedBlocks,
  applyPasteAtBlock,
  extractClipboardText,
  normalizePasteText,
  smartInlineMerge,
} from './features/block-editor/features/clipboard';

describe('F-0 list Enter regression', () => {
  it('empty numbered item exits and clears listIndex', () => {
    const b = makeBlock('numbered', { id: 'n', content: '', listIndex: 3 });
    const next = exitEmptyListBlock([b], 'n');
    expect(next[0].type).toBe('paragraph');
    expect(next[0].listIndex).toBeUndefined();
  });

  it('renumberNumberedLists after exit restarts groups separated by paragraph', () => {
    const blocks = [
      makeBlock('numbered', { id: 'a', content: 'one' }),
      makeBlock('numbered', { id: 'b', content: '' }),
      makeBlock('numbered', { id: 'c', content: 'three' }),
    ];
    const exited = exitEmptyListBlock(blocks, 'b');
    expect(exited[1].type).toBe('paragraph');
    const renumbered = renumberNumberedLists(exited);
    expect(renumbered.filter(b => b.type === 'numbered').map(b => b.listIndex)).toEqual([1, 1]);
  });

  it('listSplitExtras does not set listIndex for bullet', () => {
    const cur = makeBlock('bullet', { indent: 1 });
    expect(listSplitExtras(cur, 'bullet').listIndex).toBeUndefined();
    expect(listSplitExtras(cur, 'bullet').indent).toBe(1);
  });
});

describe('F-0 paste intelligence regression', () => {
  it('smartInlineMerge creates markdown link from URL + selection', () => {
    const { content } = smartInlineMerge('see ', 'docs', 'https://a.com', '');
    expect(content).toBe('see [docs](https://a.com)');
  });

  it('adaptPastedBlocks preserves structured heading paste', () => {
    const parsed = [makeBlock('paragraph', { content: '# Title' })];
    const adapted = adaptPastedBlocks(parsed, { blockType: 'bullet', indent: 0 });
    expect(adapted[0].type).toBe('paragraph');
  });

  it('applyPasteAtBlock returns null for empty paste after normalize', () => {
    const b = makeBlock('paragraph', { id: 'x', content: 'hi' });
    expect(applyPasteAtBlock([b], 'x', 0, 0, '\n')).toBeNull();
  });

  it('normalizePasteText keeps internal newlines', () => {
    expect(normalizePasteText('a\nb\n')).toBe('a\nb');
  });

  it('extractClipboardText prefers plain text', () => {
    const dt = {
      getData: (type: string) => {
        if (type === 'text/plain') return 'plain';
        if (type === 'text/html') return '<p>html</p>';
        return '';
      },
    };
    expect(extractClipboardText(dt)).toBe('plain');
  });

  it('multiline markdown paste into paragraph creates bullets', () => {
    const b = makeBlock('paragraph', { id: 'x', content: '' });
    const result = applyPasteAtBlock([b], 'x', 0, 0, '- one\n- two');
    expect(result?.blocks).toHaveLength(2);
    expect(result?.blocks.every(bl => bl.type === 'bullet')).toBe(true);
  });
});

describe('F-0 menu & document regression', () => {
  it('TURN_INTO_TYPES includes list blocks', () => {
    expect(TURN_INTO_TYPES).toContain('bullet');
    expect(TURN_INTO_TYPES).toContain('numbered');
  });

  it('SLASH_PINNED_TYPES includes bullet and numbered', () => {
    expect(SLASH_PINNED_TYPES).toContain('bullet');
    expect(SLASH_PINNED_TYPES).toContain('numbered');
  });

  it('filterBlockMenu list alias matches list types', () => {
    const types = filterBlockMenu('list').map(m => m.type);
    expect(types).toContain('bullet');
    expect(types).toContain('numbered');
    expect(types).toContain('todo');
  });

  it('convertBlock preserves content when changing type', () => {
    const b = makeBlock('bullet', { content: 'item', indent: 1 });
    const next = convertBlock(b, 'paragraph');
    expect(next.content).toBe('item');
    expect(next.type).toBe('paragraph');
  });
});

describe('F-0 drag regression', () => {
  it('applyDragDrop inserts before target', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const c = makeBlock('paragraph', { id: 'c', content: 'C' });
    const next = applyDragDrop([a, b, c], 'c', 'a', 'before');
    expect(next!.map(x => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('applyDragDrop returns null when dragging onto self', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    expect(applyDragDrop([a], 'a', 'a', 'before')).toBeNull();
  });

  it('applyDragDrop inside drop uncollapses toggle', () => {
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [], collapsed: true });
    const para = makeBlock('paragraph', { id: 'p', content: 'P' });
    const next = applyDragDrop([toggle, para], 'p', 't', 'inside');
    expect(next![0].collapsed).toBe(false);
    expect(next![0].children[0].id).toBe('p');
  });
});

describe('F-0 layout regression', () => {
  it('blockLayoutIndentPx is zero for top-level paragraph', () => {
    expect(blockLayoutIndentPx(makeBlock('paragraph'), 0)).toBe(0);
  });

  it('blockLayoutIndentPx adds depth and list indent', () => {
    const b = makeBlock('numbered', { indent: 1 });
    expect(blockLayoutIndentPx(b, 2)).toBe(64);
  });
});

describe('F-0 toggle nesting regression', () => {
  it('toggle child empty Enter at start escapes below when allowed', () => {
    const child = makeBlock('paragraph', { id: 'c1', content: '' });
    const result = applyToggleChildEnter([child], 'c1', '', '', true);
    expect(result.action).toBe('escape_below');
  });

  it('markdownToBlocks parses toggle with children', () => {
    const blocks = markdownToBlocks('> Parent\n  child line');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].children.length).toBeGreaterThan(0);
  });
});
