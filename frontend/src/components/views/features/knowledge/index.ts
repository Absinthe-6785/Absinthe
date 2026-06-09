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
  KnowledgeIndexService,
  knowledgeIndexService,
} from './KnowledgeIndexService';

export {
  getProperty,
  listProperties,
  normalizeNoteProperties,
  normalizePropertyKey,
  parseNoteMarkdown,
  removeProperty,
  serializeNoteMarkdown,
  setProperty,
} from './properties';

export { LinkedReferencesPanel, type LinkedReferencesPanelProps } from './components/LinkedReferencesPanel';
export { NotePropertiesPanel, type NotePropertiesPanelProps } from './components/NotePropertiesPanel';
