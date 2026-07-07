export const SIGNAL_PANEL_RECENT_NOTE_LIMIT = 5;

export type NotesOverviewSignalPanelAdapterNoteInput = {
  readonly id: string;
  readonly title?: string | null;
  readonly updatedAt?: string | number | null;
  readonly createdAt?: string | number | null;
  readonly deletedAt?: string | number | null;
  readonly starred?: boolean;
};

export type NotesOverviewSignalPanelAdapterInput = {
  readonly notes?: readonly NotesOverviewSignalPanelAdapterNoteInput[] | null;
  readonly activeNoteId?: string | null;
  readonly now?: number;
  readonly formatDateLabel?: (value: string | number) => string;
  readonly resolveUntitledTitle?: () => string;
};

export type NotesOverviewSignalPanelRecentNote = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt?: string;
  readonly createdAt?: string;
  readonly signalLabel: 'recent';
};

export type NotesOverviewSignalPanelActiveWriting = {
  readonly state: 'active' | 'idle' | 'unavailable';
  readonly currentNoteId?: string;
  readonly currentNoteTitle?: string;
  readonly lastEditedAt?: string;
};

export type NotesOverviewSignalPanelData = {
  readonly generatedFrom: 'local-note-metadata';
  readonly recentNotes: readonly NotesOverviewSignalPanelRecentNote[];
  readonly activeWriting: NotesOverviewSignalPanelActiveWriting;
  readonly emptyState: {
    readonly hasNotes: boolean;
    readonly noteCount?: number;
    readonly reason?: 'empty-vault' | 'ready' | 'unavailable';
  };
};

export type NotesOverviewSignalPanelAdapterOutput = {
  readonly data: NotesOverviewSignalPanelData;
};

type RankedNote = {
  readonly note: NotesOverviewSignalPanelAdapterNoteInput;
  readonly index: number;
  readonly sortTime: number | null;
};

function timestampValue(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasDeletedAt(value: string | number | null | undefined): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return typeof value === 'string' && value.trim().length > 0;
}

function resolveTitle(
  title: string | null | undefined,
  resolveUntitledTitle: (() => string) | undefined,
): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';

  if (trimmed && trimmed.toLowerCase() !== 'untitled') {
    return trimmed;
  }

  const fallback = resolveUntitledTitle?.().trim();
  return fallback || 'Untitled note';
}

function formatTimestamp(
  value: string | number | null | undefined,
  formatDateLabel: ((value: string | number) => string) | undefined,
): string | undefined {
  if (timestampValue(value) === null) {
    return undefined;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const formatted = formatDateLabel ? formatDateLabel(value) : String(value);
  const trimmed = formatted.trim();
  return trimmed || undefined;
}

function compareRankedNotes(a: RankedNote, b: RankedNote): number {
  if (a.sortTime !== null && b.sortTime !== null && a.sortTime !== b.sortTime) {
    return b.sortTime - a.sortTime;
  }

  if (a.sortTime !== null && b.sortTime === null) {
    return -1;
  }

  if (a.sortTime === null && b.sortTime !== null) {
    return 1;
  }

  return a.index - b.index;
}

function buildRecentNote(
  note: NotesOverviewSignalPanelAdapterNoteInput,
  input: NotesOverviewSignalPanelAdapterInput,
): NotesOverviewSignalPanelRecentNote {
  const updatedAt = formatTimestamp(note.updatedAt, input.formatDateLabel);
  const createdAt = updatedAt ? undefined : formatTimestamp(note.createdAt, input.formatDateLabel);

  return {
    id: note.id,
    title: resolveTitle(note.title, input.resolveUntitledTitle),
    ...(updatedAt ? { updatedAt } : {}),
    ...(createdAt ? { createdAt } : {}),
    signalLabel: 'recent',
  };
}

function buildActiveWriting(
  activeNote: NotesOverviewSignalPanelAdapterNoteInput | undefined,
  hasNotes: boolean,
  input: NotesOverviewSignalPanelAdapterInput,
): NotesOverviewSignalPanelActiveWriting {
  if (!hasNotes) {
    return { state: 'unavailable' };
  }

  if (!activeNote) {
    return { state: 'idle' };
  }

  const lastEditedAt = formatTimestamp(activeNote.updatedAt, input.formatDateLabel);

  return {
    state: 'active',
    currentNoteId: activeNote.id,
    currentNoteTitle: resolveTitle(activeNote.title, input.resolveUntitledTitle),
    ...(lastEditedAt ? { lastEditedAt } : {}),
  };
}

export function createNotesOverviewSignalPanelProps(
  input: NotesOverviewSignalPanelAdapterInput,
): NotesOverviewSignalPanelAdapterOutput {
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const visibleNotes = notes.filter(note => !hasDeletedAt(note.deletedAt));
  const rankedNotes = visibleNotes.map((note, index) => ({
    note,
    index,
    sortTime: timestampValue(note.updatedAt) ?? timestampValue(note.createdAt),
  }));

  const recentNotes = [...rankedNotes]
    .sort(compareRankedNotes)
    .slice(0, SIGNAL_PANEL_RECENT_NOTE_LIMIT)
    .map(({ note }) => buildRecentNote(note, input));

  const activeNote = input.activeNoteId
    ? visibleNotes.find(note => note.id === input.activeNoteId)
    : undefined;

  return {
    data: {
      generatedFrom: 'local-note-metadata',
      recentNotes,
      activeWriting: buildActiveWriting(activeNote, visibleNotes.length > 0, input),
      emptyState: {
        hasNotes: visibleNotes.length > 0,
        noteCount: visibleNotes.length,
        reason: visibleNotes.length > 0 ? 'ready' : 'empty-vault',
      },
    },
  };
}
