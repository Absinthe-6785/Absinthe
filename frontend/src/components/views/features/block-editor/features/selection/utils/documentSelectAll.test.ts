// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  handleSelectAllKeydown,
  isFocusInEditableText,
  selectAllDocumentContent,
} from './documentSelectAll';

describe('documentSelectAll', () => {
  it('isFocusInEditableText detects input and contenteditable', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(isFocusInEditableText()).toBe(true);
    input.remove();
  });

  it('selectAllDocumentContent selects root contents', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello</p><p>World</p>';
    document.body.appendChild(root);
    expect(selectAllDocumentContent(root)).toBe(true);
    const sel = window.getSelection();
    expect(sel?.toString()).toContain('Hello');
    expect(sel?.toString()).toContain('World');
    sel?.removeAllRanges();
    root.remove();
  });

  it('handleSelectAllKeydown returns false when focus is in editable', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const root = document.createElement('div');
    let prevented = false;
    const handled = handleSelectAllKeydown({
      key: 'a',
      ctrlKey: true,
      metaKey: false,
      preventDefault: () => { prevented = true; },
    }, root);
    expect(handled).toBe(false);
    expect(prevented).toBe(false);
    input.remove();
  });

  it('handleSelectAllKeydown selects document when focus is outside editable', () => {
    const root = document.createElement('div');
    root.textContent = 'Document text';
    document.body.appendChild(root);
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.focus();
    let prevented = false;
    const handled = handleSelectAllKeydown({
      key: 'a',
      ctrlKey: true,
      metaKey: false,
      preventDefault: () => { prevented = true; },
    }, root);
    expect(handled).toBe(true);
    expect(prevented).toBe(true);
    expect(window.getSelection()?.toString()).toBe('Document text');
    window.getSelection()?.removeAllRanges();
    root.remove();
    btn.remove();
  });
});
