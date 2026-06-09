export type {
  ExplicitGraphRelationshipType,
  RelationAuthoringInput,
  RelationEdge,
  RelationQueryClause,
  RelationRecord,
  RelationRollupAggregate,
  RelationRollupConfig,
  ResolvedRelationTarget,
} from './relationModels';
export { isRelationEdge, isRelationRecord } from './relationModels';
export {
  addRelationTarget,
  getRelationTargets,
  hasRelations,
  listRelationKeys,
  listRelationRecords,
  removeRelationTarget,
  setRelationTargets,
} from './noteRelations';
export {
  mergeRelationMaps,
  normalizeNoteRelations,
  normalizeRelationPropertyKey,
  relationEdgeKey,
  toRelationEdges,
  toRelationRecords,
} from './relationNormalize';
export {
  parseRelationsFrontmatter,
  serializeRelationsFrontmatter,
} from './relationMarkdown';
