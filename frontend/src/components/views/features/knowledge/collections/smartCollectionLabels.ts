import type { TranslationKey } from '@/lib/i18n';
import type { SmartCollection, SmartCollectionId } from './smartCollectionModels';

/** System presets — localized via i18n. Subject workspaces keep stored `name`. */
const SYSTEM_NAME_KEYS: Partial<Record<SmartCollectionId, TranslationKey>> = {
  recent: 'k108ScRecent',
  orphan: 'k108ScOrphan',
  untagged: 'k108ScUntagged',
  'highly-connected': 'k108ScHighlyConnected',
  'with-backlinks': 'k108ScWithBacklinks',
  'with-mentions': 'k108ScWithMentions',
  'research-sources': 'k108ScSources',
  'research-literature': 'k108ScLiterature',
  'research-permanent': 'k108ScPermanent',
  'exam-study-notes': 'k108ScLearningNotes',
  'exam-weak-topics': 'k108ScWeakTopics',
  'exam-review-notes': 'k108ScReviewNotes',
  'exam-prep': 'k108ScExamPrep',
  'map-concepts': 'k108ScConceptNotes',
  'academic-study-projects': 'k108ScStudyProjects',
  'academic-active-projects': 'k108ScActiveProjects',
  'academic-completed-projects': 'k108ScCompletedProjects',
  'academic-milestones': 'k108ScMilestones',
};

export const SMART_COLLECTION_GROUP_LABEL_KEYS: Record<string, TranslationKey> = {
  knowledge: 'k108ScGroupKnowledge',
  study: 'k108ScGroupStudy',
  projects: 'k108ScGroupProjects',
  subjects: 'k108ScGroupSubjects',
  insights: 'k108ScGroupInsights',
};

export function isUserNamedSmartCollection(id: SmartCollectionId): boolean {
  return id.startsWith('subject-');
}

export function resolveSmartCollectionName(
  collection: SmartCollection,
  t: (key: TranslationKey) => string,
): string {
  if (isUserNamedSmartCollection(collection.id)) return collection.name;
  const key = SYSTEM_NAME_KEYS[collection.id];
  return key ? t(key) : collection.name;
}

export function resolveSmartCollectionGroupLabel(
  groupId: string,
  fallback: string,
  t: (key: TranslationKey) => string,
): string {
  const key = SMART_COLLECTION_GROUP_LABEL_KEYS[groupId];
  return key ? t(key) : fallback;
}
