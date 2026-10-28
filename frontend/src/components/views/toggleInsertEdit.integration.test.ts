// @vitest-environment happy-dom
import React, { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { BlockEditor } from './BlockEditor';
import { EDITOR_CHROME_STYLES } from './editorChromeStyles';
import {
  blocksToMarkdown,
  findBlockById,
  flattenBlockIds,
  makeBlock,
  markdownToBlocks,
  type Block,
} from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const colors: BlockEditorColors = {
  bg: '#fff', text: '#111', textMuted: '#666', textFaint: '#999',
  accent: '#8B5CF6', accentBg: '#eee', border: '#ddd', card: '#fff',
  cardHov: '#f5f5f5', input: '#fff', inputBdr: '#ccc', toolbar: '#f9f9f9',
  danger: '#f00', green: '#0f0', codeBg: '#f1f5f9', calloutBg: '#fafafa',
  toggleBg: 'transparent', quoteBdr: '#ccc', selection: '#eef',
};

let mountedRoot: Root | null = null;

function mountEditor(initialBlocks: Block[]) {
  let current = initialBlocks;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = EDITOR_CHROME_STYLES;
  document.head.appendChild(style);
  const host = document.createElement('div');
  document.body.appendChild(host);

  function StatefulEditor() {
    const [blocks, setBlocks] = useState(initialBlocks);
    const [readOnly, setReadOnly] = useState(false);
    current = blocks;
    return createElement('div', null,
      createElement('button', {
        type: 'button',
        'data-mode-switch': true,
        onClick: () => setReadOnly(value => !value),
      }, 'Switch reading/editing mode'),
      createElement(BlockEditor, {
        blocks, onChange: setBlocks, colors, readOnly, virtualBlocksPoc: false,
      }),
    );
  }

  act(() => {
    mountedRoot = createRoot(host);
    mountedRoot.render(createElement(StatefulEditor));
  });
  return { getBlocks: () => current };
}

function editableFor(blockId: string): HTMLElement {
  return document.querySelector(`[data-block-id="${blockId}"][contenteditable="true"]`) as HTMLElement;
}

function click(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
}

function typeText(blockId: string, text: string) {
  const editable = editableFor(blockId);
  act(() => {
    editable.textContent = text;
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  });
}

async function flushFrame() {
  await act(async () => {
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
  });
}

function convertParagraphToToggle(blockId: string) {
  const editable = editableFor(blockId);
  act(() => editable.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, clientX: 20, clientY: 20,
  })));

  const menu = document.querySelector('.be-block-handle-menu') as HTMLElement;
  const transform = [...menu.querySelectorAll('button')]
    .find(button => button.textContent?.includes('Transform'));
  expect(transform).toBeDefined();
  click(transform!);

  const toggleLabels = new Set(['Toggle', '토글', 'トグル']);
  const toggleOption = [...menu.querySelectorAll('button')]
    .find(button => toggleLabels.has(button.textContent?.trim() ?? ''));
  expect(toggleOption).toBeDefined();
  act(() => toggleOption!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
}

afterEach(() => {
  if (mountedRoot) act(() => mountedRoot?.unmount());
  mountedRoot = null;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('toggle child insertion and editing', () => {
  it('converts a paragraph, inserts and focuses an editable child, and preserves it across modes and Markdown round trips', async () => {
    const { getBlocks } = mountEditor([makeBlock('paragraph', { id: 'source', content: 'Toggle title' })]);

    convertParagraphToToggle('source');
    let toggle = findBlockById(getBlocks(), 'source')!;
    expect(toggle.type).toBe('toggle');
    expect(toggle.content).toBe('Toggle title');

    click(document.querySelector('.be-toggle-empty')!);
    await flushFrame();

    toggle = findBlockById(getBlocks(), 'source')!;
    expect(toggle.children).toHaveLength(1);
    const insertedId = toggle.children[0].id;
    const insertedEditor = editableFor(insertedId);
    expect(insertedEditor).not.toBeNull();
    expect(document.activeElement).toBe(insertedEditor);

    typeText(insertedId, 'Typed inside toggle');
    expect(findBlockById(getBlocks(), 'source')!.children[0].content).toBe('Typed inside toggle');

    click(document.querySelector('[data-mode-switch]')!);
    expect(document.querySelector(`[data-block-id="${insertedId}"][contenteditable="true"]`)).toBeNull();
    expect(document.body.textContent).toContain('Typed inside toggle');
    click(document.querySelector('[data-mode-switch]')!);
    expect(editableFor(insertedId).textContent).toBe('Typed inside toggle');

    const markdown = blocksToMarkdown(getBlocks());
    const reparsed = markdownToBlocks(markdown);
    expect(reparsed[0].content).toBe('Toggle title');
    expect(reparsed[0].children[0].content).toBe('Typed inside toggle');
    expect(blocksToMarkdown(reparsed)).toBe(markdown);
    expect(flattenBlockIds(getBlocks()).filter(id => id === insertedId)).toHaveLength(1);
  });

  it('appends an editable child without replacing existing nested content', async () => {
    const existing = makeBlock('paragraph', { id: 'existing', content: 'Existing child' });
    const nestedChild = makeBlock('paragraph', { id: 'nested-child', content: 'Nested content' });
    const nested = makeBlock('toggle', { id: 'nested', content: 'Nested toggle', children: [nestedChild] });
    const { getBlocks } = mountEditor([
      makeBlock('toggle', { id: 'parent', content: 'Parent', children: [existing, nested] }),
    ]);

    click(document.querySelector('[data-toggle-add-child="parent"]')!);
    await flushFrame();

    const parent = findBlockById(getBlocks(), 'parent')!;
    expect(parent.children).toHaveLength(3);
    expect(parent.children.slice(0, 2).map(child => child.id)).toEqual(['existing', 'nested']);
    const inserted = parent.children[2];
    expect(document.activeElement).toBe(editableFor(inserted.id));
    typeText(inserted.id, 'New trailing content');

    const updated = findBlockById(getBlocks(), 'parent')!;
    expect(updated.children[0]).toMatchObject({ id: 'existing', content: 'Existing child' });
    expect(updated.children[1].children[0]).toMatchObject({ id: 'nested-child', content: 'Nested content' });
    expect(updated.children[2]).toMatchObject({ id: inserted.id, content: 'New trailing content' });
    expect(new Set(flattenBlockIds(getBlocks())).size).toBe(flattenBlockIds(getBlocks()).length);
  });

  it('allows the visible add-content control on toggle-heading blocks', async () => {
    const { getBlocks } = mountEditor([
      makeBlock('toggleHeading2', {
        id: 'heading-toggle', content: 'Section', children: [makeBlock('paragraph', { id: 'kept', content: 'Keep me' })],
      }),
    ]);

    click(document.querySelector('[data-toggle-add-child="heading-toggle"]')!);
    await flushFrame();

    const toggle = findBlockById(getBlocks(), 'heading-toggle')!;
    expect(toggle.type).toBe('toggleHeading2');
    expect(toggle.children).toHaveLength(2);
    expect(toggle.children[0]).toMatchObject({ id: 'kept', content: 'Keep me' });
    const inserted = toggle.children[1];
    expect(document.activeElement).toBe(editableFor(inserted.id));
    typeText(inserted.id, 'Heading child');
    expect(findBlockById(getBlocks(), 'heading-toggle')!.children[1].content).toBe('Heading child');

    const markdown = blocksToMarkdown(getBlocks());
    const reparsed = markdownToBlocks(markdown);
    expect(reparsed[0].type).toBe('toggleHeading2');
    expect(reparsed[0].children[1].content).toBe('Heading child');
    expect(blocksToMarkdown(reparsed)).toBe(markdown);
  });
});
