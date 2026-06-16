import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { ConceptRelationsBrowse } from './ConceptRelationsBrowse';

export interface ConceptRelationsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  notes: readonly NoteBase[];
  onNavigateToNote: (noteId: string) => void;
  onOpenRelations: () => void;
}

/** Links → Structure shell — browse only; edit in Relations tab (K-90A3). */
export function ConceptRelationsPanel(props: ConceptRelationsPanelProps) {
  return <ConceptRelationsBrowse {...props} />;
}
