import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { noteSearchScore } from '../../../../../lib/math/noteSearch';
import type { NoteFolder } from '../../../../../store/useNotesStore';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildNoteGalaxyMap } from '../graph/knowledgeUniverse/galaxyClustering';
import {
  buildImportanceInputForNote,
  evaluateKnowledgeImportance,
  buildNoteIntelligenceSnapshot,
  type ImportanceClassification,
} from '../cosmos/intelligence';
import { countActionsForNote } from '../cosmos/actions';
import type { DiscoveryFeed } from '../discovery';
import { isDiscoveryOpportunityNote } from '../discovery';
import { buildTierExplanationLines } from '../cosmos/onboarding/tierExplanation';
import { getProperty } from '../properties/noteProperties';
import { getRelationTargets } from '../relations/noteRelations';
import { SMART_COLLECTIONS, findSmartCollection } from '../collections/smartCollections';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import {
  filterStudyProjectContainers,
  isStudyProjectContainer,
} from '../academic/studyProjectModels';
import {
  filterProjectMilestones,
  isProjectMilestone,
} from '../academic/projectMilestoneModels';
import {
  listLearningPathIds,
  SUBJECT_DASHBOARDS,
  getSubjectWorkspaceCollectionId,
} from '../maps/subjectDashboards';
import { listTags, normalizeTagName } from '../tags/noteTags';
import type { Language, TranslationKey } from '../../../../../lib/i18n';
import { getTranslator } from '../../../../../lib/i18n';
import type { WorkspaceSearchRecentEntry } from './workspaceSearchRecent';

export type WorkspaceSearchResultKind =
  | 'note'
  | 'folder'
  | 'tag'
  | 'collection'
  | 'project'
  | 'milestone'
  | 'learning-path'
  | 'subject';

/** Lower score = higher rank. Priority: note → project → path → collection → tag → milestone → folder */
const KIND_PRIORITY: Record<WorkspaceSearchResultKind, number> = {
  note: 0,
  project: 1,
  'learning-path': 2,
  collection: 3,
  subject: 3,
  tag: 4,
  milestone: 5,
  folder: 6,
};

/** Ranking doc: exact title match within kind ranks first (matchQuality 0), then prefix (1), then contains (2). */
const KINDS_BY_FILTER: Record<WorkspaceSearchFilter, readonly WorkspaceSearchResultKind[] | null> = {
  all: null,
  note: ['note', 'folder', 'tag'],
  project: ['project', 'milestone'],
  'learning-path': ['learning-path'],
  collection: ['collection', 'tag', 'folder'],
  subject: ['subject'],
};

export type WorkspaceSearchFilter =
  | 'all'
  | 'note'
  | 'project'
  | 'learning-path'
  | 'collection'
  | 'subject';

export interface WorkspaceSearchResult {
  id: string;
  kind: WorkspaceSearchResultKind;
  title: string;
  subtitle?: string;
  score: number;
  collectionId?: SmartCollectionId;
  noteId?: string;
  folderId?: string;
  tag?: string;
  pathId?: string;
  importanceClass?: ImportanceClassification;
  areaLabel?: string;
  galaxyLabel?: string;
  connectionCount?: number;
  weakConnectivity?: boolean;
  actionsAvailable?: boolean;
  discoveryOpportunity?: boolean;
  tierHint?: string;
}

export interface WorkspaceSearchGroup {
  kind: WorkspaceSearchResultKind;
  results: WorkspaceSearchResult[];
}

export interface BuildWorkspaceSearchOptions {
  filter?: WorkspaceSearchFilter;
  service?: KnowledgeIndexService;
  discoveryFeed?: DiscoveryFeed;
  language?: Language;
}

function formatTierHint(
  input: ReturnType<typeof buildImportanceInputForNote>,
  result: ReturnType<typeof evaluateKnowledgeImportance>,
  t: (key: TranslationKey) => string,
): string {
  return buildTierExplanationLines(input, result)
    .map(line => {
      if (!line.values) return t(line.key);
      return Object.entries(line.values).reduce(
        (text, [key, value]) => text.replace(`{${key}}`, value),
        t(line.key),
      );
    })
    .join(' · ');
}

const SUGGESTION_COLLECTION_IDS: readonly SmartCollectionId[] = [
  'recent',
  'research-sources',
  'exam-study-notes',
  'academic-active-projects',
];

const NOTE_ENRICH_LIMIT = 20;

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchScore(haystack: string, needle: string): number | null {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return null;
  if (h === n) return 0;
  if (h.startsWith(n)) return 1;
  if (h.includes(n)) return 2;
  return null;
}

function buildResult(
  kind: WorkspaceSearchResultKind,
  id: string,
  title: string,
  matchQuality: number,
  extras: Partial<WorkspaceSearchResult> = {},
): WorkspaceSearchResult {
  const exactBoost = matchQuality === 0 ? -1 : 0;
  return {
    id,
    kind,
    title,
    score: KIND_PRIORITY[kind] * 10 + matchQuality + exactBoost,
    ...extras,
  };
}

function kindAllowed(kind: WorkspaceSearchResultKind, filter: WorkspaceSearchFilter): boolean {
  const allowed = KINDS_BY_FILTER[filter];
  return allowed === null || allowed.includes(kind);
}

function relationTitlesForNote(note: NoteBase, notes: readonly NoteBase[]): string[] {
  const ids = new Set<string>();
  if (note.relations) {
    for (const targets of Object.values(note.relations)) {
      for (const id of targets) ids.add(id);
    }
  }
  for (const id of getRelationTargets(note, 'related-to')) ids.add(id);
  return [...ids]
    .map(id => notes.find(n => n.id === id)?.title ?? '')
    .filter(t => t.trim().length > 0);
}

function collectTags(notes: readonly NoteBase[]): Map<string, string> {
  const tags = new Map<string, string>();
  for (const note of notes) {
    if (note.deletedAt) continue;
    for (const tag of listTags(note)) {
      const key = normalizeTagName(tag);
      if (!tags.has(key)) tags.set(key, tag);
    }
  }
  return tags;
}

function groupResults(results: WorkspaceSearchResult[], limitPerGroup = 8): WorkspaceSearchGroup[] {
  results.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title));
  const byKind = new Map<WorkspaceSearchResultKind, WorkspaceSearchResult[]>();
  for (const r of results) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }
  const order: WorkspaceSearchResultKind[] = [
    'note', 'project', 'learning-path', 'collection', 'subject', 'tag', 'milestone', 'folder',
  ];
  return order
    .filter(kind => (byKind.get(kind)?.length ?? 0) > 0)
    .map(kind => ({ kind, results: byKind.get(kind)!.slice(0, limitPerGroup) }));
}

function enrichNoteResult(
  note: NoteBase,
  result: WorkspaceSearchResult,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  galaxyMap: ReturnType<typeof buildNoteGalaxyMap>,
  discoveryFeed?: DiscoveryFeed,
  language?: Language,
): WorkspaceSearchResult {
  const galaxy = galaxyMap.get(note.id);
  const input = buildImportanceInputForNote(note, service, galaxy);
  const importance = evaluateKnowledgeImportance(input);
  const { classification } = importance;
  const t = getTranslator(language ?? 'en');
  const areaLabel = getProperty(note, 'area')?.trim();
  const connectionCount = service.getConnectionScore(note.id);
  const snapshot = buildNoteIntelligenceSnapshot(note, notes, service);
  const metaParts = [
    areaLabel,
    galaxy?.galaxyLabel,
    connectionCount > 0 ? `${connectionCount}` : undefined,
  ].filter(Boolean);

  return {
    ...result,
    importanceClass: classification,
    areaLabel: areaLabel || undefined,
    galaxyLabel: galaxy?.galaxyLabel,
    connectionCount,
    weakConnectivity: result.score <= 3 && connectionCount <= 1,
    subtitle: metaParts.length > 0 ? metaParts.join(' · ') : result.subtitle,
    actionsAvailable: countActionsForNote(snapshot) > 0,
    discoveryOpportunity: discoveryFeed ? isDiscoveryOpportunityNote(note.id, discoveryFeed) : false,
    tierHint: formatTierHint(input, importance, t),
  };
}

/** Global workspace search — grouped, ranked results for command palette. */
export function buildWorkspaceSearch(
  query: string,
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  options: BuildWorkspaceSearchOptions = {},
): WorkspaceSearchGroup[] {
  const filter = options.filter ?? 'all';
  const service = options.service;
  const q = normalizeQuery(query);
  if (!q) return [];

  const results: WorkspaceSearchResult[] = [];
  const projectIds = new Set(filterStudyProjectContainers(notes).map(p => p.id));
  const milestoneIds = new Set(filterProjectMilestones(notes).map(m => m.id));
  const galaxyMap = service ? buildNoteGalaxyMap(notes, service) : null;

  for (const note of notes) {
    if (note.deletedAt) continue;
    if (projectIds.has(note.id) || milestoneIds.has(note.id)) continue;
    const title = displayNoteTitle(note.title);
    const matchRank = noteSearchScore(note, q, relationTitlesForNote(note, notes));
    if (matchRank !== null && kindAllowed('note', filter)) {
      results.push(buildResult('note', note.id, title, matchRank, { noteId: note.id }));
    }
  }

  for (const project of filterStudyProjectContainers(notes)) {
    const title = displayNoteTitle(project.title);
    const m = matchScore(title, q);
    if (m !== null && kindAllowed('project', filter)) {
      results.push(buildResult('project', project.id, title, m, { noteId: project.id }));
    }
  }

  for (const pathId of listLearningPathIds(notes)) {
    const label = pathId.replace(/-/g, ' ');
    const m = matchScore(label, q) ?? matchScore(pathId, q);
    if (m !== null && kindAllowed('learning-path', filter)) {
      results.push(buildResult('learning-path', pathId, label, m, { pathId }));
    }
  }

  for (const collection of SMART_COLLECTIONS) {
    const m = matchScore(collection.name, q) ?? matchScore(collection.description, q);
    if (m !== null && kindAllowed('collection', filter)) {
      results.push(buildResult('collection', collection.id, collection.name, m, {
        collectionId: collection.id,
      }));
    }
  }

  for (const subject of SUBJECT_DASHBOARDS) {
    const m = matchScore(subject.name, q) ?? matchScore(subject.description, q);
    if (m !== null && kindAllowed('subject', filter)) {
      const collectionId = getSubjectWorkspaceCollectionId(subject.id);
      results.push(buildResult('subject', subject.id, subject.name, m, {
        collectionId: collectionId ?? undefined,
        subtitle: subject.description,
      }));
    }
  }

  for (const [key, display] of collectTags(notes)) {
    const m = matchScore(display, q) ?? matchScore(key, q);
    if (m !== null && kindAllowed('tag', filter)) {
      results.push(buildResult('tag', key, display, m, { tag: display }));
    }
  }

  for (const milestone of filterProjectMilestones(notes)) {
    const title = displayNoteTitle(milestone.title);
    const m = matchScore(title, q);
    if (m !== null && kindAllowed('milestone', filter)) {
      results.push(buildResult('milestone', milestone.id, title, m, { noteId: milestone.id }));
    }
  }

  for (const folder of folders) {
    const m = matchScore(folder.name, q);
    if (m !== null && kindAllowed('folder', filter)) {
      results.push(buildResult('folder', folder.id, folder.name, m, { folderId: folder.id }));
    }
  }

  if (service && galaxyMap) {
    const enrichIds = new Set(
      results
        .filter(r => r.kind === 'note')
        .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
        .slice(0, NOTE_ENRICH_LIMIT)
        .map(r => r.id),
    );
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      if (r.kind !== 'note' || !enrichIds.has(r.id)) continue;
      const note = notes.find(n => n.id === r.noteId);
      if (note) {
        results[i] = enrichNoteResult(
          note,
          r,
          notes,
          service,
          galaxyMap,
          options.discoveryFeed,
          options.language,
        );
      }
    }
  }

  return groupResults(results);
}

function resolveRecentEntry(
  entry: WorkspaceSearchRecentEntry,
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
): WorkspaceSearchResult | null {
  switch (entry.kind) {
    case 'note':
    case 'project':
    case 'milestone': {
      const note = notes.find(n => n.id === entry.id && !n.deletedAt);
      if (!note) return null;
      const kind = isStudyProjectContainer(note)
        ? 'project'
        : isProjectMilestone(note)
          ? 'milestone'
          : 'note';
      return buildResult(kind, entry.id, displayNoteTitle(note.title), 0, { noteId: note.id });
    }
    case 'folder': {
      const folder = folders.find(f => f.id === entry.id);
      if (!folder) return null;
      return buildResult('folder', folder.id, folder.name, 0, { folderId: folder.id });
    }
    case 'tag':
      return buildResult('tag', entry.id, entry.title, 0, { tag: entry.title });
    case 'collection':
    case 'subject': {
      const collection = findSmartCollection(entry.id as SmartCollectionId);
      return buildResult(entry.kind, entry.id, collection?.name ?? entry.title, 0, {
        collectionId: entry.id as SmartCollectionId,
      });
    }
    case 'learning-path':
      return buildResult('learning-path', entry.id, entry.title, 0, { pathId: entry.id });
    default:
      return null;
  }
}

/** Replay recent selections — shown when query is empty. */
export function buildWorkspaceSearchRecentGroups(
  recent: readonly WorkspaceSearchRecentEntry[],
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  filter: WorkspaceSearchFilter = 'all',
): WorkspaceSearchGroup[] {
  const results = recent
    .map(entry => resolveRecentEntry(entry, notes, folders))
    .filter((r): r is WorkspaceSearchResult => r !== null && kindAllowed(r.kind, filter));
  if (results.length === 0) return [];
  return [{ kind: results[0]!.kind, results: results.slice(0, 8) }];
}

/** Empty-query suggestions — key collections, recent notes, active projects, paths. */
export function buildWorkspaceSearchSuggestions(
  notes: readonly NoteBase[],
  folders: readonly NoteFolder[],
  filter: WorkspaceSearchFilter = 'all',
): WorkspaceSearchGroup[] {
  const results: WorkspaceSearchResult[] = [];

  if (kindAllowed('collection', filter)) {
    for (const id of SUGGESTION_COLLECTION_IDS) {
      const collection = findSmartCollection(id);
      if (collection) {
        results.push(buildResult('collection', id, collection.name, 0, { collectionId: id }));
      }
    }
  }

  if (kindAllowed('note', filter)) {
    for (const note of [...notes]
      .filter(n => !n.deletedAt && !isStudyProjectContainer(n) && !isProjectMilestone(n))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)) {
      results.push(buildResult('note', note.id, displayNoteTitle(note.title), 0, { noteId: note.id }));
    }
  }

  if (kindAllowed('project', filter)) {
    for (const project of filterStudyProjectContainers(notes, 'active').slice(0, 3)) {
      results.push(buildResult('project', project.id, displayNoteTitle(project.title), 0, {
        noteId: project.id,
      }));
    }
  }

  if (kindAllowed('learning-path', filter)) {
    for (const pathId of listLearningPathIds(notes).slice(0, 3)) {
      results.push(buildResult('learning-path', pathId, pathId.replace(/-/g, ' '), 0, { pathId }));
    }
  }

  if (kindAllowed('subject', filter)) {
    for (const subject of SUBJECT_DASHBOARDS.slice(0, 3)) {
      const collectionId = getSubjectWorkspaceCollectionId(subject.id);
      results.push(buildResult('subject', subject.id, subject.name, 0, {
        collectionId: collectionId ?? undefined,
        subtitle: subject.description,
      }));
    }
  }

  return groupResults(results, 5);
}

export function isProjectNote(note: NoteBase): boolean {
  return isStudyProjectContainer(note);
}

export function isMilestoneNote(note: NoteBase): boolean {
  return isProjectMilestone(note);
}

/** Documented ranking: title tiers → body → tags; then kind priority note > project > path > collection > tag. */
export const WORKSPACE_SEARCH_RANKING_DOC = `
1. Note match quality: exact title (0) → title prefix (1) → title contains (2) → body word start (3) → body contains (4) → tag exact (5) → tag partial (6)
2. Kind priority: note → project → learning-path → collection/subject → tag → milestone → folder
3. Exact title matches receive an additional boost within their kind
`;
