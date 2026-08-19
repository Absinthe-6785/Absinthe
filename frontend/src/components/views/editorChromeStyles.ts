/**
 * editorChromeStyles.ts — Block editor presentation CSS (chrome + reading mode)
 */
import { EDITOR_READING_STYLES } from './editorReading';
import { K123_EDITOR_GUTTER_PX, K123_EDITOR_SHELL_MAX_PX } from '../../lib/k123EditorLayout';

export const K123_EDITOR_LAYOUT_STYLES = `
  .k123-editor-column-shell {
    max-width: ${K123_EDITOR_SHELL_MAX_PX}px;
    margin: 0 auto;
    width: 100%;
    position: relative;
    box-sizing: border-box;
    padding-left: max(12px, env(safe-area-inset-left, 0px));
    padding-right: max(12px, env(safe-area-inset-right, 0px));
    overflow-x: clip;
  }
  .k123-editor-toolbar-shell {
    max-width: ${K123_EDITOR_SHELL_MAX_PX}px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    padding-left: max(12px, env(safe-area-inset-left, 0px));
    padding-right: max(12px, env(safe-area-inset-right, 0px));
  }
  .k123-editor-body-pad {
    padding-top: 12px;
    padding-bottom: 48px;
  }
  @media (min-width: 769px) {
    .k123-editor-body-pad {
      padding-top: 24px;
      padding-bottom: 80px;
    }
  }
`;

export const EDITOR_CHROME_STYLES = `
  .be-block {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    cursor: text;
    min-height: 30px;
  }
  .be-gutter {
    position: relative;
    flex: 0 0 ${K123_EDITOR_GUTTER_PX}px;
    width: ${K123_EDITOR_GUTTER_PX}px;
    margin-left: -${K123_EDITOR_GUTTER_PX}px;
    min-height: 30px;
    z-index: 2;
    pointer-events: auto;
    opacity: 1;
    transition: opacity .12s ease-out;
    touch-action: none;
  }
  .be-block-marker {
    position: absolute;
    left: 7px;
    top: 8px;
    bottom: 8px;
    width: 3px;
    border-radius: 3px;
    background: var(--be-text-muted, #71717A);
    opacity: 0.68;
    transform: scaleX(1);
    transition: opacity .12s ease-out, background .12s ease-out, transform .12s ease-out;
    pointer-events: none;
    z-index: 2;
  }
  .be-editor-nested .be-gutter {
    flex-basis: 44px;
    width: 44px;
    margin-left: -44px;
  }
  .be-gutter-strip {
    position: absolute;
    inset: -6px -10px;
    z-index: 1;
    cursor: cell;
    touch-action: none;
    pointer-events: auto;
  }
  .be-block:hover:not(.be-block-selected):not(.be-block-active):not(.be-dragging) {
    background: var(--be-block-hover-bg, rgba(139, 92, 246, 0.035));
  }
  .be-block:hover > .be-gutter,
  .be-block.be-block-active > .be-gutter,
  .be-block.be-controls-visible > .be-gutter,
  .be-block.be-block-selected > .be-gutter,
  .be-block.be-dragging > .be-gutter,
  .be-editor-root.be-gutter-dragging .be-gutter {
    opacity: 1;
  }
  .be-block:hover > .be-gutter > .be-block-marker,
  .be-block.be-block-active > .be-gutter > .be-block-marker,
  .be-block.be-controls-visible > .be-gutter > .be-block-marker,
  .be-block.be-block-selected > .be-gutter > .be-block-marker,
  .be-block.be-dragging > .be-gutter > .be-block-marker,
  .be-editor-root.be-gutter-dragging .be-block-marker {
    background: var(--be-accent, #8B5CF6);
    opacity: 1;
    transform: scaleX(1.2);
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
    opacity: 0.58;
    visibility: visible;
    pointer-events: auto;
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
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--be-text-muted, #71717A);
    padding: 0;
    transition: opacity .12s, color .12s, background .12s, box-shadow .12s;
  }
  .be-grip { cursor: grab; touch-action: none; }
  .be-grip.be-handle-btn::before {
    content: '';
    position: absolute;
    inset: -8px;
    z-index: -1;
  }
  .be-grip.be-grip-pinned {
    color: var(--be-accent, #8B5CF6);
    background: var(--be-accent-bg, rgba(139,92,246,0.12));
    box-shadow: 0 0 0 1px var(--be-accent, #8B5CF6);
  }
  .be-grip:active { cursor: grabbing; }
  .be-grip.be-drag-rejected {
    animation: be-drag-reject-shake .42s ease-in-out;
    color: var(--be-danger, #ef4444);
  }
  @keyframes be-drag-reject-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-3px); }
    40% { transform: translateX(3px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(2px); }
  }
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
    opacity: 0.55;
  }
  .be-block:hover .be-grip-dot,
  .be-block-active .be-grip-dot,
  .be-block-selected .be-grip-dot {
    opacity: 0.85;
  }
  .be-handle-btn:hover,
  .be-controls-visible .be-handle-btn {
    color: var(--be-accent, #8B5CF6);
  }
  .be-handle-btn:hover .be-grip-dot { opacity: 1; }
  .be-selection-toolbar button {
    width: 40px !important;
    min-width: 40px !important;
    height: 40px !important;
    min-height: 40px !important;
  }
  .be-selection-toolbar button svg {
    width: 16px !important;
    height: 16px !important;
  }
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
  .be-block.be-dragging {
    opacity: 0.4;
  }
  .be-editor-root.be-drag-active,
  .be-editor-root.be-drag-active * {
    user-select: none;
  }
  .be-document {
    max-width: var(--be-doc-width, 720px);
    margin: 0 auto;
    font-family: var(--be-font-family, system-ui, sans-serif);
    font-size: calc(var(--be-font-size, 16px) + 1px);
    line-height: 1.65;
    letter-spacing: -0.005em;
    color: var(--be-text, inherit);
  }
  @media (min-width: 769px) {
    .be-editor-toolbar-btn {
      min-width: 36px !important;
      min-height: 36px !important;
      width: 36px !important;
      height: 36px !important;
    }
    .be-editor-toolbar-btn svg {
      width: 15px !important;
      height: 15px !important;
    }
  }
  .be-document-edit {
    padding-left: ${K123_EDITOR_GUTTER_PX}px;
    padding-right: 16px;
    overflow: visible;
  }
  @media (pointer: coarse) {
    .be-block-active > .be-gutter,
    .be-block.be-block-selected > .be-gutter {
      opacity: 1;
    }
    .be-block.be-block-selected > .be-gutter > .be-handles,
    .be-block.be-controls-visible > .be-gutter > .be-handles {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .be-grip.be-handle-btn::before {
      inset: -12px;
    }
    .be-gutter-strip {
      inset: -8px -14px;
    }
    .be-handle-btn {
      width: 36px;
      height: 36px;
    }
  }
  .be-editable[contenteditable]:empty::before {
    content: none;
    color: var(--be-placeholder-color, #aaa);
    pointer-events: none;
    position: absolute;
    left: 0;
  }
  .be-editable.be-persistent-placeholder[contenteditable]:empty::before {
    content: attr(data-placeholder);
    opacity: 0.55;
  }
  .be-block-active .be-editable[contenteditable]:empty::before,
  .be-editable[contenteditable]:empty:focus::before {
    content: attr(data-placeholder);
    opacity: 1;
  }
  .be-document-bottom-strip {
    min-height: 80px;
    cursor: text;
  }
  [contenteditable] { position: relative; }
  [contenteditable]:focus { outline: none; }
  .be-editable-static {
    user-select: text;
    -webkit-user-select: text;
  }
  .be-content strong { font-weight: 700; }
  .be-content em { font-style: italic; }
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
  .be-toggle-heading-wrap > .be-toggle-header-block {
    border-left: 3px solid var(--be-accent, #6366f1);
    padding-left: 4px;
  }
  .be-toggle-heading-wrap.be-toggle-collapsed > .be-toggle-header-block {
    opacity: 0.92;
  }
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
    padding: 1px 6px;
    font-size: 0.92em;
    font-weight: 500;
    line-height: 1.4;
    vertical-align: baseline;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .be-tag {
    line-height: 1.4;
    vertical-align: baseline;
  }
  .be-tag-chip-ui {
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
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
    background: var(--be-search-hl-bg, rgba(139, 92, 246, 0.22));
    color: var(--be-search-hl-color, inherit);
    border-radius: 2px;
    padding: 0 1px;
    box-shadow: inset 0 -1px 0 rgba(139, 92, 246, 0.28);
  }
  .be-search-hl-current {
    background: var(--be-search-hl-current-bg, rgba(139, 92, 246, 0.55));
    color: var(--be-search-hl-current-color, inherit);
    outline: 2px solid var(--be-accent, #8B5CF6);
    outline-offset: 1px;
    border-radius: 2px;
    font-weight: 600;
  }
  .be-math-display {
    display: block;
    text-align: center;
    padding: 8px 0;
    overflow-x: auto;
    max-width: 100%;
  }
  .be-math-inline .katex,
  .be-math-display .katex {
    color: var(--be-text, inherit);
  }
  .be-math-search-hl {
    background: var(--be-search-hl-bg, #e8e4ff);
    border-radius: 4px;
    padding: 0 2px;
  }
  .be-live-math-display,
  .be-live-math-inline {
    white-space: nowrap;
  }
  .be-selection-toolbar button:active { transform: scale(0.94); }
  .be-block-handle-menu { margin-left: 0; z-index: 5; }
  .be-block-handle-menu::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 0;
    bottom: 0;
    width: 20px;
  }
  /* K-118 — mobile editor + embed overflow */
  .be-editor-root { overflow-x: clip; max-width: 100%; }
  [data-k118-embed-preview] { max-width: 100%; }
  .be-document .be-image-block,
  .be-document [data-block-type="table"],
  .be-document pre,
  .be-document .be-code-block,
  .be-document table {
    max-width: 100%;
  }
  @media (min-width: 769px) {
    .be-document .be-image-block,
    .be-document [data-block-type="table"] {
      max-width: min(100%, calc(var(--be-doc-width, 980px) + 80px));
    }
  }
  @media (pointer: coarse) {
    .be-handle-btn { width: 40px; height: 40px; }
    .be-image-block [data-k108-image-more] { min-height: 48px; min-width: 48px; }
    .be-editor-toolbar { row-gap: 10px; }
  }
  ${K123_EDITOR_LAYOUT_STYLES}
  ${EDITOR_READING_STYLES}
`;
