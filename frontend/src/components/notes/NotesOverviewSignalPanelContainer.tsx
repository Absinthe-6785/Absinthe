import { useMemo } from 'react';
import { createNotesOverviewSignalPanelProps, type NotesOverviewSignalPanelAdapterInput } from './notesOverviewSignalPanelAdapter';
import { NotesOverviewSignalPanel } from './NotesOverviewSignalPanel';
import { useNotesStore } from '../../store/useNotesStore';

type NotesOverviewSignalPanelStoreNote = {
  readonly id: string;
  readonly title?: string | null;
  readonly updatedAt?: string | number | null;
  readonly createdAt?: string | number | null;
  readonly deletedAt?: string | number | null;
  readonly starred?: boolean;
};

type NotesOverviewSignalPanelStoreState = {
  readonly notes: readonly NotesOverviewSignalPanelStoreNote[];
  readonly activeNoteId: string | null;
};

export function selectNotesOverviewSignalPanelInput(
  state: NotesOverviewSignalPanelStoreState,
): NotesOverviewSignalPanelAdapterInput {
  return {
    notes: state.notes.map(({ id, title, updatedAt, createdAt, deletedAt, starred }) => ({
      id,
      title,
      updatedAt,
      createdAt,
      deletedAt,
      starred,
    })),
    activeNoteId: state.activeNoteId,
  };
}

export function NotesOverviewSignalPanelContainer() {
  const notes = useNotesStore(state => state.notes);
  const activeNoteId = useNotesStore(state => state.activeNoteId);
  const adapterInput = useMemo(
    () => selectNotesOverviewSignalPanelInput({ notes, activeNoteId }),
    [notes, activeNoteId],
  );
  const panelProps = createNotesOverviewSignalPanelProps(adapterInput);

  return (
    <div
      data-testid="notes-overview-signal-panel-container"
      data-notes-overview-signal-panel-container
    >
      <NotesOverviewSignalPanel {...panelProps} />
    </div>
  );
}

export default NotesOverviewSignalPanelContainer;
