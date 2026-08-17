import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const srcRoot = join(root, 'src');
const docsRoot = join(root, 'docs');

const docPath = join(docsRoot, 'K-296-supabase-usage-quota-traffic-risk-source-facts-audit.md');
const k295DocPath = join(docsRoot, 'K-295-auth-restoration-test-dev-verification-line-closure-audit.md');
const k91fDocPath = join(docsRoot, 'K-91F-health-request-fanout-audit.md');
const k91gDocPath = join(docsRoot, 'K-91G-auth-verification-optimization.md');

const supabasePath = join(srcRoot, 'lib', 'supabase.ts');
const appPath = join(srcRoot, 'App.tsx');
const appContentPath = join(srcRoot, 'components', 'AppContent.tsx');
const loginScreenPath = join(srcRoot, 'components', 'views', 'LoginScreen.tsx');
const fetcherPath = join(srcRoot, 'lib', 'fetcher.ts');
const remoteBoundaryPath = join(srcRoot, 'lib', 'remoteBoundary.ts');
const useDailyPath = join(srcRoot, 'hooks', 'useDaily.ts');
const useStaticPath = join(srcRoot, 'hooks', 'useStatic.ts');
const useApiMutationPath = join(srcRoot, 'hooks', 'useApiMutation.ts');
const notesSyncClientPath = join(srcRoot, 'lib', 'notesSyncClient.ts');
const notesStorePath = join(srcRoot, 'store', 'useNotesStore.ts');
const vaultCloudExportPath = join(srcRoot, 'lib', 'vaultCloudExport.ts');
const vaultCloudRestorePath = join(srcRoot, 'lib', 'vaultCloudRestore.ts');
const prevWorkoutFetchPath = join(srcRoot, 'components', 'views', 'features', 'health', 'prevWorkoutFetch.ts');
const googleDriveBlobAdapterPath = join(srcRoot, 'lib', 'googleDriveBlobAdapter.ts');
const attachmentSyncQueuePath = join(srcRoot, 'lib', 'attachmentSyncQueue.ts');
const legacyAnalyticsPath = join(srcRoot, 'components', 'views', 'LegacyAnalyticsView.tsx');
const appLocalAuthTestPath = join(srcRoot, 'App.localAuth.test.ts');
const supabaseBoundaryTestPath = join(srcRoot, 'lib', 'supabaseBoundary.test.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectSourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path).flatMap(entry => {
    const child = join(path, entry);
    const stats = statSync(child);
    if (stats.isDirectory()) return collectSourceFiles(child);
    return /\.(ts|tsx)$/.test(entry) ? [child] : [];
  });
}

function toRepoPath(path: string): string {
  return relative(root, path).replace(/\\/g, '/');
}

describe('K-296 Supabase usage quota traffic risk source facts audit', () => {
  it('documents scope, source audit categories, risk matrix, K-297 path, and non-goals', () => {
    expect(existsSync(docPath)).toBe(true);
    const doc = read(docPath);

    [
      'docs/source audit plus audit test only',
      'no Supabase runtime behavior change',
      'no auth/session behavior change',
      'no sync behavior change',
      'no retry/polling behavior change',
      'no circuit breaker implementation',
      'no quota fallback implementation',
      'no Supabase config/env change',
      'no database/RLS/migration change',
      'Current Posture Summary',
      'Supabase Client Creation Audit',
      'Auth / Session Request Audit',
      'App Mount / Duplicate Request Audit',
      'Sync / Remote Data Audit',
      'Retry / Loop / Polling Audit',
      'Realtime / Subscription Audit',
      'Storage / Upload / Download Audit',
      'Unauthenticated Traffic Audit',
      'Rate Limit / Debounce / Throttle / Circuit Breaker Audit',
      'Usage Monitoring / Observability Audit',
      'Risk Matrix',
      'K-297 Supabase Usage / Traffic Control Plan',
      'Non-goals',
      'Closure Statement',
    ].forEach(expected => {
      expect(doc).toContain(expected);
    });
  });

  it('keeps referenced source evidence files present', () => {
    [
      k295DocPath,
      k91fDocPath,
      k91gDocPath,
      supabasePath,
      appPath,
      appContentPath,
      loginScreenPath,
      fetcherPath,
      remoteBoundaryPath,
      useDailyPath,
      useStaticPath,
      useApiMutationPath,
      notesSyncClientPath,
      notesStorePath,
      vaultCloudExportPath,
      vaultCloudRestorePath,
      prevWorkoutFetchPath,
      googleDriveBlobAdapterPath,
      attachmentSyncQueuePath,
      legacyAnalyticsPath,
      appLocalAuthTestPath,
      supabaseBoundaryTestPath,
    ].forEach(path => {
      expect(existsSync(path), path).toBe(true);
    });
  });

  it('asserts Supabase client creation and auth/session source facts', () => {
    const supabase = read(supabasePath);
    const app = read(appPath);
    const appContent = read(appContentPath);
    const login = read(loginScreenPath);
    const fetcher = read(fetcherPath);

    expect(supabase).toContain('createClient');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_URL');
    expect(supabase).toContain('import.meta.env.VITE_SUPABASE_ANON_KEY');
    expect(supabase).toContain('supabase.auth.getSession()');
    expect(supabase.toLowerCase()).not.toContain('service-role');
    expect(supabase.toLowerCase()).not.toContain('service_role');

    expect(app).toContain('supabase.auth.getSession()');
    expect(app).toContain('supabase.auth.onAuthStateChange');
    expect(app).toContain('subscription.unsubscribe()');
    expect(app).not.toContain('createLocalAuthUser');

    expect(appContent).toContain('await supabase.auth.signOut();');
    expect(login).toContain('supabase.auth.signInWithPassword');
    expect(login).toContain('supabase.auth.signUp');

    expect(fetcher).toContain('MAX_RETRIES = 3');
    expect(fetcher).toContain('RETRY_STATUSES');
    expect(fetcher).toContain('supabase.auth.refreshSession()');
    expect(fetcher).toContain('supabase.auth.signOut()');
  });

  it('asserts remote boundary, SWR focus policy, and changed-since note sync facts', () => {
    const remoteBoundary = read(remoteBoundaryPath);
    const daily = read(useDailyPath);
    const statics = read(useStaticPath);
    const notesSync = read(notesSyncClientPath);
    const prevWorkout = read(prevWorkoutFetchPath);

    expect(remoteBoundary).toContain('remoteSWRKey');
    expect(remoteBoundary).toContain('shouldUseRemoteData() ? key : null');

    expect(daily).toContain('remoteSWRKey');
    expect(daily).toContain('revalidateOnFocus: false');
    expect(statics).toContain('remoteSWRKey');
    expect(statics).toContain('revalidateOnFocus: false');

    expect(notesSync).toContain('updated_after=');
    expect(notesSync).toContain('NOTES_LAST_SYNC_KEY');
    expect(notesSync).toContain('fetchCompleteNotesFoldersSnapshot');
    expect(notesSync).not.toContain('fetchNotesFromCloud');
    expect(notesSync).not.toContain('fetchFoldersFromCloud');

    expect(prevWorkout).toContain('PREV_WORKOUT_FETCH_CONCURRENCY = 4');
    expect(prevWorkout).toContain('createConcurrencyPool');
  });

  it('asserts direct frontend Supabase table, storage, and realtime APIs are absent', () => {
    const source = collectSourceFiles(srcRoot)
      .map(path => ({ path: toRepoPath(path), text: read(path) }))
      .filter(file => !file.path.endsWith('.test.ts') && !file.path.endsWith('.test.tsx'));

    const directPatterns = [
      'supabase.from(',
      'supabase.storage',
      'storage.from(',
      'supabase.channel(',
    ];

    for (const pattern of directPatterns) {
      const matches = source.filter(file => file.text.includes(pattern)).map(file => file.path);
      expect(matches, pattern).toEqual([]);
    }
  });

  it('records storage/provider and monitoring gaps without implementing behavior', () => {
    const doc = read(docPath);
    const googleDrive = read(googleDriveBlobAdapterPath);
    const queue = read(attachmentSyncQueuePath);
    const legacyAnalytics = read(legacyAnalyticsPath);

    expect(googleDrive).toContain('GOOGLE_DRIVE_RESUMABLE_UPLOAD_URL');
    expect(googleDrive).toContain('supportsQuotaInfo: false');
    expect(queue).toContain('runAttachmentUploadQueue');
    expect(legacyAnalytics).toContain('refreshInterval: 60000');

    expect(doc).toContain('No client-side Supabase request counting');
    expect(doc).toContain('No circuit breaker was found');
    expect(doc).toContain('No `supabase.storage` usage found');
    expect(doc).toContain('No `supabase.channel(...)` usage found');
  });
});
