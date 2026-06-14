export type KnowledgeHistoryEventType =
  | 'NOTE_CREATED'
  | 'NOTE_DELETED'
  | 'LINK_CREATED'
  | 'LINK_REMOVED'
  | 'AREA_ASSIGNED'
  | 'AREA_REMOVED'
  | 'HUB_CREATED'
  | 'DISCOVERY_RESOLVED';

export interface KnowledgeHistoryEvent {
  id: string;
  type: KnowledgeHistoryEventType;
  timestamp: number;
  noteId: string;
  relatedNoteId?: string;
  areaId?: string;
  metadata?: Record<string, string>;
}

export interface KnowledgeActivitySummary {
  periodDays: number;
  notesCreated: number;
  linksCreated: number;
  hubsCreated: number;
  discoveriesResolved: number;
  notesDeleted: number;
  linksRemoved: number;
}

export interface NoteHistoryContext {
  firstSeenAt: number | null;
  lastLinkedAt: number | null;
  lastMajorUpdateAt: number | null;
  activityScore: number;
}

export interface HistoryGrowthMetrics {
  notesCreated: number;
  linksCreated: number;
  areasCreated: number;
  hubsCreated: number;
  discoveriesResolved: number;
}
