export {
  buildBacklinkIndex,
  getBacklinkCount,
  getIncomingLinks,
  getOutgoingLinks,
  getPageReferences,
  resolveBacklinkNavigation,
  type BacklinkIndex,
  type IncomingLinksOptions,
  type OutgoingReference,
  type PageReference,
} from './backlinks';

export {
  bodyHasWikiLinkToTitle,
  bodyTextWithoutWikiLinks,
  buildTitleMentionRegex,
  containsWholeWordMention,
  extractMentionContexts,
  findMentionInText,
  hasUnlinkedMention,
} from './mentions';

export type { MentionLookupOptions, RelatedNote } from './KnowledgeIndexService';

export {
  KnowledgeIndexService,
  knowledgeIndexService,
} from './KnowledgeIndexService';

export {
  getProperty,
  listProperties,
  listUserProperties,
  normalizeNoteProperties,
  normalizePropertyKey,
  parseNoteMarkdown,
  removeProperty,
  serializeNoteMarkdown,
  setProperty,
} from './properties';

export {
  addTag,
  hasTag,
  listTags,
  noteMatchesPageTag,
  normalizeTagName,
  removeTag,
  renameTag,
  setTags,
  TAGS_PROPERTY_KEY,
} from './tags';

export { LinkedReferencesPanel, type LinkedReferencesPanelProps } from './components/LinkedReferencesPanel';
export { NotePropertiesPanel, type NotePropertiesPanelProps } from './components/NotePropertiesPanel';
export { RelatedNotesPanel, type RelatedNotesPanelProps } from './components/RelatedNotesPanel';
export { NoteTagsPanel, type NoteTagsPanelProps } from './components/NoteTagsPanel';

export {
  buildLocalGraphData,
  LocalGraphView,
  type BuildLocalGraphInput,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type GraphRelationshipType,
  type LocalGraphViewProps,
} from './graph';

export {
  computeRelatedScore,
  formatRelatedReasons,
  RELATED_SCORE,
  type RelatedReason,
  type RelatedScoreBreakdown,
  type RelatedScoreInput,
} from './related';
