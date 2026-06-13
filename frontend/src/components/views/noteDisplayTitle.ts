import {
  getTranslator,
  resolveAppLanguage,
  languageFromIntlLocale,
  type Language,
} from '../../lib/i18n';
import { useAppStore } from '../../store/useAppStore';

/** Display-only placeholder for notes without a user title. Prefer {@link resolveUntitledNoteLabel}. */
export const UNTITLED_NOTE_LABEL = '제목 없음';

const LEGACY_UNTITLED = 'Untitled';

export function resolveUntitledNoteLabel(language?: Language | null): string {
  const lang = resolveAppLanguage(
    language ?? useAppStore.getState().appSettings.language,
  );
  return getTranslator(lang)('untitledNote');
}

export function resolveUntitledNoteLabelForLocale(locale?: string | null): string {
  return resolveUntitledNoteLabel(languageFromIntlLocale(locale));
}

export function displayNoteTitle(
  title: string | null | undefined,
  language?: Language | null,
): string {
  const trimmed = title?.trim();
  if (!trimmed || trimmed === LEGACY_UNTITLED) {
    return resolveUntitledNoteLabel(language);
  }
  return trimmed;
}

export function displayNoteTitleForLocale(
  title: string | null | undefined,
  locale?: string | null,
): string {
  return displayNoteTitle(title, languageFromIntlLocale(locale));
}
