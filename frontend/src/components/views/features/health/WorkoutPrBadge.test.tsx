import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getTranslator } from '../../../../lib/i18n';
import { WorkoutPrBadge } from './WorkoutPrBadge';

const badgeCopy = (lang: 'en' | 'ko' | 'ja') => {
  const t = getTranslator(lang);
  return {
    legacyScopeLabel: t('healthWorkoutBadgeLegacyScope'),
    prDescription: t('healthWorkoutBadgePrDescription'),
    diffDescription: t('healthWorkoutBadgeDiffDescription'),
  };
};

describe('WorkoutPrBadge comparison scope', () => {
  it.each([
    ['en', 'LEGACY', 'current-workout draft', 'latest selected prior legacy row'],
    ['ko', '구형 기록', '현재 운동 초안', '선택된 가장 최근 구형 기록 행'],
    ['ja', '旧記録', '現在のワークアウト草案', '選択された最新の旧記録行'],
  ] as const)('localizes the qualifier and scope explanation in %s', (lang, label, prPhrase, diffPhrase) => {
    const copy = badgeCopy(lang);
    const html = renderToStaticMarkup(createElement(WorkoutPrBadge, {
      badge: { isPR: true, diff: 5, prevMax: 100, showDiff: false, unit: 'kg' },
      darkMode: true,
      ...copy,
    }));
    expect(html).toContain(label);
    expect(html).toContain('PR 🏆');
    expect(copy.prDescription).toContain(prPhrase);
    expect(copy.diffDescription).toContain(diffPhrase);
  });

  it('describes a PR as current draft versus the legacy threshold, not an all-source record', () => {
    const copy = badgeCopy('en');
    const html = renderToStaticMarkup(createElement(WorkoutPrBadge, {
      badge: { isPR: true, diff: 5, prevMax: 100, showDiff: false, unit: 'kg' },
      darkMode: false,
      ...copy,
    }));
    expect(html).toContain('title="This current-workout draft exceeds the legacy historical PR threshold. It is not a verified all-source personal record."');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('>PR 🏆</span>');
  });

  it('describes the difference against the selected prior legacy row and preserves its numeric value', () => {
    const html = renderToStaticMarkup(createElement(WorkoutPrBadge, {
      badge: { isPR: false, diff: -2.5, prevMax: 102.5, showDiff: true, unit: 'kg' },
      darkMode: true,
      ...badgeCopy('ko'),
    }));
    expect(html).toContain('-2.5kg');
    expect(html).toContain('현재 운동 초안과 선택된 가장 최근 구형 기록 행의 차이입니다.');
    expect(html).toContain('LEGACY');
  });

  it('renders no badge when the existing calculation supplies null', () => {
    expect(renderToStaticMarkup(createElement(WorkoutPrBadge, {
      badge: null,
      darkMode: false,
      ...badgeCopy('en'),
    }))).toBe('');
  });
});
