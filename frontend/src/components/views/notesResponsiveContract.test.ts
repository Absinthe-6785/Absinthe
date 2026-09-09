// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { classifyViewportWidth, VIEWPORT_MEDIA_QUERIES } from '../../lib/responsiveLayout';
import { EDITOR_CHROME_STYLES, K123_EDITOR_LAYOUT_STYLES } from './editorChromeStyles';
import { EDITOR_READING_STYLES } from './editorReading';
import { buildNoteViewStyles } from './noteview/useNoteViewStyles';
import type { NoteChromeColors } from './noteEditorTheme';

const colors = new Proxy({}, { get: () => '#000000' }) as NoteChromeColors;

function mediaConditions(css: string): string[] {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const conditions = Array.from(style.sheet?.cssRules ?? [])
    .filter((rule): rule is CSSMediaRule => 'conditionText' in rule)
    .map(rule => rule.conditionText);
  style.remove();
  return conditions;
}

describe('Notes semantic responsive contract', () => {
  it.each([
    [767, 'mobile'],
    [768, 'tablet'],
    [769, 'tablet'],
  ] as const)('uses the shared semantic category at %ipx', (width, category) => {
    expect(classifyViewportWidth(width)).toBe(category);
  });

  it('derives Notes mobile and tablet-up CSS from the shared authority', () => {
    const noteStyles = buildNoteViewStyles(colors, false);
    expect(mediaConditions(noteStyles)).toContain(VIEWPORT_MEDIA_QUERIES.mobile);
    expect(mediaConditions(EDITOR_READING_STYLES)).toContain(VIEWPORT_MEDIA_QUERIES.mobile);
    expect(mediaConditions(K123_EDITOR_LAYOUT_STYLES)).toContain(VIEWPORT_MEDIA_QUERIES.tabletUp);
    expect(mediaConditions(EDITOR_CHROME_STYLES)).toContain(VIEWPORT_MEDIA_QUERIES.tabletUp);
    expect(noteStyles).not.toContain('@media (max-width: 768px)');
    expect(EDITOR_CHROME_STYLES).not.toContain('@media (min-width: 769px)');
  });
});
