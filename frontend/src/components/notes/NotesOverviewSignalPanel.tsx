import type { CSSProperties, ReactElement } from 'react';
import type { NoteThemeBridge } from '../views/noteEditorTheme';
import { PixelDecorativeMark } from '../common/PixelDecorativeMark';

const RECENT_NOTE_LIMIT = 5;

type SignalPanelRecentNote = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt?: string;
  readonly createdAt?: string;
  readonly signalLabel: 'recent';
};

type SignalPanelActiveWriting = {
  readonly state: 'active' | 'idle' | 'unavailable';
  readonly currentNoteId?: string;
  readonly currentNoteTitle?: string;
  readonly lastEditedAt?: string;
};

type SignalPanelEmptyState = {
  readonly hasNotes: boolean;
  readonly noteCount?: number;
  readonly reason?: 'empty-vault' | 'ready' | 'unavailable';
};

type SignalPanelData = {
  readonly generatedFrom: 'local-note-metadata';
  readonly recentNotes: readonly SignalPanelRecentNote[];
  readonly activeWriting: SignalPanelActiveWriting;
  readonly emptyState: SignalPanelEmptyState;
};

type NotesOverviewSignalPanelProps = {
  readonly data: SignalPanelData;
  readonly theme: NoteThemeBridge;
};

type SignalPanelStyles = {
  readonly root: CSSProperties;
  readonly border: CSSProperties;
  readonly surface: CSSProperties;
  readonly mutedSurface: CSSProperties;
  readonly text: CSSProperties;
  readonly secondaryText: CSSProperties;
  readonly selectedSurface: CSSProperties;
  readonly unavailableSurface: CSSProperties;
};

function buildSignalPanelStyles(theme: NoteThemeBridge): SignalPanelStyles {
  const { semantic } = theme;
  // Light muted is a fill role and misses normal small-copy contrast. The pilot keeps
  // metadata at text contrast there while retaining muted hierarchy in dark mode.
  const secondaryText = theme.mode === 'light' ? semantic.text : semantic.mutedText;

  return {
    root: {
      backgroundColor: semantic.surfaceMuted,
      borderColor: semantic.border,
      color: semantic.text,
      fontFamily: theme.typography.fontFamily,
    },
    border: { borderColor: semantic.border },
    surface: {
      backgroundColor: semantic.surfaceElevated,
      borderColor: semantic.border,
    },
    mutedSurface: {
      backgroundColor: semantic.surfaceMuted,
      borderColor: semantic.border,
    },
    text: { color: semantic.text },
    secondaryText: { color: secondaryText },
    selectedSurface: {
      backgroundColor: semantic.selectedSurface,
      borderColor: semantic.selected,
    },
    unavailableSurface: {
      backgroundColor: semantic.surfaceMuted,
      borderColor: semantic.border,
      color: semantic.disabled,
    },
  };
}

function noteCountLabel(noteCount: number | undefined): string {
  if (typeof noteCount !== 'number') {
    return 'Local note count unavailable';
  }

  if (noteCount === 1) {
    return '1 local note';
  }

  return `${noteCount} local notes`;
}

function orientationSummary(data: SignalPanelData): string {
  if (!data.emptyState.hasNotes) {
    return 'Your vault is still quiet. The full empty-state surface remains the primary place to begin.';
  }

  if (data.activeWriting.state === 'active' && data.activeWriting.currentNoteTitle) {
    return `Current writing signal: ${data.activeWriting.currentNoteTitle}.`;
  }

  if (data.activeWriting.state === 'idle') {
    return 'Notes are available, with no active writing signal selected.';
  }

  return 'Notes are available, and the active writing signal is unavailable from safe local metadata.';
}

function activeWritingLabel(activeWriting: SignalPanelActiveWriting): string {
  if (activeWriting.state === 'active') {
    return activeWriting.currentNoteTitle ?? 'Active note available';
  }

  if (activeWriting.state === 'idle') {
    return 'No active writing signal right now';
  }

  return 'Active writing signal unavailable';
}

function activeWritingDescription(activeWriting: SignalPanelActiveWriting): string {
  if (activeWriting.state === 'active') {
    return activeWriting.lastEditedAt
      ? `Last edited ${activeWriting.lastEditedAt}.`
      : 'Current-note orientation is available from passed props.';
  }

  if (activeWriting.state === 'idle') {
    return 'Keep writing when a note becomes the current focus.';
  }

  return 'The component stays quiet instead of inventing editor state.';
}

export function NotesOverviewSignalPanel({
  data,
  theme,
}: NotesOverviewSignalPanelProps): ReactElement {
  const visibleRecentNotes = data.recentNotes.slice(0, RECENT_NOTE_LIMIT);
  const isEmptyVault = !data.emptyState.hasNotes;
  const styles = buildSignalPanelStyles(theme);
  const activeWritingSurface = data.activeWriting.state === 'active'
    ? styles.selectedSurface
    : data.activeWriting.state === 'unavailable'
      ? styles.unavailableSurface
      : styles.mutedSurface;

  return (
    <article
      className="notes-overview-signal-panel relative w-full max-w-full min-w-0 overflow-hidden rounded-lg border p-4"
      style={styles.root}
      aria-labelledby="notes-overview-signal-panel-title"
      data-notes-overview-signal-panel
      data-source={data.generatedFrom}
      data-recent-note-limit={RECENT_NOTE_LIMIT}
      data-notes-theme-mode={theme.mode}
      data-selected-authority="semantic"
      data-focus-authority="semantic"
      data-disabled-authority="semantic"
    >
      <PixelDecorativeMark variant="trace" className="absolute right-2 top-2" />
      <header className="max-w-full min-w-0 border-b pb-4" style={styles.border}>
        <p className="break-words text-xs font-semibold uppercase tracking-wide" style={styles.secondaryText}>
          Notes signal panel
        </p>
        <h2
          id="notes-overview-signal-panel-title"
          className="mt-1 break-words text-xl font-semibold"
          style={styles.text}
        >
          Notes Overview
        </h2>
        <p className="mt-2 max-w-3xl break-words text-sm leading-6" style={styles.secondaryText}>
          {orientationSummary(data)}
        </p>
        <p className="mt-2 break-words text-xs leading-5" style={styles.secondaryText}>
          Read-only local signal from {noteCountLabel(data.emptyState.noteCount)}.
        </p>
      </header>

      <div className="mt-4 grid max-w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section
          className="min-w-0 rounded-lg border p-3"
          style={styles.surface}
          aria-labelledby="notes-overview-signal-panel-recent"
        >
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words text-[11px] font-semibold uppercase tracking-wide" style={styles.secondaryText}>
                Recent signal
              </p>
              <h3
                id="notes-overview-signal-panel-recent"
                className="mt-1 break-words text-sm font-semibold"
                style={styles.text}
              >
                Recent notes
              </h3>
            </div>
            <span
              className="rounded border px-2 py-1 text-[11px] font-semibold"
              style={{ ...styles.mutedSurface, ...styles.secondaryText }}
            >
              Showing {visibleRecentNotes.length} of {data.recentNotes.length}
            </span>
          </div>

          {visibleRecentNotes.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {visibleRecentNotes.map(note => (
                <li
                  key={note.id}
                  className="min-w-0 rounded-md border p-2"
                  style={styles.mutedSurface}
                  data-recent-note-id={note.id}
                  data-signal-label={note.signalLabel}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <strong className="break-words text-sm" style={styles.text}>{note.title}</strong>
                    <span
                      className="rounded border px-1.5 py-0.5 text-[11px] font-semibold"
                      style={{ ...styles.surface, ...styles.secondaryText }}
                    >
                      Signal: recent
                    </span>
                  </div>
                  {note.updatedAt ? (
                    <p className="mt-1 break-words text-xs leading-5" style={styles.secondaryText}>
                      Updated {note.updatedAt}
                    </p>
                  ) : null}
                  {!note.updatedAt && note.createdAt ? (
                    <p className="mt-1 break-words text-xs leading-5" style={styles.secondaryText}>
                      Created {note.createdAt}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 break-words text-sm leading-6" style={styles.secondaryText}>
              Recent notes are unavailable from the passed local-note metadata.
            </p>
          )}
        </section>

        <section
          className="min-w-0 rounded-lg border p-3"
          style={styles.surface}
          aria-labelledby="notes-overview-signal-panel-active-writing"
          data-active-writing-state={data.activeWriting.state}
        >
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide" style={styles.secondaryText}>
            Writing signal
          </p>
          <h3
            id="notes-overview-signal-panel-active-writing"
            className="mt-1 break-words text-sm font-semibold"
            style={styles.text}
          >
            Active writing
          </h3>
          <div className="mt-3 rounded-md border p-3" style={activeWritingSurface}>
            <p className="break-words text-sm font-semibold" style={styles.text}>
              {activeWritingLabel(data.activeWriting)}
            </p>
            <p className="mt-1 break-words text-xs leading-5" style={styles.secondaryText}>
              State: {data.activeWriting.state}
            </p>
            <p className="mt-1 break-words text-xs leading-5" style={styles.secondaryText}>
              {activeWritingDescription(data.activeWriting)}
            </p>
          </div>
        </section>
      </div>

      {isEmptyVault ? (
        <section
          className="mt-4 rounded-lg border p-3"
          style={styles.surface}
          aria-labelledby="notes-overview-signal-panel-empty"
        >
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide" style={styles.secondaryText}>
            Empty readout
          </p>
          <h3
            id="notes-overview-signal-panel-empty"
            className="mt-1 break-words text-sm font-semibold"
            style={styles.text}
          >
            Empty vault
          </h3>
          <p className="mt-2 break-words text-sm leading-6" style={styles.secondaryText}>
            The full Notes empty state remains the primary onboarding surface. This panel only
            reports that no local note signal is available.
          </p>
        </section>
      ) : null}
    </article>
  );
}

export default NotesOverviewSignalPanel;
