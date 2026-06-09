// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { htmlDocumentToBlocks } from './htmlDocumentToBlocks';
import { clipboardToBlocks } from './pasteOrchestrator';

const EDIT_MODE_TOGGLE_HTML = `<meta charset='utf-8'>
<div class="be-toggle-wrap">
  <div class="be-toggle-header-block be-block">
    <div class="be-content">
      <div style="display:flex;gap:6px">
        <button type="button" aria-label="접기"></button>
        <span class="be-editable" style="font-weight:600">Grammar Module</span>
      </div>
    </div>
  </div>
  <div class="be-toggle-children be-toggle-drop" data-toggle-id="t1">
    <div class="be-block">
      <div class="be-content">
        <h2 class="be-editable">Particles</h2>
      </div>
    </div>
    <div class="be-block">
      <div class="be-content">
        <div style="display:flex;gap:8px">
          <span>•</span>
          <span class="be-editable">は vs が</span>
        </div>
      </div>
    </div>
  </div>
</div>`;

const READING_MODE_TOGGLE_HTML = `<div class="be-toggle-wrap">
  <div class="be-toggle-header-block be-block">
    <div class="be-content">
      <span class="be-block-text" data-block-type="toggle">Toggle title</span>
    </div>
  </div>
  <div class="be-toggle-children">
    <div class="be-block">
      <div class="be-content">
        <p class="be-block-text" data-block-type="paragraph">Inside paragraph</p>
      </div>
    </div>
  </div>
</div>`;

function mockClipboard(html: string, plain = '') {
  return { getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? plain : '') };
}

describe('domToggleParser / be-toggle-wrap recovery (UX-5B.1)', () => {
  it('recovers toggle from edit-mode DOM clipboard HTML', () => {
    const blocks = htmlDocumentToBlocks(EDIT_MODE_TOGGLE_HTML)!;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].content).toBe('Grammar Module');
    expect(blocks[0].children.map(c => c.type)).toEqual(['heading2', 'bullet']);
    expect(blocks[0].children[1].content).toBe('は vs が');
  });

  it('recovers toggle via clipboardToBlocks orchestrator', () => {
    const blocks = clipboardToBlocks(mockClipboard(EDIT_MODE_TOGGLE_HTML, 'Grammar Module'))!;
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].children).toHaveLength(2);
  });

  it('recovers toggle from reading-mode DOM with data-block-type attrs', () => {
    const blocks = htmlDocumentToBlocks(READING_MODE_TOGGLE_HTML)!;
    expect(blocks[0].type).toBe('toggle');
    expect(blocks[0].content).toBe('Toggle title');
    expect(blocks[0].children[0].type).toBe('paragraph');
    expect(blocks[0].children[0].content).toBe('Inside paragraph');
  });
});
