import type { NoteBase } from '../../noteUtils';
import { displayNoteTitle } from '../../noteDisplayTitle';
import { serializeIdWikiLink, type WikiTarget } from '../../wikiLinks';

export type CopyAuthorizedNoteLinkResult = 'copied' | 'stale' | 'unavailable' | 'failed';

interface CopyAuthorizedNoteLinkParams {
  activeNoteId: string | null;
  targets: readonly WikiTarget[];
  getCurrentState: () => { activeNoteId: string | null; notes: readonly NoteBase[] };
  writeText?: (text: string) => Promise<void>;
}

/** Copies an ID-bound link only while the rendered authorized publication is still current. */
export async function copyAuthorizedNoteLink({
  activeNoteId,
  targets,
  getCurrentState,
  writeText,
}: CopyAuthorizedNoteLinkParams): Promise<CopyAuthorizedNoteLinkResult> {
  const target = targets.find(candidate => typeof candidate !== 'string' && candidate.id === activeNoteId);
  if (!activeNoteId || !target || typeof target === 'string') return 'stale';

  const resolveCurrentNote = () => {
    if (!target.isCurrent()) return null;
    const state = getCurrentState();
    if (state.activeNoteId !== activeNoteId) return null;
    const note = state.notes.find(candidate => candidate.id === activeNoteId && !candidate.deletedAt);
    return note && target.isCurrent() ? note : null;
  };

  const note = resolveCurrentNote();
  if (!note) return 'stale';
  if (!writeText) return 'unavailable';

  try {
    await writeText(serializeIdWikiLink(note.id, displayNoteTitle(note.title)));
  } catch {
    return 'failed';
  }

  return resolveCurrentNote() ? 'copied' : 'stale';
}
