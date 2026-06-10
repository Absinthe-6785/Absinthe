import {
  isWorkspaceItemKind,
  type WorkspaceItemKind,
  type WorkspaceRef,
} from './workspaceModels';

/** Pinned workspace reference — array order defines pin order */
export type PinnedWorkspaceRef = WorkspaceRef;

export interface RecentWorkEntry {
  workspace: WorkspaceRef;
  lastOpenedAt: number;
}

export interface WorkspacePreferences {
  pinned: PinnedWorkspaceRef[];
  recent: RecentWorkEntry[];
}

export const DEFAULT_MAX_RECENT = 20;

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  pinned: [],
  recent: [],
};

export function workspaceRefKey(kind: WorkspaceItemKind, id: string): string {
  return `${kind}:${id.trim()}`;
}

function normalizeWorkspaceRef(raw: unknown): WorkspaceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<WorkspaceRef>;
  if (!isWorkspaceItemKind(record.kind)) return null;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!id || !name) return null;
  const ref: WorkspaceRef = { kind: record.kind, id, name };
  if (typeof record.subtitle === 'string' && record.subtitle.trim()) {
    ref.subtitle = record.subtitle.trim();
  }
  if (typeof record.count === 'number' && Number.isFinite(record.count)) {
    ref.count = record.count;
  }
  return ref;
}

function dedupePinned(pinned: readonly PinnedWorkspaceRef[]): PinnedWorkspaceRef[] {
  const seen = new Set<string>();
  const next: PinnedWorkspaceRef[] = [];
  for (const ref of pinned) {
    const key = workspaceRefKey(ref.kind, ref.id);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(ref);
  }
  return next;
}

export function normalizeWorkspacePreferences(raw: unknown): WorkspacePreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WORKSPACE_PREFERENCES };
  }
  const record = raw as Partial<WorkspacePreferences>;
  const pinned = dedupePinned(
    Array.isArray(record.pinned)
      ? record.pinned.map(normalizeWorkspaceRef).filter((ref): ref is WorkspaceRef => ref !== null)
      : [],
  );
  const recent: RecentWorkEntry[] = [];
  if (Array.isArray(record.recent)) {
    for (const item of record.recent) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Partial<RecentWorkEntry>;
      const workspace = normalizeWorkspaceRef(entry.workspace);
      const lastOpenedAt = typeof entry.lastOpenedAt === 'number' && Number.isFinite(entry.lastOpenedAt)
        ? entry.lastOpenedAt
        : null;
      if (!workspace || lastOpenedAt === null) continue;
      recent.push({ workspace, lastOpenedAt });
    }
  }
  return { pinned, recent: dedupeRecent(recent) };
}

function dedupeRecent(recent: readonly RecentWorkEntry[]): RecentWorkEntry[] {
  const seen = new Set<string>();
  const next: RecentWorkEntry[] = [];
  for (const entry of recent) {
    const key = workspaceRefKey(entry.workspace.kind, entry.workspace.id);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(entry);
  }
  return next;
}

export function isWorkspacePinned(
  prefs: WorkspacePreferences,
  kind: WorkspaceItemKind,
  id: string,
): boolean {
  const key = workspaceRefKey(kind, id);
  return prefs.pinned.some(ref => workspaceRefKey(ref.kind, ref.id) === key);
}

export function addPinnedWorkspace(
  prefs: WorkspacePreferences,
  ref: WorkspaceRef,
): WorkspacePreferences {
  const key = workspaceRefKey(ref.kind, ref.id);
  const without = prefs.pinned.filter(item => workspaceRefKey(item.kind, item.id) !== key);
  return {
    ...prefs,
    pinned: [...without, {
      kind: ref.kind,
      id: ref.id,
      name: ref.name,
      ...(ref.subtitle ? { subtitle: ref.subtitle } : {}),
    }],
  };
}

export function removePinnedWorkspace(
  prefs: WorkspacePreferences,
  kind: WorkspaceItemKind,
  id: string,
): WorkspacePreferences {
  const key = workspaceRefKey(kind, id);
  return {
    ...prefs,
    pinned: prefs.pinned.filter(ref => workspaceRefKey(ref.kind, ref.id) !== key),
  };
}

export function reorderPinnedWorkspaces(
  prefs: WorkspacePreferences,
  fromIndex: number,
  toIndex: number,
): WorkspacePreferences {
  if (fromIndex === toIndex) return prefs;
  if (fromIndex < 0 || toIndex < 0) return prefs;
  if (fromIndex >= prefs.pinned.length || toIndex >= prefs.pinned.length) return prefs;
  const pinned = [...prefs.pinned];
  const [moved] = pinned.splice(fromIndex, 1);
  pinned.splice(toIndex, 0, moved);
  return { ...prefs, pinned };
}

export function togglePinnedWorkspace(
  prefs: WorkspacePreferences,
  ref: WorkspaceRef,
): WorkspacePreferences {
  return isWorkspacePinned(prefs, ref.kind, ref.id)
    ? removePinnedWorkspace(prefs, ref.kind, ref.id)
    : addPinnedWorkspace(prefs, ref);
}

export function recordRecentWorkspace(
  prefs: WorkspacePreferences,
  ref: WorkspaceRef,
  maxSize = DEFAULT_MAX_RECENT,
  openedAt = Date.now(),
): WorkspacePreferences {
  const key = workspaceRefKey(ref.kind, ref.id);
  const without = prefs.recent.filter(entry => workspaceRefKey(entry.workspace.kind, entry.workspace.id) !== key);
  const entry: RecentWorkEntry = {
    workspace: {
      kind: ref.kind,
      id: ref.id,
      name: ref.name,
      ...(ref.subtitle ? { subtitle: ref.subtitle } : {}),
    },
    lastOpenedAt: openedAt,
  };
  const recent = [entry, ...without].slice(0, Math.max(1, maxSize));
  return { ...prefs, recent };
}

export function clearRecentWork(prefs: WorkspacePreferences): WorkspacePreferences {
  return { ...prefs, recent: [] };
}

export function pruneWorkspacePreferences(
  prefs: WorkspacePreferences,
  isValidRef: (kind: WorkspaceItemKind, id: string) => boolean,
): WorkspacePreferences {
  return {
    pinned: prefs.pinned.filter(ref => isValidRef(ref.kind, ref.id)),
    recent: prefs.recent.filter(entry => isValidRef(entry.workspace.kind, entry.workspace.id)),
  };
}
