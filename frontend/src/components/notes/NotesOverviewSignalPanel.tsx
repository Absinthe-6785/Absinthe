import type { ReactElement } from 'react';

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
};

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
}: NotesOverviewSignalPanelProps): ReactElement {
  const visibleRecentNotes = data.recentNotes.slice(0, RECENT_NOTE_LIMIT);
  const isEmptyVault = !data.emptyState.hasNotes;

  return (
    <article
      className="notes-overview-signal-panel w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-900"
      aria-labelledby="notes-overview-signal-panel-title"
      data-notes-overview-signal-panel
      data-source={data.generatedFrom}
      data-recent-note-limit={RECENT_NOTE_LIMIT}
    >
      <header className="max-w-full min-w-0 border-b border-slate-200 pb-4">
        <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">
          Notes signal panel
        </p>
        <h2
          id="notes-overview-signal-panel-title"
          className="mt-1 break-words text-xl font-semibold text-slate-950"
        >
          Notes Overview
        </h2>
        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-700">
          {orientationSummary(data)}
        </p>
        <p className="mt-2 break-words text-xs leading-5 text-slate-600">
          Read-only local signal from {noteCountLabel(data.emptyState.noteCount)}.
        </p>
      </header>

      <div className="mt-4 grid max-w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section
          className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
          aria-labelledby="notes-overview-signal-panel-recent"
        >
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Recent signal
              </p>
              <h3
                id="notes-overview-signal-panel-recent"
                className="mt-1 break-words text-sm font-semibold text-slate-950"
              >
                Recent notes
              </h3>
            </div>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              Showing {visibleRecentNotes.length} of {data.recentNotes.length}
            </span>
          </div>

          {visibleRecentNotes.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {visibleRecentNotes.map(note => (
                <li
                  key={note.id}
                  className="min-w-0 rounded-md border border-slate-200 bg-slate-50/80 p-2"
                  data-recent-note-id={note.id}
                  data-signal-label={note.signalLabel}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <strong className="break-words text-sm text-slate-950">{note.title}</strong>
                    <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      Signal: recent
                    </span>
                  </div>
                  {note.updatedAt ? (
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                      Updated {note.updatedAt}
                    </p>
                  ) : null}
                  {!note.updatedAt && note.createdAt ? (
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                      Created {note.createdAt}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 break-words text-sm leading-6 text-slate-600">
              Recent notes are unavailable from the passed local-note metadata.
            </p>
          )}
        </section>

        <section
          className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
          aria-labelledby="notes-overview-signal-panel-active-writing"
          data-active-writing-state={data.activeWriting.state}
        >
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Writing signal
          </p>
          <h3
            id="notes-overview-signal-panel-active-writing"
            className="mt-1 break-words text-sm font-semibold text-slate-950"
          >
            Active writing
          </h3>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 p-3">
            <p className="break-words text-sm font-semibold text-slate-950">
              {activeWritingLabel(data.activeWriting)}
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-600">
              State: {data.activeWriting.state}
            </p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-600">
              {activeWritingDescription(data.activeWriting)}
            </p>
          </div>
        </section>
      </div>

      {isEmptyVault ? (
        <section
          className="mt-4 rounded-lg border border-slate-200 bg-white p-3"
          aria-labelledby="notes-overview-signal-panel-empty"
        >
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Empty readout
          </p>
          <h3
            id="notes-overview-signal-panel-empty"
            className="mt-1 break-words text-sm font-semibold text-slate-950"
          >
            Empty vault
          </h3>
          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            The full Notes empty state remains the primary onboarding surface. This panel only
            reports that no local note signal is available.
          </p>
        </section>
      ) : null}
    </article>
  );
}

export default NotesOverviewSignalPanel;
