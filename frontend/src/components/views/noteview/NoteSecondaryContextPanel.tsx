import type { NoteSecondaryContextPanelProps } from './NoteSecondaryContextPanelContract';
import { DiscoveryPanel } from '../features/knowledge/components/DiscoveryPanel';
import { TimelinePanel } from '../features/knowledge/components/TimelinePanel';
import { NoteRelationsPanel } from '../features/knowledge/components/NoteRelationsPanel';

/**
 * The one deferred Notes context-panel entry. Keep this dispatcher narrow so
 * the eager NoteView surface never needs to import any candidate presentation.
 */
export default function NoteSecondaryContextPanel({
  panel,
  panelProps,
}: NoteSecondaryContextPanelProps) {
  switch (panel) {
    case 'discover':
      return <DiscoveryPanel {...panelProps} />;
    case 'timeline':
      return <TimelinePanel {...panelProps} />;
    case 'relations':
      return <NoteRelationsPanel {...panelProps} />;
  }
}
