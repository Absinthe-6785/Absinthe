import { describe, expect, it } from 'vitest';
import { makeBlock } from './blockUtils';
import { filterBlockMenu } from './blockUtils';
import { resolveSlashCommand } from './slashCommands';
import { insertNewlineInBlock, splitBlockContent } from './blockContent';
import { selectionHasFormat } from './inlineFormat';
import { applyToggleChildEnter, applyToggleHeaderEnter } from './toggleNesting';
import { indentBlock, outdentBlock } from './blockTree';
import { canMoveIntoPreviousToggle, isInsideToggle } from './blockTree';

describe('Slash Command regression', () => {
  it('filterBlockMenu resolves exact /h1', () => {
    expect(filterBlockMenu('h1').map(m => m.type)).toEqual(['heading1']);
  });

  it('filterBlockMenu prefix /to matches todo and toggle', () => {
    const types = filterBlockMenu('to').map(m => m.type);
    expect(types).toContain('todo');
    expect(types).toContain('toggle');
  });

  it.each(['h1', 'todo', 'code', 'math', 'divider'])('resolveSlashCommand(%s)', cmd => {
    expect(resolveSlashCommand(cmd)).not.toBeNull();
  });
});

describe('Enter / Shift+Enter regression', () => {
  it('Shift+Enter inserts newline at caret', () => {
    const { content, caret } = insertNewlineInBlock('line', 4);
    expect(content).toBe('line\n');
    expect(caret).toBe(5);
  });

  it('Enter splits block content', () => {
    const { before, after } = splitBlockContent('hello world', 5);
    expect(before).toBe('hello');
    expect(after).toBe(' world');
  });

  it('toggle child Enter splits inside children', () => {
    const children = [makeBlock('paragraph', { id: 'c1', content: 'line 1' })];
    const result = applyToggleChildEnter(children, 'c1', 'line 1', '', true);
    expect(result.action).toBe('split');
  });

  it('toggle header Enter appends child', () => {
    const { children, focusBlockId } = applyToggleHeaderEnter([]);
    expect(children).toHaveLength(1);
    expect(focusBlockId).toBe(children[0].id);
  });
});

describe('inline format + Enter regression', () => {
  it('bold selection detected', () => {
    expect(selectionHasFormat('**bold**', 2, 6, '**', '**')).toBe(true);
  });

  it('italic selection detected', () => {
    expect(selectionHasFormat('*italic*', 1, 7, '*', '*')).toBe(true);
  });

  it('bold+italic nested', () => {
    expect(selectionHasFormat('***both***', 3, 7, '**', '**')).toBe(true);
  });

  it('wiki link format', () => {
    expect(selectionHasFormat('[[Note]]', 2, 6, '[[', ']]')).toBe(true);
  });

  it('code format', () => {
    expect(selectionHasFormat('`code`', 1, 5, '`', '`')).toBe(true);
  });
});

describe('toggle structure menu regression', () => {
  it('indent nests under previous sibling', () => {
    const a = makeBlock('paragraph', { id: 'a', content: 'A' });
    const b = makeBlock('paragraph', { id: 'b', content: 'B' });
    const next = indentBlock([a, b], 'b');
    expect(next![0].type).toBe('toggle');
    expect(next![0].children[0].id).toBe('b');
  });

  it('outdent exits toggle child', () => {
    const child = makeBlock('paragraph', { id: 'c', content: 'c' });
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [child] });
    const next = outdentBlock([toggle], 'c');
    expect(next!.map(b => b.id)).toEqual(['t', 'c']);
  });

  it('canMoveIntoPreviousToggle when prev is toggle', () => {
    const t = makeBlock('toggle', { id: 't', content: 'T', children: [] });
    const p = makeBlock('paragraph', { id: 'p', content: 'P' });
    expect(canMoveIntoPreviousToggle([t, p], 'p')).toBe(true);
  });

  it('isInsideToggle for toggle child', () => {
    const child = makeBlock('paragraph', { id: 'c', content: '' });
    const toggle = makeBlock('toggle', { id: 't', content: 'T', children: [child] });
    expect(isInsideToggle([toggle], 'c')).toBe(true);
  });
});
