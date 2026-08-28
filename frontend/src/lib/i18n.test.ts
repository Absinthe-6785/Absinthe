// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enLocaleValues from './i18n/en';
import koLocaleValues from './i18n/ko';
import jaLocaleValues from './i18n/ja';
import translationKeys, { buildLocaleDictionary } from './i18n/keys';
import type { TranslationKey } from './i18n';

const PLANNER_STORAGE_KEY = 'planner-storage';
const EXPECTED_KEY_COUNT = 2_030;
type Locale = 'en' | 'ko' | 'ja';

// Independent authority generated from the accepted pre-extraction base.
// The canonical serialization includes every key and exact locale value in
// translationKeys order, so it detects insertion, omission, reordering, and
// substitution without using buildLocaleDictionary.
const EXPECTED_LOCALE_INTEGRITY_SHA256: Record<Locale, string> = {
  en: '1d0ef37260b1c45987928020da788d37b114a0c8e59fbb864905e2583f0c8101',
  ko: 'ea221ebae3c2e899b6a29e9c68f9bea514a9c6412ac2ea529e52f5b181f2d001',
  ja: '2c053b7d3588f6dc864be0d52e2ce449da8c750a1aa379c83d531b048dfffe14',
};

function localeIntegrityDigest(values: readonly string[]) {
  const canonical = translationKeys
    .map((key, index) => `${JSON.stringify(key)}\u001f${JSON.stringify(values[index])}`)
    .join('\u001e');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function assertLocaleValuesIntegrity(locale: Locale, values: readonly string[]) {
  if (values.length !== translationKeys.length) {
    throw new Error(
      `Locale integrity length mismatch: expected ${translationKeys.length}, received ${values.length}`,
    );
  }
  const invalidValueIndex = values.findIndex(value => typeof value !== 'string');
  if (invalidValueIndex !== -1) {
    throw new Error(`Locale integrity value at index ${invalidValueIndex} must be a string`);
  }
  const actual = localeIntegrityDigest(values);
  const expected = EXPECTED_LOCALE_INTEGRITY_SHA256[locale];
  if (actual !== expected) {
    throw new Error(`Locale integrity mismatch for ${locale}: expected ${expected}, received ${actual}`);
  }
}

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

  it('accepts current locale values with the independent canonical authority', () => {
    expect(() => assertLocaleValuesIntegrity('en', enLocaleValues)).not.toThrow();
    expect(() => assertLocaleValuesIntegrity('ko', koLocaleValues)).not.toThrow();
    expect(() => assertLocaleValuesIntegrity('ja', jaLocaleValues)).not.toThrow();
  });

  it('rejects a missing value before positional assembly', () => {
    const missing = [...enLocaleValues];
    missing.splice(1_000, 1);

    expect(() => buildLocaleDictionary(missing)).toThrow(
      'Locale dictionary length mismatch: expected 2030, received 2029',
    );
    expect(() => assertLocaleValuesIntegrity('en', missing)).toThrow(
      'Locale integrity length mismatch: expected 2030, received 2029',
    );
  });

  it('rejects an extra value before positional assembly', () => {
    const extra = [...enLocaleValues];
    extra.splice(1_000, 0, '__unexpected__');

    expect(() => buildLocaleDictionary(extra)).toThrow(
      'Locale dictionary length mismatch: expected 2030, received 2031',
    );
    expect(() => assertLocaleValuesIntegrity('en', extra)).toThrow(
      'Locale integrity length mismatch: expected 2030, received 2031',
    );
  });

  it('detects an adjacent same-length swap with the independent authority', () => {
    const swapped = [...enLocaleValues];
    [swapped[1_000], swapped[1_001]] = [swapped[1_001], swapped[1_000]];

    const dictionary = buildLocaleDictionary(swapped);
    expect(dictionary[translationKeys[1_000]]).toBe(enLocaleValues[1_001]);
    expect(() => assertLocaleValuesIntegrity('en', swapped)).toThrow(/Locale integrity mismatch for en/);
  });

  it('detects representative same-length value substitution with the independent authority', () => {
    const substituted = [...koLocaleValues];
    substituted[translationKeys.indexOf('save')] = '__unexpected__';

    const dictionary = buildLocaleDictionary(substituted);
    expect(dictionary.save).toBe('__unexpected__');
    expect(() => assertLocaleValuesIntegrity('ko', substituted)).toThrow(/Locale integrity mismatch for ko/);
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
    vi.doMock('./i18n/keys', async () => {
      const actual = await vi.importActual<typeof import('./i18n/keys')>('./i18n/keys');
      return {
        ...actual,
        buildLocaleDictionary(values: readonly string[]) {
          const dictionary = actual.buildLocaleDictionary(values);
          if (values[translationKeys.indexOf('save')] === koLocaleValues[translationKeys.indexOf('save')]) {
            delete (dictionary as Record<string, string>).save;
          }
          return dictionary;
        },
      };
    });
    const i18n = await import('./i18n');

    try {
      expect(i18n.getTranslator('ko')('save')).toBe(enTranslations.save);
    } finally {
      vi.doUnmock('./i18n/keys');
      vi.resetModules();
    }

    expect(i18n.getTranslator('ko')('missing-test-key' as unknown as TranslationKey)).toBe('missing-test-key');
  });
});
