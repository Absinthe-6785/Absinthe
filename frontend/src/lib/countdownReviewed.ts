const STORAGE_KEY = 'absinthe:countdown-reviewed';

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function isCountdownReviewed(noteId: string): boolean {
  return readSet().has(noteId);
}

export function markCountdownReviewed(noteId: string): void {
  const ids = readSet();
  ids.add(noteId);
  writeSet(ids);
}

export function unmarkCountdownReviewed(noteId: string): void {
  const ids = readSet();
  ids.delete(noteId);
  writeSet(ids);
}
