import { normalizePropertyKey } from '../properties/noteProperties';
import { normalizeTagName } from '../tags/tagConstants';
import type { ParsedQuery, QueryClause } from './queryModels';

const CLAUSE_RE = /^([a-zA-Z][a-zA-Z0-9_-]*):(.+)$/;

/** Normalize property/tag values for index lookup */
export function normalizeQueryValue(value: string): string {
  return value.trim().toLowerCase();
}

/** Parse `tag:japanese status:active` into AND clauses */
export function parseQuery(input: string): ParsedQuery {
  const trimmed = input.trim();
  if (!trimmed) return { clauses: [] };

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const clauses: QueryClause[] = [];

  for (const token of tokens) {
    const match = token.match(CLAUSE_RE);
    if (!match) {
      return { clauses: [], error: `Invalid query token: ${token}` };
    }

    const [, rawKey, rawValue] = match;
    const value = rawValue.trim();
    if (!value) {
      return { clauses: [], error: `Missing value for ${rawKey}` };
    }

    if (normalizePropertyKey(rawKey) === 'tag') {
      clauses.push({ type: 'tag', value });
    } else {
      clauses.push({ type: 'property', key: rawKey.trim(), value });
    }
  }

  return { clauses };
}

export function formatParsedQuery(parsed: ParsedQuery): string {
  return parsed.clauses.map(clause => {
    if (clause.type === 'tag') return `tag:${clause.value}`;
    return `${clause.key}:${clause.value}`;
  }).join(' ');
}

/** Whether every token uses key:value syntax */
export function isKnowledgeQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(token => CLAUSE_RE.test(token));
}

/** Whether input attempts knowledge query syntax (at least one key:value token) */
export function hasKnowledgeQuerySyntax(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).some(token => CLAUSE_RE.test(token));
}

export { normalizeTagName };
