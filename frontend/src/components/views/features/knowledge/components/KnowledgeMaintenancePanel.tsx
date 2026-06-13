import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeHealthMetrics } from '../review/knowledgeHealth';
import type { ReviewQueueEntry } from '../review/reviewQueue';
import type { StaleNotesBuckets } from '../review/staleNotes';
import type { ReviewNoteEntry } from '../review/buildKnowledgeReview';
import { KnowledgeHealthPanel } from './KnowledgeHealthPanel';
import { StaleNotesPanel } from './StaleNotesPanel';
import { OrphanNotesPanel } from './OrphanNotesPanel';
import { ReviewQueuePanel } from './ReviewQueuePanel';

export interface KnowledgeMaintenanceData {
  health: KnowledgeHealthMetrics;
  stale: StaleNotesBuckets;
  orphans: ReviewNoteEntry[];
  queue: ReviewQueueEntry[];
}

export interface KnowledgeMaintenancePanelProps {
  colors: NoteChromeColors;
  data: KnowledgeMaintenanceData;
  onNavigateToNote: (noteId: string) => void;
}

/** K-30.42 review & maintenance surfaces on workspace dashboard. */
export function KnowledgeMaintenancePanel({
  colors: c,
  data,
  onNavigateToNote,
}: KnowledgeMaintenancePanelProps) {
  return (
    <div className="be-knowledge-maintenance" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <KnowledgeHealthPanel colors={c} metrics={data.health} compact />
      <ReviewQueuePanel colors={c} queue={data.queue} onNavigateToNote={onNavigateToNote} compact />
      <StaleNotesPanel colors={c} buckets={data.stale} onNavigateToNote={onNavigateToNote} compact />
      <OrphanNotesPanel colors={c} orphans={data.orphans} onNavigateToNote={onNavigateToNote} compact />
    </div>
  );
}
