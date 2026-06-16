import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { NoteTagBrowser } from './NoteTagBrowser';

export interface NoteTagsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onOpenProperties: () => void;
}

/** Tags tab shell — browse and filter only; edit in Properties (K-90A2). */
export function NoteTagsPanel(props: NoteTagsPanelProps) {
  return <NoteTagBrowser {...props} />;
}
