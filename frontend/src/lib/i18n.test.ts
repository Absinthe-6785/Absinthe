// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enLocaleValues from './i18n/en';
import koLocaleValues from './i18n/ko';
import jaLocaleValues from './i18n/ja';
import translationKeys, { buildLocaleDictionary } from './i18n/keys';
import type { TranslationKey } from './i18n';

const PLANNER_STORAGE_KEY = 'planner-storage';
const EXPECTED_KEY_COUNT = 2_320;
type Locale = 'en' | 'ko' | 'ja';

// Current independent canonical authority, including append-only Notes UI, Wiki-link accessibility, cloud comparison and Cloud Copy status readback, local document downloads, PDF/DOCX preview, Recipe filter reset, local-original integrity preflight, and cloud Note previews.
// The canonical serialization includes every key and exact locale value in
// translationKeys order, so it detects insertion, omission, reordering, and
// substitution without using buildLocaleDictionary.
const EXPECTED_LOCALE_INTEGRITY_SHA256: Record<Locale, string> = {
  en: 'd9a221b399f472ca1b0c7c9386a0e33be2ba3a4f98e576bceee7a553e8fb957f',
  ko: 'f6b607d8ef132f0aa643377e96812ba3a90cdc88bc4e711ecf57d7bc22444546',
  ja: '7ab23df45dd1dc03ed3ef78a0640e3a1fe833a46b6060c8c75c70ae5c49bcacd',
};

const PRE_REMOTE_NOTE_PREVIEW_LOCALE_SHA256: Record<Locale, string> = {
  en: '88cef662d426ae8b6c65a8aa48bb6032d18a93d7e579850f741be7d5712a3ba4',
  ko: '9c0ac7cb830f42900354fad86937c93f6592ea4b98547fca70f1371014329b8e',
  ja: '512e9973ff1fa9217c77fab2be0f588516aae6f8317f4a2ed600b3c159c77503',
};

const PRE_LOCAL_ORIGINAL_VERIFICATION_LOCALE_SHA256: Record<Locale, string> = {
  en: '3e2c311c98d83892d3ebd3e17b0c94ed516e34b238fc96b94938df5ccf772f81',
  ko: 'd8c1bb7ff94fcbc89579768bfb47b144f42f82062a5b41ba4644136b273e3972',
  ja: 'ea0915917764408caa25d2e024970aa1f3774c594a4325d8cb23240be5be9f3c',
};

const PRE_SCHEDULE_REFRESH_LOCALE_SHA256: Record<Locale, string> = {
  en: '27cf1580060cf4f392a27d4f5c7cca918e90340963f167033ea4c26b6363693c',
  ko: 'a5e84f10d9e98d84f6fcc2616d7f65cd1eec504b33c7f6cfe68bf0fbe51e2f4b',
  ja: 'f7b7bca0a75a88a421663576dbc369f624d03cf1299a8ab8e00f3292b73ccc6e',
};

const PRE_RECIPE_FILTER_RESET_LOCALE_SHA256: Record<Locale, string> = {
  en: '7d91d5446bfb1916b84559b139d4b09baffc0ce476f52dc20b2d07bdb289f26f',
  ko: 'cf5f5266728609008ac93904799c623d9b2a1c18a89c89631d778e0b3984fa74',
  ja: '088486136a91e72bcabb3b76b094aed0fad1dd1399756377efaa5355d3080a67',
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
  it('appends exercise-only receipt labels without changing any existing translation', () => {
    const previous = { en: '04fd1a8d5da4a3a9c57f7b7f0c5e95d6a8117cbf1dcda9eddfea119ff8c0d44b', ko: '07f143506aee0f2829dd578a974c1f5f79e06ae763a89098c001e5f60bd6179a', ja: 'b0a16a4ed1790c18032a0b0da844a10a76d00fb96874e8ca6a73997f82bc46dc' };
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_256), translationKeys.slice(0, 2_256))).toBe(previous[locale]);
    }
  });
  it('appends single-create labels without changing any preexisting translation', () => {
    const previous = { en: 'abbad7971eca1f34393dcf72891daed57f217ac41d74495e8dacb7b573da5d0d', ko: '8a60d32101c24afa0ee443c411a097bbaf2a84cf4fd90809cb72de6c5893c135', ja: '37fc3b52bf811da93bd7305f88d3c123ad9bc8256ae68856b067e5d4148bb23e' };
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_238), translationKeys.slice(0, 2_238))).toBe(previous[locale]);
    }
    expect(translationKeys.slice(2_238, 2_247)).toEqual(['healthCloudCreateScope', 'healthCloudCreate', 'healthCloudCreateConfirm', 'healthCloudCreateConfirmAction', 'healthCloudCreateCancel', 'healthCloudCreateDenied', 'healthCloudCreateConflict', 'healthCloudCreateIndeterminate', 'healthCloudCreateConfirmed']);
  });
  it('appends receive copy without changing any of the 2247 existing translations', () => {
    const previous = { en: 'e4f51b38c1ad912e05fae4a940c791dc31898b1d676d916034125cf8d88d3065', ko: '6cc1b78497c974c532df9509527a9da208f25d30c176d3e058694c4c26c88901', ja: '9a46ffa90e607f438f2ccfb96a2f78ce03ee5801d51d5561275c06eb14772489' };
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2247), translationKeys.slice(0, 2247))).toBe(previous[locale]);
    }
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

  it('appends the Recipe filtered reset label without changing existing translations', () => {
    const expected = {
      en: 'Clear search and filters',
      ko: '검색 및 필터 지우기',
      ja: '検索とフィルターをクリア',
    } as const;
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_283), translationKeys.slice(0, 2_283)))
        .toBe(PRE_RECIPE_FILTER_RESET_LOCALE_SHA256[locale]);
      expect(buildLocaleDictionary(values).recipeClearSearchAndFilters).toBe(expected[locale]);
    }
    expect(translationKeys.slice(2_283, 2_284)).toEqual(['recipeClearSearchAndFilters']);
  });

  it('appends the Schedule refresh control and truthful statuses without changing prior translations', () => {
    const expectedKeys = [
      'refreshSchedules', 'refreshingSchedules', 'schedulesRefreshed',
      'schedulesRefreshIncomplete', 'schedulesRefreshOffline', 'schedulesRefreshUnavailable',
      'scheduleMonthLoading', 'scheduleMonthUnavailable',
    ] as const;
    const expected = {
      en: ['Refresh schedules', 'Refreshing schedules…', 'Schedules refreshed.',
        'Some schedule sources could not be refreshed. Their previous data was kept.',
        "You're offline. Existing schedules were kept.", 'Schedule refresh is unavailable right now.',
        "Loading this month's schedules…", "This month's schedules could not be verified. Partial results are hidden; try Refresh schedules."],
      ko: ['일정 새로고침', '일정 새로고침 중…', '일정을 새로고침했습니다.',
        '일부 일정은 새로고침하지 못했습니다. 해당 일정의 기존 내용은 유지했습니다.',
        '오프라인 상태입니다. 기존 일정은 유지했습니다.', '지금은 일정을 새로고침할 수 없습니다.',
        '이번 달 일정을 불러오는 중…', '이번 달 일정을 확인하지 못했습니다. 부분 결과는 표시하지 않습니다. 일정 새로고침을 시도해 주세요.'],
      ja: ['予定を再読み込み', '予定を再読み込み中…', '予定を再読み込みしました。',
        '一部の予定を再読み込みできませんでした。該当する予定の既存データは保持されています。',
        'オフラインです。既存の予定は保持されています。', '現在、予定を再読み込みできません。',
        '今月の予定を読み込み中…', '今月の予定を確認できませんでした。不完全な結果は表示していません。予定を再読み込みしてください。'],
    } as const;

    expect(translationKeys.slice(2_284, 2_292)).toEqual(expectedKeys);
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_284), translationKeys.slice(0, 2_284)))
        .toBe(PRE_SCHEDULE_REFRESH_LOCALE_SHA256[locale]);
      const dictionary = buildLocaleDictionary(values);
      expect(expectedKeys.map(key => dictionary[key]), locale).toEqual(expected[locale]);
    }
  });

  it('appends local-original preflight labels without changing existing translations', () => {
    const keys = [
      'noteLocalDocumentsEmpty', 'noteLocalDocumentVerifyOriginal', 'noteLocalDocumentVerificationAvailable',
      'noteLocalDocumentVerificationVerified', 'noteLocalDocumentVerificationUnavailable',
      'noteLocalDocumentVerificationInvalidated', 'noteLocalDocumentDriveBackupUnavailable',
    ] as const;
    const expected = {
      en: ['No eligible published PDF/DOCX originals for this Note.', 'Verify local original', 'Available for local verification.',
        'Local original verified: SHA-256 matched at this moment. This does not confirm a Google Drive backup.',
        'Local original unavailable or changed; verification did not complete.',
        'Account or Note context changed. The local verification result was cleared.',
        'Google Drive backup is not checked here; this is a local-only check.'],
      ko: ['이 노트에 검증 가능한 게시 PDF/DOCX 원본이 없습니다.', '로컬 원본 확인', '로컬에서 확인할 수 있습니다.',
        '로컬 원본의 SHA-256이 현재 일치합니다. Google Drive 백업을 확인한 것은 아닙니다.',
        '로컬 원본을 사용할 수 없거나 변경되어 확인을 완료하지 못했습니다.',
        '계정 또는 노트 문맥이 바뀌어 로컬 확인 결과를 지웠습니다.',
        '이 화면은 Google Drive 백업을 확인하지 않습니다. 로컬 전용 확인입니다.'],
      ja: ['このノートに確認可能な公開済みPDF/DOCX原本はありません。', 'ローカル原本を確認', 'ローカルで確認できます。',
        'ローカル原本のSHA-256が現時点で一致しました。Google Driveのバックアップを確認したものではありません。',
        'ローカル原本を利用できないか変更されており、確認を完了できませんでした。',
        'アカウントまたはノートのコンテキストが変わったため、ローカル確認結果を消去しました。',
        'この画面ではGoogle Driveバックアップを確認しません。ローカルのみの確認です。'],
    } as const;

    expect(translationKeys.slice(2_292, 2_299)).toEqual(keys);
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_292), translationKeys.slice(0, 2_292)))
        .toBe(PRE_LOCAL_ORIGINAL_VERIFICATION_LOCALE_SHA256[locale]);
      const dictionary = buildLocaleDictionary(values);
      expect(keys.map(key => dictionary[key]), locale).toEqual(expected[locale]);
    }
  });

  it('appends cloud-only and divergent Note preview labels without changing existing translations', () => {
    const keys = [
      'notesCloudPreviewAction', 'notesCloudPreviewHeading', 'notesCloudPreviewSource',
      'notesCloudPreviewAttachmentWarning', 'notesCloudPreviewPartial', 'notesCloudPreviewStale',
      'notesCloudPreviewUnavailable',
    ] as const;
    const expected = {
      en: ['Preview cloud Note', 'Cloud-only Note preview',
        'Text from the verified cloud comparison. This content is not a local Note and has not been imported.',
        'Attachment originals are not included in this preview.',
        'Partial preview; the remaining text is omitted.',
        'This comparison is no longer current. Run it again before previewing.',
        'Cloud-only text is unavailable in the current comparison.',
        'Compare local and cloud versions', 'Read-only comparison of Note versions',
        'Values from this manual comparison, not continuous synchronization or one atomic local/cloud transaction. The cloud version may have changed since it was read. Nothing is changed here.',
        'Attachment originals and Note history are outside this comparison.', 'Supported fields that differ', 'Local version', 'Cloud version',
        'These Note versions are unavailable in the current comparison. Run it again before comparing.',
        'Title', 'Text body', 'Folder assignment', 'Starred state', 'Properties', 'Relations'],
      ko: ['클라우드 노트 미리보기', '클라우드 전용 노트 미리보기',
        '검증된 클라우드 비교에서 가져온 텍스트입니다. 로컬 노트가 아니며 가져오지 않았습니다.',
        '첨부 원본은 이 미리보기에 포함되지 않습니다.',
        '일부 미리보기입니다. 나머지 텍스트는 생략되었습니다.',
        '비교 결과가 더 이상 최신 상태가 아닙니다. 다시 비교한 뒤 미리보세요.',
        '현재 비교에서 클라우드 전용 텍스트를 사용할 수 없습니다.',
        '로컬 버전과 클라우드 버전 비교', '노트 버전 읽기 전용 비교',
        '이 수동 비교에서 포착한 값입니다. 지속 동기화나 로컬·클라우드의 원자적 단일 시점 스냅샷이 아니며, 읽은 뒤 클라우드 버전이 바뀌었을 수 있습니다. 이 화면에서는 아무것도 변경하지 않습니다.',
        '첨부 원본과 노트 기록은 이 비교 범위에 포함되지 않습니다.', '지원되는 차이 필드', '로컬 버전', '클라우드 버전',
        '현재 비교에서 두 노트 버전을 사용할 수 없습니다. 다시 비교한 뒤 확인해 주세요.',
        '제목', '본문', '폴더 지정', '즐겨찾기 상태', '속성', '관계'],
      ja: ['クラウドノートをプレビュー', 'クラウドのみのノートプレビュー',
        '検証済みクラウド比較のテキストです。ローカルノートではなく、取り込みも行っていません。',
        '添付ファイルの原本はこのプレビューに含まれません。',
        '一部のみのプレビューです。残りのテキストは省略されています。',
        'この比較結果は最新ではありません。再比較してからプレビューしてください。',
        '現在の比較ではクラウドのみのテキストを利用できません。',
        'ローカル版とクラウド版を比較', 'ノートの読み取り専用バージョン比較',
        'この手動比較で取得した値です。継続的な同期や、ローカルとクラウドを同時に取得した単一トランザクションではありません。取得後にクラウド版が変更されている可能性があります。この画面では何も変更しません。',
        '添付ファイルの原本とノートの履歴は比較対象外です。', '差異のある対応済みフィールド', 'ローカル版', 'クラウド版',
        '現在の比較では両方のノート版を利用できません。再比較してから確認してください。',
        'タイトル', '本文', 'フォルダーの割り当て', 'スター状態', 'プロパティ', '関連付け'],
    } as const;
    expect(translationKeys.slice(2_299)).toEqual([
      ...keys,
      'notesCloudDivergentAction', 'notesCloudDivergentHeading', 'notesCloudDivergentSource', 'notesCloudDivergentScope',
      'notesCloudDivergentFields', 'notesCloudDivergentLocal', 'notesCloudDivergentCloud', 'notesCloudDivergentUnavailable',
      'notesCloudDifferenceTitle', 'notesCloudDifferenceBody', 'notesCloudDifferenceFolder', 'notesCloudDifferenceStarred',
      'notesCloudDifferenceProperties', 'notesCloudDifferenceRelations',
    ]);
    for (const [locale, values] of [['en', enLocaleValues], ['ko', koLocaleValues], ['ja', jaLocaleValues]] as const) {
      expect(localeIntegrityDigest(values.slice(0, 2_299), translationKeys.slice(0, 2_299)))
        .toBe(PRE_REMOTE_NOTE_PREVIEW_LOCALE_SHA256[locale]);
      const dictionary = buildLocaleDictionary(values);
      expect(translationKeys.slice(2_299).map(key => dictionary[key]), locale).toEqual(expected[locale]);
    }
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
      'Locale dictionary length mismatch: expected 2320, received 2319',
    );
    expect(() => assertLocaleValuesIntegrity('en', missing)).toThrow(
      'Locale integrity length mismatch: expected 2320, received 2319',
    );
  });

  it('rejects an extra value before positional assembly', () => {
    const extra = [...enLocaleValues];
    extra.splice(1_000, 0, '__unexpected__');

    expect(() => buildLocaleDictionary(extra)).toThrow(
      'Locale dictionary length mismatch: expected 2320, received 2321',
    );
    expect(() => assertLocaleValuesIntegrity('en', extra)).toThrow(
      'Locale integrity length mismatch: expected 2320, received 2321',
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
