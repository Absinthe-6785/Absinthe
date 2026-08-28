/**
 * i18n.ts — 다국어 지원 (영어 / 한국어 / 일본어)
 *
 * 사용법:
 *   const { t, lang } = useTranslation();
 *   t('save')  →  'Save' | '저장' | '保存'
 */

import enTranslations from './i18n/en';
import koTranslations from './i18n/ko';
import jaTranslations from './i18n/ja';
import { buildLocaleDictionary, type TranslationKey as LocaleTranslationKey } from './i18n/keys';
import { useAppStore } from '../store/useAppStore';

export type Language = 'en' | 'ko' | 'ja';

/** Primary product locale — new sessions and unresolved settings fall back here. */
export const DEFAULT_APP_LANGUAGE: Language = 'ko';

export function resolveAppLanguage(language?: Language | null): Language {
  if (language === 'en' || language === 'ko' || language === 'ja') return language;
  return DEFAULT_APP_LANGUAGE;
}

/** BCP-47 locale for Intl / toLocaleDateString from app language. */
export function resolveIntlLocale(language?: Language | null): string {
  const lang = resolveAppLanguage(language);
  if (lang === 'ko') return 'ko-KR';
  if (lang === 'ja') return 'ja-JP';
  return 'en-US';
}

/** Map BCP-47 locale (or Intl output) back to app Language. */
export function languageFromIntlLocale(locale?: string | null): Language {
  if (!locale) return DEFAULT_APP_LANGUAGE;
  const base = locale.split('-')[0]?.toLowerCase();
  if (base === 'ja') return 'ja';
  if (base === 'ko') return 'ko';
  if (base === 'en') return 'en';
  return DEFAULT_APP_LANGUAGE;
}

export type TranslationKey = LocaleTranslationKey;

const translations = {
  en: buildLocaleDictionary(enTranslations),
  ko: buildLocaleDictionary(koTranslations),
  ja: buildLocaleDictionary(jaTranslations),
} as const satisfies Record<Language, Record<TranslationKey, string>>;

// ── 번역 함수 ────────────────────────────────────────────────────────
export function getTranslator(lang: Language) {
  return function t(key: TranslationKey): string {
    return translations[lang]?.[key] ?? translations.en?.[key] ?? key;
  };
}

// ── React 훅 ─────────────────────────────────────────────────────────
export function useTranslation() {
  const lang = resolveAppLanguage(useAppStore(s => s.appSettings.language));
  return { t: getTranslator(lang), lang };
}
