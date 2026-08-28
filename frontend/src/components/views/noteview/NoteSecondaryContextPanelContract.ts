import type { DiscoveryPanelProps } from '../features/knowledge/components/DiscoveryPanel';
import type { TimelinePanelProps } from '../features/knowledge/components/TimelinePanel';
import type { NoteRelationsPanelProps } from '../features/knowledge/components/NoteRelationsPanel';

export type SecondaryContextPanel = 'discover' | 'timeline' | 'relations';

export type NoteSecondaryContextPanelProps =
  | { panel: 'discover'; panelProps: DiscoveryPanelProps }
  | { panel: 'timeline'; panelProps: TimelinePanelProps }
  | { panel: 'relations'; panelProps: NoteRelationsPanelProps };
