import { afterEach, describe, expect, it, vi } from 'vitest';

const imports = [
  ['local reader authority', () => import('./workoutLocalReaderAuthority')],
  ['range reader', () => import('./workoutRangeReader')],
  ['range snapshot', () => import('../components/views/features/health/verifiedWorkoutRangeSnapshot')],
  ['selected-day reader', () => import('./workoutSelectedDayReader')],
] as const;

afterEach(() => {
  vi.doUnmock('@supabase/supabase-js');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('dormant Workout first-import boundary', () => {
  it.each(imports)('imports %s without auth, listeners, network or local source I/O', async (_name, importModule) => {
    // No source module is statically imported: reset and install every spy first.
    vi.resetModules();
    const createClient = vi.fn(() => ({}));
    vi.doMock('@supabase/supabase-js', () => ({ createClient }));
    const windowListener = vi.fn();
    const documentListener = vi.fn();
    const fetch = vi.fn();
    const openDatabase = vi.fn(() => { throw new Error('unexpected_import_database_open'); });
    const readStorage = vi.fn(() => null);
    const writeStorage = vi.fn();
    const randomUUID = vi.fn();
    const localStorage = { getItem: readStorage, setItem: writeStorage, removeItem: vi.fn() };
    vi.stubGlobal('window', { addEventListener: windowListener, localStorage });
    vi.stubGlobal('document', { addEventListener: documentListener, visibilityState: 'visible' });
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('indexedDB', { open: openDatabase });
    vi.stubGlobal('crypto', { randomUUID });

    await importModule();

    expect(createClient).not.toHaveBeenCalled();
    expect(windowListener).not.toHaveBeenCalled();
    expect(documentListener).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();
    expect(readStorage).not.toHaveBeenCalled();
    expect(writeStorage).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
  });
});
