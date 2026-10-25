import { authFetch } from './supabase';
import { API_URL } from './config';
import { shouldUseDomainRemotePersistence } from './remoteBoundary';

const MIGRATION_KEY = 'absinthe:dday-migration-v1';

/**
 * Compatibility startup entry for legacy D-day migration, paused fail-closed.
 *
 * createNote/updateNote publish memory and start persistence but expose no
 * acknowledgement for the exact legacy row's replacement. A matching Event
 * Note or syncNoteToDB's generic boolean is not that proof. Until a separately
 * approved durable migration boundary exists, only read the legacy list:
 * never create/update Notes, delete originals, count rows as migrated, or
 * publish completion. The historical global flag is neither read as proof nor
 * rewritten; even an empty/current-account read cannot complete other accounts.
 */
export async function migrateLegacyDdays(
  _onMigrated?: (count: number) => void,
): Promise<number> {
  if (!shouldUseDomainRemotePersistence('planner_ddays')) return 0;

  try {
    const res = await authFetch(API_URL + '/api/schedules/ddays');
    if (!res.ok) return 0;
    const rows: unknown = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      // Fixed diagnostic only: no titles, dates, account ids or row ids.
      console.warn('legacy_dday_migration_blocked: replacement_durability_unverified; originals retained.');
    }
    return 0;
  } catch {
    // A failed/unknown read is not completion and cannot authorize cleanup.
    return 0;
  }
}

/** Test helper — reset the historical migration flag, not migration authority. */
export function resetDdayMigrationFlag(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(MIGRATION_KEY);
  }
}
