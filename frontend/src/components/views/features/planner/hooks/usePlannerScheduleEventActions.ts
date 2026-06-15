import { useCallback, useState } from 'react';
import { useNotesStore } from '../../../../../store/useNotesStore';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import {
  applyEventToNote,
  clearEventFromNote,
  eventFormValuesFromNote,
  toDateKey,
  type EventFormValues,
} from '../../knowledge';
import type { TranslationKey } from '../../../../../lib/i18n';
import type { AgendaEventActions } from '../calendar-ui/day/dayScheduleActions';

export interface PlannerEventDialogState {
  mode: 'create' | 'edit';
  noteId?: string;
  initialValues: EventFormValues;
}

export interface UsePlannerScheduleEventActionsOptions {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (msg: string, onConfirm: () => void, opts?: { confirmLabel?: string; variant?: 'primary' | 'destructive' }) => void;
  t: (key: TranslationKey) => string;
}

export function usePlannerScheduleEventActions({
  showToast,
  showConfirm,
  t,
}: UsePlannerScheduleEventActionsOptions) {
  const updateNote = useNotesStore(s => s.updateNote);
  const createNote = useNotesStore(s => s.createNote);
  const notes = useNotesStore(s => s.notes);

  const [eventDialog, setEventDialog] = useState<PlannerEventDialogState | null>(null);

  const openEditEvent = useCallback((noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setEventDialog({
      mode: 'edit',
      noteId,
      initialValues: eventFormValuesFromNote(note, toDateKey(new Date())),
    });
  }, [notes]);

  const handleEventDialogSave = useCallback((values: EventFormValues) => {
    if (!eventDialog) return;

    if (eventDialog.mode === 'create') {
      const id = createNote({ title: values.title.trim() || 'Untitled', body: '' });
      const created = useNotesStore.getState().notes.find(n => n.id === id);
      if (created) {
        const withEvent = applyEventToNote(created, values);
        updateNote(id, { title: withEvent.title, properties: withEvent.properties });
      }
    } else if (eventDialog.noteId) {
      const note = useNotesStore.getState().notes.find(n => n.id === eventDialog.noteId);
      if (note) {
        const withEvent = applyEventToNote(note, values);
        updateNote(note.id, { title: withEvent.title, properties: withEvent.properties });
      }
    }

    setEventDialog(null);
    showToast(t('scheduleSaved'), 'success');
  }, [eventDialog, createNote, updateNote, showToast, t]);

  const handleRemoveEventStatus = useCallback(() => {
    if (!eventDialog?.noteId) return;
    const note = useNotesStore.getState().notes.find(n => n.id === eventDialog.noteId);
    if (!note) return;
    const cleared = clearEventFromNote(note);
    updateNote(note.id, { properties: cleared.properties });
    setEventDialog(null);
    showToast(t('deleted'), 'success');
  }, [eventDialog, updateNote, showToast, t]);

  const duplicateEventNote = useCallback((noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    const values = eventFormValuesFromNote(note, toDateKey(new Date()));
    const id = createNote({
      title: `${displayNoteTitle(note.title)} (copy)`,
      body: note.body ?? '',
    });
    const created = useNotesStore.getState().notes.find(n => n.id === id);
    if (created) {
      const withEvent = applyEventToNote(created, values);
      updateNote(id, { title: withEvent.title, properties: withEvent.properties });
    }
    showToast(t('scheduleSaved'), 'success');
  }, [notes, createNote, updateNote, showToast, t]);

  const deleteEventNote = useCallback((noteId: string) => {
    showConfirm(t('eventRemoveStatus'), () => {
      const note = useNotesStore.getState().notes.find(n => n.id === noteId);
      if (!note) return;
      const cleared = clearEventFromNote(note);
      updateNote(note.id, { properties: cleared.properties });
      showToast(t('deleted'), 'success');
    }, { confirmLabel: t('deleteLabel') });
  }, [showConfirm, updateNote, showToast, t]);

  const agendaEventActions: AgendaEventActions = {
    onEdit: openEditEvent,
    onDelete: deleteEventNote,
    onDuplicate: duplicateEventNote,
  };

  return {
    eventDialog,
    setEventDialog,
    agendaEventActions,
    handleEventDialogSave,
    handleRemoveEventStatus,
  };
}
