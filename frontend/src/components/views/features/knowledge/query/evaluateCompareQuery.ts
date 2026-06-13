import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import { parseDatabaseDate } from '../databaseViews/parseDatabaseDate';
import type {
  ComparisonQueryOperator,
  MetadataQueryClause,
  PropertyCompareQueryClause,
  QueryClause,
} from './queryModels';

export function isPropertyCompareQueryClause(
  clause: QueryClause,
): clause is PropertyCompareQueryClause {
  return clause.type === 'propertyCompare';
}

export function isMetadataQueryClause(clause: QueryClause): clause is MetadataQueryClause {
  return clause.type === 'metadata';
}

export function isPostFilterQueryClause(
  clause: QueryClause,
): clause is PropertyCompareQueryClause | MetadataQueryClause {
  return clause.type === 'propertyCompare' || clause.type === 'metadata';
}

export function splitQueryClauses(clauses: readonly QueryClause[]): {
  indexed: QueryClause[];
  formula: Extract<QueryClause, { type: 'formula' }>[];
  postFilter: Array<PropertyCompareQueryClause | MetadataQueryClause>;
} {
  const indexed: QueryClause[] = [];
  const formula: Extract<QueryClause, { type: 'formula' }>[] = [];
  const postFilter: Array<PropertyCompareQueryClause | MetadataQueryClause> = [];

  for (const clause of clauses) {
    if (clause.type === 'formula') {
      formula.push(clause);
    } else if (isPostFilterQueryClause(clause)) {
      postFilter.push(clause);
    } else {
      indexed.push(clause);
    }
  }

  return { indexed, formula, postFilter };
}

function compareComparable(
  actual: string | number,
  operator: ComparisonQueryOperator,
  expected: string | number,
): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    switch (operator) {
      case '>': return actual > expected;
      case '<': return actual < expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '=': return actual === expected;
      case '!=': return actual !== expected;
    }
  }

  const actualText = String(actual).toLowerCase();
  const expectedText = String(expected).toLowerCase();
  switch (operator) {
    case '>': return actualText > expectedText;
    case '<': return actualText < expectedText;
    case '>=': return actualText >= expectedText;
    case '<=': return actualText <= expectedText;
    case '=': return actualText === expectedText;
    case '!=': return actualText !== expectedText;
  }
}

function resolveMetadataComparable(note: NoteBase, key: string): string | number | null {
  switch (key) {
    case 'updatedAt':
      return note.updatedAt ?? 0;
    case 'createdAt': {
      const extended = note as NoteBase & { createdAt?: number };
      return typeof extended.createdAt === 'number' ? extended.createdAt : 0;
    }
    case 'title':
      return note.title ?? '';
    default:
      return null;
  }
}

function parseComparableValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
  }
  const parsedDate = parseDatabaseDate(trimmed);
  if (parsedDate) return parsedDate.getTime();
  return trimmed;
}

function noteMatchesPostFilterClauses(
  note: NoteBase,
  clauses: ReadonlyArray<PropertyCompareQueryClause | MetadataQueryClause>,
  service: KnowledgeIndexService,
): boolean {
  for (const clause of clauses) {
    if (clause.type === 'propertyCompare') {
      const actual = getDatabaseFieldValue(note, clause.key, service);
      const expected = clause.value;
      if (!compareComparable(actual, clause.operator, expected)) {
        return false;
      }
      continue;
    }

    const actual = resolveMetadataComparable(note, clause.key);
    if (actual === null) return false;
    const expected = parseComparableValue(clause.value);
    if (!compareComparable(actual, clause.operator, expected)) {
      return false;
    }
  }

  return true;
}

/** Post-filter candidate notes using property comparisons and metadata predicates */
export function filterNotesByPostFilterClauses(
  notes: readonly NoteBase[],
  candidateIds: Set<string>,
  clauses: ReadonlyArray<PropertyCompareQueryClause | MetadataQueryClause>,
  service: KnowledgeIndexService,
): Set<string> {
  if (clauses.length === 0) return candidateIds;

  const notesById = new Map(notes.map(note => [note.id, note]));
  const matched = new Set<string>();

  for (const noteId of candidateIds) {
    const note = notesById.get(noteId);
    if (!note) continue;
    if (noteMatchesPostFilterClauses(note, clauses, service)) {
      matched.add(noteId);
    }
  }

  return matched;
}
