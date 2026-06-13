import type { LucideIcon } from 'lucide-react';
import {
  Sparkles,
  BookOpen,
  FileText,
  Bookmark,
  Lightbulb,
  GraduationCap,
  Star,
  AlertCircle,
  ClipboardList,
  Target,
  Flag,
  FolderKanban,
  Orbit,
  Compass,
  Globe,
  Languages,
  BookMarked,
} from 'lucide-react';
import type { SmartCollectionId } from './smartCollectionModels';

export interface SmartCollectionGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  /** All collection IDs in this group — unchanged for stored workspace state. */
  collectionIds: readonly SmartCollectionId[];
  /** Primary entry points — always visible. */
  primaryCollectionIds: readonly SmartCollectionId[];
  /** Secondary collections — collapsed by default. */
  secondaryCollectionIds: readonly SmartCollectionId[];
}

/** Visual IA grouping — collection IDs unchanged for stored workspace state. */
export const SMART_COLLECTION_GROUPS: readonly SmartCollectionGroup[] = [
  {
    id: 'knowledge',
    label: '지식',
    icon: Sparkles,
    collectionIds: [
      'research-sources',
      'research-literature',
      'research-permanent',
      'map-concepts',
      'recent',
      'orphan',
      'untagged',
      'with-backlinks',
      'with-mentions',
    ],
    primaryCollectionIds: ['research-sources', 'map-concepts', 'recent'],
    secondaryCollectionIds: [
      'research-literature',
      'research-permanent',
      'orphan',
      'untagged',
      'with-backlinks',
      'with-mentions',
    ],
  },
  {
    id: 'study',
    label: '학습',
    icon: GraduationCap,
    collectionIds: [
      'exam-study-notes',
      'exam-weak-topics',
      'exam-prep',
      'exam-review-notes',
    ],
    primaryCollectionIds: ['exam-study-notes', 'exam-weak-topics'],
    secondaryCollectionIds: ['exam-prep', 'exam-review-notes'],
  },
  {
    id: 'projects',
    label: '프로젝트',
    icon: Orbit,
    collectionIds: [
      'academic-active-projects',
      'academic-milestones',
      'academic-study-projects',
      'academic-completed-projects',
    ],
    primaryCollectionIds: ['academic-active-projects', 'academic-milestones'],
    secondaryCollectionIds: ['academic-study-projects', 'academic-completed-projects'],
  },
  {
    id: 'subjects',
    label: '주제',
    icon: Compass,
    collectionIds: [
      'subject-japanese-history',
      'subject-politics',
      'subject-economics',
      'subject-toefl',
      'subject-vocabulary',
    ],
    primaryCollectionIds: [
      'subject-japanese-history',
      'subject-politics',
      'subject-economics',
      'subject-toefl',
      'subject-vocabulary',
    ],
    secondaryCollectionIds: [],
  },
  {
    id: 'insights',
    label: '인사이트',
    icon: Star,
    collectionIds: ['highly-connected'],
    primaryCollectionIds: ['highly-connected'],
    secondaryCollectionIds: [],
  },
];

/** Top-level primary collection categories — one per group. */
export const PRIMARY_COLLECTION_GROUP_IDS = SMART_COLLECTION_GROUPS.map(g => g.id);

const COLLECTION_ICONS: Partial<Record<SmartCollectionId, LucideIcon>> = {
  'research-sources': BookOpen,
  'research-literature': FileText,
  'research-permanent': Bookmark,
  'map-concepts': Lightbulb,
  recent: Sparkles,
  orphan: AlertCircle,
  untagged: FolderKanban,
  'with-backlinks': Compass,
  'with-mentions': Globe,
  'exam-study-notes': GraduationCap,
  'exam-weak-topics': AlertCircle,
  'exam-prep': ClipboardList,
  'exam-review-notes': Star,
  'academic-active-projects': Target,
  'academic-milestones': Flag,
  'academic-study-projects': Orbit,
  'academic-completed-projects': Bookmark,
  'subject-japanese-history': BookMarked,
  'subject-politics': Globe,
  'subject-economics': Compass,
  'subject-toefl': Languages,
  'subject-vocabulary': BookOpen,
  'highly-connected': Star,
};

export function getSmartCollectionIcon(id: SmartCollectionId): LucideIcon {
  return COLLECTION_ICONS[id] ?? Sparkles;
}

export function getSmartCollectionGroup(id: SmartCollectionId): SmartCollectionGroup | undefined {
  return SMART_COLLECTION_GROUPS.find(g => g.collectionIds.includes(id));
}

export function isPrimarySmartCollection(id: SmartCollectionId): boolean {
  const group = getSmartCollectionGroup(id);
  return group?.primaryCollectionIds.includes(id) ?? false;
}

export function isSecondarySmartCollection(id: SmartCollectionId): boolean {
  const group = getSmartCollectionGroup(id);
  return group?.secondaryCollectionIds.includes(id) ?? false;
}
