// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  EDITOR_DOCUMENT_SEARCH_ATTR,
  SIDEBAR_NOTE_SEARCH_ATTR,
  isEditorDocumentSearchFocused,
  isFocusInFormControl,
  isFormControlElement,
  isSidebarNoteSearchFocused,
  shouldSuppressEditorKeyboardShortcuts,
} from './searchFocusIsolation';

describe('searchFocusIsolation', () => {
  let input: HTMLInputElement;
  let editable: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    input = document.createElement('input');
    input.setAttribute(EDITOR_DOCUMENT_SEARCH_ATTR, '');
    document.body.appendChild(input);

    editable = document.createElement('div');
    editable.className = 'be-editable';
    editable.contentEditable = 'true';
    editable.textContent = 'note body';
    document.body.appendChild(editable);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('detects form controls', () => {
    expect(isFormControlElement(input)).toBe(true);
    expect(isFormControlElement(editable)).toBe(true);
    expect(isFormControlElement(document.createElement('div'))).toBe(false);
  });

  it('detects find-in-note search focus', () => {
    input.focus();
    expect(isEditorDocumentSearchFocused()).toBe(true);
    expect(isFocusInFormControl()).toBe(true);
    expect(shouldSuppressEditorKeyboardShortcuts()).toBe(true);
  });

  it('detects sidebar note search focus', () => {
    const sidebarInput = document.createElement('input');
    sidebarInput.setAttribute(SIDEBAR_NOTE_SEARCH_ATTR, '');
    document.body.appendChild(sidebarInput);
    sidebarInput.focus();
    expect(isSidebarNoteSearchFocused()).toBe(true);
    expect(isEditorDocumentSearchFocused()).toBe(false);
  });

  it('returns false when editor contenteditable is focused', () => {
    editable.focus();
    expect(isEditorDocumentSearchFocused()).toBe(false);
    expect(isFocusInFormControl()).toBe(true);
  });

  it('returns false when nothing is focused', () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    expect(isEditorDocumentSearchFocused()).toBe(false);
    expect(shouldSuppressEditorKeyboardShortcuts()).toBe(false);
  });
});
