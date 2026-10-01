export type HomeWorkoutCounts = Readonly<{
  exerciseCount: number; setCount: number; doneCount: number;
}>;

export type HomeWorkoutDraftRead = Readonly<{ accountId: string; localDate: string }> & (
  | Readonly<{ status: 'absent' | 'unavailable' }>
  | Readonly<{ status: 'present'; counts: HomeWorkoutCounts }>
);

/** Validate only summary inputs. Never repair, hydrate, normalize or remove bytes. */
export function readHomeWorkoutDraft(
  storage: Pick<Storage, 'getItem'>, accountId: string, localDate: string,
): HomeWorkoutDraftRead {
  const scope = { accountId, localDate };
  try {
    const raw = storage.getItem(`healthDraft:${accountId}:${localDate}`);
    if (raw === null) return { ...scope, status: 'absent' };
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows)) return { ...scope, status: 'unavailable' };
    if (!rows.length) return { ...scope, status: 'absent' };
    let exerciseCount = 0, setCount = 0, doneCount = 0;
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof row.block_id !== 'string'
        || !row.block_id.trim() || !Array.isArray(row.sets)) return { ...scope, status: 'unavailable' };
      if (row.block_id === '__session__') continue;
      exerciseCount += 1;
      for (const set of row.sets) {
        if (!set || typeof set !== 'object' || typeof set.done !== 'boolean') {
          return { ...scope, status: 'unavailable' };
        }
        setCount += 1;
        if (set.done) doneCount += 1;
      }
    }
    return { ...scope, status: 'present', counts: { exerciseCount, setCount, doneCount } };
  } catch {
    return { ...scope, status: 'unavailable' };
  }
}
