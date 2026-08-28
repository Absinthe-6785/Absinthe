// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enLocaleValues from './i18n/en';
import koLocaleValues from './i18n/ko';
import jaLocaleValues from './i18n/ja';
import translationKeys, { buildLocaleDictionary } from './i18n/keys';
import type { TranslationKey } from './i18n';

const PLANNER_STORAGE_KEY = 'planner-storage';
const EXPECTED_KEY_COUNT = 2_030;
const enTranslations = buildLocaleDictionary(enLocaleValues);
const koTranslations = buildLocaleDictionary(koLocaleValues);
const jaTranslations = buildLocaleDictionary(jaLocaleValues);

function persistLanguage(language: unknown) {
  localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({
    state: { appSettings: { language } },
    version: 5,
  }));
}

async function loadFreshI18n(language?: unknown) {
  vi.resetModules();
  localStorage.clear();
  if (arguments.length > 0) persistLanguage(language);
  const i18n = await import('./i18n');
  const store = await import('../store/useAppStore');
  return { i18n, store };
}

describe('i18n locale dictionaries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps all locale key sets exactly aligned', () => {
    const expected = Object.keys(enTranslations).sort();
    expect(expected).toEqual([...translationKeys].sort());

    for (const [locale, dictionary] of [
      ['en', enTranslations],
      ['ko', koTranslations],
      ['ja', jaTranslations],
    ] as const) {
      const actual = Object.keys(dictionary).sort();
      const missing = expected.filter(key => !actual.includes(key));
      const extra = actual.filter(key => !expected.includes(key));
      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
      expect(Object.keys(dictionary)).toHaveLength(EXPECTED_KEY_COUNT);
      expect(Object.values(dictionary).every(value => typeof value === 'string')).toBe(true);
    }
  });

  it('preserves representative values and placeholder strings', async () => {
    const { i18n } = await loadFreshI18n();
    expect(i18n.getTranslator('en')('save')).toBe(enTranslations.save);
    expect(i18n.getTranslator('ko')('healthNavWorkout')).toBe(koTranslations.healthNavWorkout);
    expect(i18n.getTranslator('ja')('archiveHomeTitle')).toBe(jaTranslations.archiveHomeTitle);
    expect(enTranslations.k102DaysAgo).toBe('{count} days ago');
    expect(koTranslations.k102DaysAgo).toBe('{count}일 전');
    expect(jaTranslations.k102DaysAgo).toBe('{count}日前');
  });

  it('resolves every extracted locale value through the public translator', async () => {
    const { i18n } = await loadFreshI18n();
    for (const [language, dictionary] of [
      ['en', enTranslations],
      ['ko', koTranslations],
      ['ja', jaTranslations],
    ] as const) {
      const translate = i18n.getTranslator(language);
      for (const key of translationKeys) {
        expect(translate(key)).toBe(dictionary[key]);
      }
    }
  });

  it('hydrates the default locale before normal rendering when no locale is persisted', async () => {
    const { store } = await loadFreshI18n();
    expect(store.useAppStore.getState().appSettings.language).toBe('ko');
  });

  it.each([
    ['en', 'Save'],
    ['ja', '保存'],
  ] as const)('hydrates persisted %s before normal rendering', async (language, expectedSave) => {
    const { i18n, store } = await loadFreshI18n(language);
    expect(store.useAppStore.getState().appSettings.language).toBe(language);
    expect(i18n.getTranslator(language)('save')).toBe(expectedSave);
  });

  it('falls back to ko for an invalid persisted locale', async () => {
    const { i18n, store } = await loadFreshI18n('fr');
    expect(i18n.resolveAppLanguage(store.useAppStore.getState().appSettings.language)).toBe('ko');
    expect(i18n.getTranslator('ko')('save')).toBe(koTranslations.save);
  });

  it('switches locales synchronously and persists the selected locale', async () => {
    const { i18n, store } = await loadFreshI18n();

    expect(store.useAppStore.getState().appSettings.language).toBe('ko');
    store.useAppStore.getState().updateSetting('language', 'en');
    expect(store.useAppStore.getState().appSettings.language).toBe('en');
    expect(i18n.getTranslator('en')('save')).toBe('Save');
    expect(localStorage.getItem(PLANNER_STORAGE_KEY)).toContain('"language":"en"');
  });

  it('preserves the locale then English then key-literal fallback order', async () => {
    vi.resetModules();
    localStorage.clear();
    const saveIndex = translationKeys.indexOf('save');
    const modifiedKo = [...koLocaleValues] as (string | undefined)[];
    modifiedKo[saveIndex] = undefined;
    vi.doMock('./i18n/ko', () => ({ default: modifiedKo }));
    const i18n = await import('./i18n');

    try {
      expect(i18n.getTranslator('ko')('save')).toBe(enTranslations.save);
    } finally {
      vi.doUnmock('./i18n/ko');
    }

    expect(i18n.getTranslator('ko')('missing-test-key' as unknown as TranslationKey)).toBe('missing-test-key');
  });
});
