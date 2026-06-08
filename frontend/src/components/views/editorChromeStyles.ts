/**
 * editorChromeStyles.ts — Block editor presentation CSS (chrome + reading mode)
 */
import { EDITOR_READING_STYLES } from './editorReading';

export const EDITOR_CHROME_STYLES = `
  .be-block {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    cursor: text;
    min-height: 28px;
  }
  .be-gutter {
    position: relative;
    flex: 0 0 44px;
    width: 44px;
    margin-left: -44px;
    min-height: 28px;
    z-index: 2;
    pointer-events: auto;
    opacity: 0;
    transition: opacity .12s;
    touch-action: none;
  }
  .be-editor-nested .be-gutter {
    flex-basis: 40px;
    width: 40px;
    margin-left: -40px;
  }
  .be-gutter-strip {
    position: absolute;
    inset: 0;
    z-index: 1;
    cursor: default;
    touch-action: none;
    pointer-events: auto;
  }
  .be-block:hover > .be-gutter,
  .be-block.be-block-active > .be-gutter,
  .be-block.be-controls-visible > .be-gutter,
  .be-block.be-block-selected > .be-gutter,
  .be-block.be-dragging > .be-gutter,
  .be-editor-root.be-gutter-dragging .be-gutter {
    opacity: 1;
  }
  .be-editor-root.be-gutter-dragging {
    user-select: none;
    cursor: default;
  }
  .be-content {
    flex: 1;
    min-width: 0;
    position: relative;
  }
  .be-handles {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity .12s, visibility .12s;
    z-index: 3;
  }
  .be-block:hover > .be-gutter > .be-handles,
  .be-block.be-block-active > .be-gutter > .be-handles,
  .be-block.be-controls-visible > .be-gutter > .be-handles,
  .be-block.be-dragging > .be-gutter > .be-handles,
  .be-gutter:hover > .be-handles,
  .be-handles:hover {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
  }
  .be-handle-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--be-text-muted, #71717A);
    padding: 0;
    transition: opacity .12s, color .12s;
  }
  .be-grip { cursor: grab; touch-action: none; }
  .be-grip:active { cursor: grabbing; }
  .be-grip-icon {
    display: grid;
    grid-template-columns: repeat(2, 3px);
    gap: 2px 3px;
  }
  .be-grip-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.45;
  }
  .be-handle-btn:hover,
  .be-controls-visible .be-handle-btn {
    background: transparent;
    color: var(--be-accent, #8B5CF6);
  }
  .be-handle-btn:hover .be-grip-dot { opacity: 0.85; }
  .be-block-selected {
    background: var(--be-block-selected-bg, rgba(139,92,246,0.05));
  }
  .be-block-selected:not(.be-toggle-header-block)::after {
    content: '';
    position: absolute;
    left: -10px;
    top: 3px;
    bottom: 3px;
    width: 2px;
    border-radius: 2px;
    background: var(--be-accent, #8B5CF6);
    opacity: 0.35;
    pointer-events: none;
  }
  .be-block-active {
    scroll-margin: 80px;
    background: var(--be-block-active-bg, transparent);
  }
  .be-block-active.be-block-selected {
    background: var(--be-block-active-selected-bg, rgba(139,92,246,0.08));
  }
  .be-block-active:not(.be-toggle-header-block) > .be-gutter::before {
    content: '';
    position: absolute;
    right: 6px;
    top: 3px;
    bottom: 3px;
    width: 2px;
    border-radius: 2px;
    background: var(--be-accent, #8B5CF6);
    opacity: 0.55;
    pointer-events: none;
    z-index: 0;
  }
  .be-block-active.be-block-selected:not(.be-toggle-header-block) > .be-gutter::before {
    opacity: 0.7;
  }
  .be-block.be-dragging {
    opacity: 0.4;
  }
  .be-document {
    max-width: var(--be-doc-width, 720px);
    margin: 0 auto;
    font-family: var(--be-font-family, system-ui, sans-serif);
    font-size: var(--be-font-size, 16px);
    color: var(--be-text, inherit);
  }
  .be-document-edit {
    padding-left: 40px;
  }
  .be-editable[contenteditable]:empty::before {
    content: none;
    color: var(--be-placeholder-color, #aaa);
    pointer-events: none;
    position: absolute;
    left: 0;
  }
  .be-block-active .be-editable[contenteditable]:empty::before,
  .be-editable[contenteditable]:empty:focus::before {
    content: attr(data-placeholder);
  }
  [contenteditable] { position: relative; }
  [contenteditable]:focus { outline: none; }
  .be-toggle-wrap {
    margin: 4px 0;
    position: relative;
  }
  .be-toggle-header-block { margin-left: 0 !important; }
  .be-toggle-children {
    margin-left: 10px;
    margin-top: 2px;
    padding: 4px 0 6px 14px;
    border-left: 2px solid var(--be-toggle-rail, rgba(139,92,246,0.18));
    border-radius: 0 0 0 6px;
    background: var(--be-toggle-bg, transparent);
    transition: border-color .15s, background .15s;
  }
  .be-toggle-children:hover {
    background: var(--be-toggle-hover-bg, rgba(139,92,246,0.05));
  }
  .be-toggle-wrap.be-toggle-collapsed > .be-toggle-header-block {
    border-left: 2px solid var(--be-toggle-rail-collapsed, var(--be-toggle-rail, rgba(139,92,246,0.24)));
    padding-left: 8px;
    margin-left: 0;
  }
  .be-toggle-wrap.be-toggle-drop-active > .be-toggle-children,
  .be-toggle-children.be-toggle-drop-active {
    border-left-color: var(--be-accent, #8B5CF6);
    background: var(--be-accent-bg, rgba(139,92,246,0.08));
  }
  .be-toggle-wrap.be-toggle-collapsed.be-toggle-drop-active > .be-toggle-header-block {
    border-radius: 6px;
    outline: 2px dashed var(--be-accent, #8B5CF6);
    outline-offset: 2px;
    background: var(--be-accent-bg, rgba(139,92,246,0.08));
  }
  .be-toggle-empty {
    color: var(--be-placeholder-color, #aaa);
    font-size: 13px;
    padding: 6px 4px;
    cursor: text;
    user-select: none;
    border-radius: 4px;
  }
  .be-toggle-empty:hover { opacity: 0.85; background: var(--be-accent-bg, rgba(139,92,246,0.06)); }
  .be-toggle-wrap .be-block { margin-left: 0 !important; }
  .be-drop-line { animation: be-drop-pulse .9s ease-in-out infinite alternate; }
  .be-drop-dot { animation: be-drop-pulse .9s ease-in-out infinite alternate; }
  @keyframes be-drop-pulse {
    from { opacity: 0.75; }
    to { opacity: 1; }
  }
  .be-mark {
    opacity: 0.35;
    font-size: 0.82em;
    font-weight: 400;
    user-select: none;
    pointer-events: none;
  }
  .be-wiki-chip {
    display: inline;
    color: var(--be-link, var(--be-accent, #8B5CF6));
    background: var(--be-accent-bg, rgba(139,92,246,0.08));
    border-radius: 4px;
    padding: 0 2px;
  }
  .be-wiki-chip .be-bracket { opacity: 0.4; font-size: 0.85em; }
  .be-wiki-chip-broken { opacity: 0.75; font-style: italic; }
  .be-tag-chip {
    display: inline;
    color: var(--be-accent, #8B5CF6);
    background: var(--be-accent-bg, rgba(139,92,246,0.08));
    border-radius: 999px;
    padding: 0 6px;
    font-size: 0.92em;
    font-weight: 500;
  }
  .be-live-code {
    background: var(--be-code-bg, #f1f5f9);
    color: var(--be-accent, #8B5CF6);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.88em;
    font-family: ui-monospace, monospace;
  }
  .be-live-mark {
    background: var(--be-accent-bg, #eef2ff);
    color: var(--be-accent, #8B5CF6);
    border-radius: 3px;
    padding: 0 2px;
  }
  .be-search-hl {
    background: var(--be-search-hl-bg, #e8e4ff);
    color: var(--be-search-hl-color, inherit);
    border-radius: 2px;
  }
  .be-selection-toolbar button:active { transform: scale(0.94); }
  .be-block-handle-menu { margin-left: -4px; }
  .be-block-handle-menu::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 0;
    bottom: 0;
    width: 16px;
  }
  ${EDITOR_READING_STYLES}
`;
