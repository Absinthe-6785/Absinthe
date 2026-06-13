import { DEFAULT_APP_LANGUAGE, getTranslator, type Language } from '../../../../../lib/i18n';

export function languageFromIntlLocale(locale?: string): Language {
  if (!locale) return DEFAULT_APP_LANGUAGE;
  const prefix = locale.slice(0, 2);
  if (prefix === 'ja') return 'ja';
  if (prefix === 'en') return 'en';
  return 'ko';
}

export function resolveArchiveBrowseStaticLabels(locale?: string) {
  const t = getTranslator(languageFromIntlLocale(locale));
  return {
    custom: t('nvCustomRange'),
    allAreas: t('archiveBrowseAllAreas'),
    timeline: t('archiveViewTimeline'),
  };
}

export function resolveArchiveFrameLabels(locale?: string) {
  const t = getTranslator(languageFromIntlLocale(locale));
  return {
    title: t('archiveHomeTitle'),
    subtitle: t('archiveHomeSubtitle'),
  };
}
