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
    notes: state.notes.map(selectNotesOverviewSignalPanelMetadata),
    activeNoteId: state.activeNoteId,
  };
}

function selectNotesOverviewSignalPanelMetadata({
  id,
  title,
  updatedAt,
  createdAt,
  deletedAt,
  starred,
}: NotesOverviewSignalPanelStoreNote): NotesOverviewSignalPanelStoreNote {
  return {
    id,
    title,
    updatedAt,
    createdAt,
    deletedAt,
    starred,
  };
}

function noteMatchesSignalPanelMetadata(
  note: NotesOverviewSignalPanelStoreNote,
  metadata: NotesOverviewSignalPanelStoreNote,
): boolean {
  return (
    note.id === metadata.id &&
    note.title === metadata.title &&
    Object.is(note.updatedAt, metadata.updatedAt) &&
    Object.is(note.createdAt, metadata.createdAt) &&
    Object.is(note.deletedAt, metadata.deletedAt) &&
    note.starred === metadata.starred
  );
}

function notesMatchSignalPanelMetadata(
  notes: readonly NotesOverviewSignalPanelStoreNote[],
  metadata: readonly NotesOverviewSignalPanelStoreNote[],
): boolean {
  return notes.length === metadata.length && notes.every((note, index) => {
    const previous = metadata[index];
    return previous ? noteMatchesSignalPanelMetadata(note, previous) : false;
  });
}

export function createNotesOverviewSignalPanelInputSelector() {
  let previousInput: NotesOverviewSignalPanelAdapterInput | null = null;

  return (state: NotesOverviewSignalPanelStoreState): NotesOverviewSignalPanelAdapterInput => {
    if (
      previousInput &&
      previousInput.activeNoteId === state.activeNoteId &&
      notesMatchSignalPanelMetadata(state.notes, previousInput.notes ?? [])
    ) {
      return previousInput;
    }

    previousInput = selectNotesOverviewSignalPanelInput(state);
    return previousInput;
  };
}

export function NotesOverviewSignalPanelContainer() {
  const selectSignalPanelInput = useMemo(
    () => createNotesOverviewSignalPanelInputSelector(),
    [],
  );
  const adapterInput = useNotesStore(selectSignalPanelInput);
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
