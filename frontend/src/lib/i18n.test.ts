// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enLocaleValues from './i18n/en';
import koLocaleValues from './i18n/ko';
import jaLocaleValues from './i18n/ja';
import translationKeys, { buildLocaleDictionary } from './i18n/keys';
import type { TranslationKey } from './i18n';

const PLANNER_STORAGE_KEY = 'planner-storage';
const EXPECTED_KEY_COUNT = 2_247;
type Locale = 'en' | 'ko' | 'ja';

// Current independent canonical authority, including append-only Notes UI, Wiki-link accessibility, cloud comparison details, local document downloads, and PDF/DOCX preview.
// The canonical serialization includes every key and exact locale value in
// translationKeys order, so it detects insertion, omission, reordering, and
// substitution without using buildLocaleDictionary.
const EXPECTED_LOCALE_INTEGRITY_SHA256: Record<Locale, string> = {
  en: 'e4f51b38c1ad912e05fae4a940c791dc31898b1d676d916034125cf8d88d3065',
  ko: '6cc1b78497c974c532df9509527a9da208f25d30c176d3e058694c4c26c88901',
  ja: '9a46ffa90e607f438f2ccfb96a2f78ce03ee5801d51d5561275c06eb14772489',
};

const PRE_CLOUD_COMPARISON_LOCALE_SHA256: Record<Locale, string> = {
  en: 'c8e9334d40b0b568cbd2eb19153f613eaa8e4a18c22d9afbdc2f77bae42ad4dd',
  ko: 'e352867aa52a3e401e6a6eac605b2d4a8e38a42e5e51bd9d6f24bc1ceb6dd0bf',
  ja: '40d914bee0c15cdd3a4b6bb4e3847610c459af355063b72ce297ecc893195c66',
};

const PRE_LOCAL_ORIGINALS_LOCALE_SHA256: Record<Locale, string> = {
  en: '580e59ce3e8307ca07c4985e2a2df8cfd85f6664c1534f0a76cdf641c9bb9c97',
  ko: '3d1fdfd3231f489cb9324bde7d107168aa2bac9c212bd193bc004533108c01b2',
  ja: '0ed805a8e83d46e8ac22fcd592aa9a5cc03e9565f53d876f1bc4dbda5eee84be',
};

// Preserve every existing value; the reset-specific copy is append-only.
const PRE_RESET_LOCALE_SHA256: Record<Locale, string> = {
  en: '22875d92ef35aee446c457359e397f74d8a4a002463466968a872818609be8be',
  ko: '75e23d4ac7d9037c10e7c827a30ccaa661b18dfd40059feb9b29c33de77e13bd',
  ja: '7fe10eda29693aee42842c4187ec95943819c8822142066dc248a76a1fe5c531',
};

const PRE_SHORTCUT_LOCALE_SHA256: Record<Locale, string> = {
  en: '1f3acf0a16f0d42eb302e373ff3898db7937bc515cdd72835dee13c9ad66f8aa',
  ko: 'dd4c25b8759be389813d327c4c860dbc635ed582f3059b01e44ae14a547a5554',
  ja: '7d8f97df413cb465039f41d5151d258681bd7ff71df8f0fa7e5208dcfc1a866d',
};

const PRE_CURRENTNESS_LOCALE_SHA256: Record<Locale, string> = {
  en: 'de99de8ecc8c063584841c0a82140ccad67248ba92da9e7290f75fec04426a3f',
  ko: 'a38265759dd1b1790d619f1462c789bb4bfb6ed8e6fc1642ee55a8a29be50d3c',
  ja: 'c6f591fcee1b214302209f5159ced958c53a57e07414de9e141ee412bbf8557f',
};

const PRE_COMPARISON_LOCALE_SHA256: Record<Locale, string> = {
  en: '9dd45b8c2311caaf74f472936d35924104de799f63ca64f401695833e5af9e4b',
  ko: '9d69b70f012805fe7002a1480ef4733dc445629ae7c7bce3d97cc9df9ca3a6d8',
  ja: 'f2e542d2dd46b0cfd11917255cfa93c78bb675b5e00e2889badf0f38274101a4',
};

function localeIntegrityDigest(values: readonly string[], keys: readonly string[] = translationKeys) {
  const canonical = keys
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
  it('appends single-create labels without changing any preexisting translation', () => {
    const previous = { en: 'abbad7971eca1f34393dcf72891daed57f217ac41d74495e8dacb7b573da5d0d', ko: '8a60d32101c24afa0ee443c411a097bbaf2a84cf4fd90809cb72de6c5893c135', ja: '37fc3b52bf811da93bd7305f88d3c123ad9bc8256ae68856b067e5d4148bb23e' };
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_238), translationKeys.slice(0, 2_238))).toBe(previous[locale]);
    }
    expect(translationKeys.slice(2_238)).toEqual(['healthCloudCreateScope', 'healthCloudCreate', 'healthCloudCreateConfirm', 'healthCloudCreateConfirmAction', 'healthCloudCreateCancel', 'healthCloudCreateDenied', 'healthCloudCreateConflict', 'healthCloudCreateIndeterminate', 'healthCloudCreateConfirmed']);
  });
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

  it('keeps backup success and coverage copy explicit about supported data and excluded attachment originals', () => {
    const attachmentDisclosure: Record<Locale, string> = {
      en: 'original attachment files are not included',
      ko: '첨부 원본 파일은 포함되지 않',
      ja: '添付ファイルのオリジナルは含まれ',
    };
    const supportedData: Record<Locale, string> = {
      en: 'supported',
      ko: '지원',
      ja: '対応',
    };
    const cloudCompletenessDisclosure: Record<Locale, string> = {
      en: 'cloud-complete does not mean original attachment files are backed up',
      ko: '클라우드 범위가 완전해도 첨부 원본 파일이 백업되는 것은 아닙니다',
      ja: 'クラウド範囲が完全でも、添付ファイルのオリジナルがバックアップされるわけではありません',
    };

    for (const [locale, dictionary] of [
      ['en', enTranslations],
      ['ko', koTranslations],
      ['ja', jaTranslations],
    ] as const) {
      for (const key of [
        'dataSafetyBackupDesc',
        'dataSafetyLocalBackupDesc',
        'vaultBackupZipComplete',
        'dataSafetyLocalBackupComplete',
        'dataSafetyLimitedBackupComplete',
      ] as const) {
        expect(dictionary[key].toLowerCase(), `${locale}.${key}`).toContain(attachmentDisclosure[locale]);
        expect(dictionary[key].toLowerCase(), `${locale}.${key}`).toContain(supportedData[locale]);
      }
      expect(dictionary.dataSafetyStatusDesc.toLowerCase(), `${locale}.dataSafetyStatusDesc`)
        .toContain(cloudCompletenessDisclosure[locale]);
      expect(dictionary.dataSafetyLimitedBackupDesc.toLowerCase(), `${locale}.dataSafetyLimitedBackupDesc`)
        .toContain(attachmentDisclosure[locale]);
      expect(dictionary.dataSafetyLimitedBackupRecipeDesc.toLowerCase(), `${locale}.dataSafetyLimitedBackupRecipeDesc`)
        .toContain(attachmentDisclosure[locale]);
    }
  });

  it('keeps the current 2122-key localized baseline stable, including backup-scope copy', () => {
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_122), translationKeys.slice(0, 2_122)))
        .toBe(PRE_COMPARISON_LOCALE_SHA256[locale]);
    }
  });

  it('keeps the current 2142-key prefix, four currentness keys, and appends shortcut keys only', () => {
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_142), translationKeys.slice(0, 2_142)))
        .toBe(PRE_CURRENTNESS_LOCALE_SHA256[locale]);
      expect(localeIntegrityDigest(values.slice(0, 2_146), translationKeys.slice(0, 2_146)))
        .toBe(PRE_SHORTCUT_LOCALE_SHA256[locale]);
    }
    expect(translationKeys.slice(2_142, 2_146)).toEqual([
      'healthPreviousRefreshing', 'healthPreviousUnavailable', 'healthPreviousSuppressed', 'healthPreviousNoMatch',
    ]);
    expect(translationKeys.slice(2_146, 2_163)).toEqual([
      'shortcutSectionHeadings', 'shortcutSectionNavigation', 'shortcutSectionHelp', 'shortcutInlineCode',
      'shortcutBodyText', 'shortcutHeadingLevels', 'shortcutTodo', 'shortcutToggle', 'shortcutCallout',
      'shortcutCodeBlock', 'shortcutSlashCommand', 'shortcutNoteSearch', 'shortcutFocusMode', 'shortcutUndoRedo',
      'shortcutReadMode', 'shortcutIndentOutdent', 'shortcutClearBlockSelection',
    ]);
  });

  it('appends Wiki-link availability copy after Note link copy', () => {
    expect(translationKeys.slice(2_163, 2_168)).toEqual([
      'notesResetAction', 'notesResetScope', 'notesResetConfirm', 'notesResetCompleted', 'notesResetIncomplete',
    ]);
    expect(translationKeys.slice(2_168, 2_171)).toEqual([
      'healthWorkoutBadgeLegacyScope', 'healthWorkoutBadgePrDescription', 'healthWorkoutBadgeDiffDescription',
    ]);
    expect(translationKeys.slice(2_171, 2_175)).toEqual([
      'nvCopyNoteLink', 'nvNoteLinkCopied', 'nvCopyNoteLinkFailed', 'wikiIdLinkUnavailable',
    ]);
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_163), translationKeys.slice(0, 2_163)))
        .toBe(PRE_RESET_LOCALE_SHA256[locale]);
      const dictionary = buildLocaleDictionary(values);
      expect(dictionary.notesResetScope).toMatch(/Attachment originals|첨부 원본|添付原本/);
      expect(dictionary.notesResetCompleted).toMatch(/not a complete account wipe|계정 전체 삭제는 아닙니다|アカウント全体の消去ではありません/);
      expect(dictionary.notesResetIncomplete).toMatch(/no rollback|되돌리기나 자동 재시도는 수행하지|ロールバックや自動再試行は行っていません/);
    }
    expect(enLocaleValues.slice(2_171, 2_175)).toEqual(['Copy note link', 'Note link copied', 'Could not copy note link', 'Linked note unavailable']);
    expect(koLocaleValues.slice(2_171, 2_175)).toEqual(['노트 링크 복사', '노트 링크를 복사했어요', '노트 링크를 복사하지 못했어요', '연결된 노트를 사용할 수 없습니다']);
    expect(jaLocaleValues.slice(2_171, 2_175)).toEqual(['ノートリンクをコピー', 'ノートリンクをコピーしました', 'ノートリンクをコピーできませんでした', 'リンク先ノートを利用できません']);
  });

  it('preserves the full existing prefix and appends separate local-originals export disclosure', () => {
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_175), translationKeys.slice(0, 2_175)))
        .toBe(PRE_LOCAL_ORIGINALS_LOCALE_SHA256[locale]);
      expect(buildLocaleDictionary(values).localOriginalsScope).toContain('Vault ZIP/JSON');
      expect(buildLocaleDictionary(values).localOriginalsScope).toContain('PDF/DOCX');
      expect(buildLocaleDictionary(values).localOriginalsScope).toContain('SHA-256');
    }
    expect(translationKeys.slice(2_175, 2_187)).toEqual([
      'localOriginalsTitle', 'localOriginalsScope', 'localOriginalsCheck', 'localOriginalsChecking',
      'localOriginalsCoverage', 'localOriginalsComplete', 'localOriginalsPartial', 'localOriginalsDetails',
      'localOriginalsDownload', 'localOriginalsDownloadPartial', 'localOriginalsError', 'localOriginalsDownloaded',
    ]);
  });

  it('preserves existing copy and appends the local document and PDF preview labels', () => {
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_187), translationKeys.slice(0, 2_187)))
        .toBe(PRE_CLOUD_COMPARISON_LOCALE_SHA256[locale]);
      const dictionary = buildLocaleDictionary(values);
      expect(dictionary.notesCloudLimit).toContain('500');
      expect(dictionary.notesCloudScope).toMatch(/does NOT enable|활성화하지 않습니다|有効になりません/);
    }
    expect(translationKeys.slice(2_187, 2_209)).toHaveLength(22);
    expect(translationKeys.slice(2_209, 2_224)).toEqual([
      'noteLocalDocumentsTitle', 'noteLocalDocumentDownload', 'noteLocalDocumentVerifying',
      'noteLocalDocumentDownloadStarted', 'noteLocalDocumentDownloadUnavailable', 'noteLocalDocumentsUnavailable',
      'noteLocalDocumentPreview', 'noteLocalDocumentPreviewTitle',
      'noteLocalDocumentPreviewFallback', 'noteLocalDocumentPreviewUnavailable', 'noteLocalDocumentDocxPreview',
      'noteLocalDocumentDocxPreviewTitle', 'noteLocalDocumentDocxPreviewFallback',
      'noteLocalDocumentDocxPreviewUnavailable', 'noteLocalDocumentDocxPreviewRendering',
    ]);
  });

  it('provides localized labels and truthful readback/download/preview feedback in all supported languages', () => {
    const expected = {
      en: ['Local document originals', 'Download original', 'Verifying original…', 'A download was requested in your browser. Check its downloads.', 'This original is unavailable or this Note/account context changed. No file was downloaded.', 'Local document originals are unavailable for this Note.', 'Preview PDF', 'PDF preview: {name}', 'If the PDF does not appear here, use Download original.', 'This PDF could not be previewed. You can still download the original.', 'Preview DOCX', 'DOCX preview: {name}', 'If the document does not appear here, use Download original.', 'This DOCX could not be previewed. You can still download the original.', 'Rendering DOCX preview…'],
      ko: ['노트의 로컬 문서 원본', '원본 다운로드', '원본 확인 중…', '브라우저에 다운로드를 요청했습니다. 다운로드 목록을 확인하세요.', '원본을 사용할 수 없거나 노트·계정 상태가 변경되었습니다. 파일을 다운로드하지 않았습니다.', '이 노트의 로컬 문서 원본을 사용할 수 없습니다.', 'PDF 미리보기', 'PDF 미리보기: {name}', 'PDF가 여기에 표시되지 않으면 원본 다운로드를 사용하세요.', 'PDF를 미리 볼 수 없습니다. 원본은 계속 다운로드할 수 있습니다.', 'DOCX 미리보기', 'DOCX 미리보기: {name}', '문서가 여기에 표시되지 않으면 원본 다운로드를 사용하세요.', 'DOCX를 미리 볼 수 없습니다. 원본은 계속 다운로드할 수 있습니다.', 'DOCX 미리보기 렌더링 중…'],
      ja: ['ノートのローカル文書原本', '原本をダウンロード', '原本を確認中…', 'ブラウザーにダウンロードを要求しました。ダウンロード一覧を確認してください。', '原本を利用できないか、ノートまたはアカウントの状態が変わりました。ファイルはダウンロードされていません。', 'このノートのローカル文書原本を利用できません。', 'PDFをプレビュー', 'PDFプレビュー：{name}', 'PDFが表示されない場合は、原本をダウンロードしてください。', 'PDFをプレビューできません。原本は引き続きダウンロードできます。', 'DOCXをプレビュー', 'DOCXプレビュー：{name}', '文書が表示されない場合は、原本をダウンロードしてください。', 'DOCXをプレビューできません。原本は引き続きダウンロードできます。', 'DOCXプレビューをレンダリング中…'],
    } as const;
    const keys = ['noteLocalDocumentsTitle', 'noteLocalDocumentDownload', 'noteLocalDocumentVerifying', 'noteLocalDocumentDownloadStarted', 'noteLocalDocumentDownloadUnavailable', 'noteLocalDocumentsUnavailable', 'noteLocalDocumentPreview', 'noteLocalDocumentPreviewTitle', 'noteLocalDocumentPreviewFallback', 'noteLocalDocumentPreviewUnavailable', 'noteLocalDocumentDocxPreview', 'noteLocalDocumentDocxPreviewTitle', 'noteLocalDocumentDocxPreviewFallback', 'noteLocalDocumentDocxPreviewUnavailable', 'noteLocalDocumentDocxPreviewRendering'] as const;
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      const dictionary = buildLocaleDictionary(values);
      expect(keys.map(key => dictionary[key]), locale).toEqual(expected[locale]);
      expect(dictionary.noteLocalDocumentsUnavailable).not.toBe('noteLocalDocumentsUnavailable');
    }
  });

  it('rejects a missing value before positional assembly', () => {
    const missing = [...enLocaleValues];
    missing.splice(1_000, 1);

    expect(() => buildLocaleDictionary(missing)).toThrow(
      'Locale dictionary length mismatch: expected 2247, received 2246',
    );
    expect(() => assertLocaleValuesIntegrity('en', missing)).toThrow(
      'Locale integrity length mismatch: expected 2247, received 2246',
    );
  });

  it('rejects an extra value before positional assembly', () => {
    const extra = [...enLocaleValues];
    extra.splice(1_000, 0, '__unexpected__');

    expect(() => buildLocaleDictionary(extra)).toThrow(
      'Locale dictionary length mismatch: expected 2247, received 2248',
    );
    expect(() => assertLocaleValuesIntegrity('en', extra)).toThrow(
      'Locale integrity length mismatch: expected 2247, received 2248',
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
    expect(enTranslations.trash).toBe('Trash');
    expect(koTranslations.trash).toBe('휴지통');
    expect(jaTranslations.trash).toBe('ゴミ箱');
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
