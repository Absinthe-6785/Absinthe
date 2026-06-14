export type {
  HistoryGrowthMetrics,
  KnowledgeActivitySummary,
  KnowledgeHistoryEvent,
  KnowledgeHistoryEventType,
  NoteHistoryContext,
} from './eventTypes';

export {
  HISTORY_SCHEMA_VERSION,
  KNOWLEDGE_HISTORY_STORAGE_KEY,
  MAX_HISTORY_EVENTS,
  appendKnowledgeHistoryEvent,
  clearKnowledgeHistory,
  loadKnowledgeHistoryEvents,
  loadKnowledgeHistoryPayload,
  saveKnowledgeHistoryEvents,
  subscribeKnowledgeHistory,
  trimEvents,
} from './historyStorage';

export {
  recordAreaAssigned,
  recordAreaRemoved,
  recordDiscoveryResolved,
  recordHubCreated,
  recordLinkChanges,
  recordLinkCreated,
  recordLinkRemoved,
  recordNoteCreated,
  recordNoteDeleted,
  recordNoteUpdateDiff,
  recordPropertyChanges,
} from './historyRecorder';

export {
  countEventsInWindow,
  getActivitySummary,
  getEventsByType,
  getEventsForNote,
  getEventsInWindow,
  getGrowthMetrics,
  getNoteHistoryContext,
  getRecentEvents,
  getRecentlyActiveAreaLabels,
  getRecentlyLinkedNoteIds,
  hasRecordedHistory,
} from './historyQueries';
