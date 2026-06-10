import { normalizePropertyKey } from '../properties/noteProperties';
import { normalizeTagName } from '../tags/tagConstants';
import type { FormulaQueryOperator, ParsedQuery, QueryClause } from './queryModels';

const CLAUSE_RE = /^([a-zA-Z][a-zA-Z0-9_-]*):(.+)$/;
const RELATION_VALUE_RE = /^([a-zA-Z][a-zA-Z0-9_-]*):(.+)$/;
const FORMULA_PREDICATE_RE = /^([a-zA-Z][a-zA-Z0-9_]*)(>=|<=|!=|[><=])(-?\d+(?:\.\d+)?)$/;
const COMPARE_PREDICATE_RE = /^([a-zA-Z][a-zA-Z0-9_]*)(>=|<=|!=|[><=])(.+)$/;

/** Normalize property/tag values for index lookup */
export function normalizeQueryValue(value: string): string {
  return value.trim().toLowerCase();
}

function unquoteValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFormulaPredicate(value: string): QueryClause | { error: string } {
  const match = value.match(FORMULA_PREDICATE_RE);
  if (!match) {
    return { error: `Invalid formula clause: formula:${value}` };
  }

  const [, key, operator, rawValue] = match;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return { error: `Invalid formula value: ${rawValue}` };
  }

  return {
    type: 'formula',
    key,
    operator: operator as FormulaQueryOperator,
    value: parsed,
  };
}

function parseComparePredicate(
  value: string,
  clauseType: 'metadata' | 'propertyCompare',
): QueryClause | { error: string } {
  const match = value.match(COMPARE_PREDICATE_RE);
  if (!match) {
    return { error: `Invalid ${clauseType} clause: ${value}` };
  }

  const [, key, operator, rawValue] = match;
  const trimmedValue = unquoteValue(rawValue);
  if (!key.trim() || !trimmedValue) {
    return { error: `Invalid ${clauseType} clause: ${value}` };
  }

  return {
    type: clauseType,
    key: key.trim(),
    operator: operator as FormulaQueryOperator,
    value: trimmedValue,
  };
}

function quoteValueIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

/** Split query into key:value tokens — respects quoted values and relation:key:"title" */
export function tokenizeQuery(input: string): string[] {
  const tokens: string[] = [];
  const s = input.trim();
  let i = 0;

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i]!)) i++;
    if (i >= s.length) break;

    const start = i;

    while (i < s.length && /[a-zA-Z0-9_-]/.test(s[i]!)) i++;
    if (i >= s.length || s[i] !== ':') {
      while (i < s.length && !/\s/.test(s[i]!)) i++;
      tokens.push(s.slice(start, i));
      continue;
    }
    i++;

    const key = s.slice(start, i - 1);
    const normKey = normalizePropertyKey(key);

    if (normKey === 'relation') {
      while (i < s.length && /[a-zA-Z0-9_-]/.test(s[i]!)) i++;
      if (i >= s.length || s[i] !== ':') {
        tokens.push(s.slice(start, i));
        continue;
      }
      i++;
    }

    if (s[i] === '"') {
      i++;
      while (i < s.length && s[i] !== '"') i++;
      if (i < s.length) i++;
    } else {
      while (i < s.length && !/\s/.test(s[i]!)) i++;
    }

    tokens.push(s.slice(start, i));
  }

  return tokens;
}

function parseClauseToken(token: string): QueryClause | { error: string } {
  const match = token.match(CLAUSE_RE);
  if (!match) {
    return { error: `Invalid query token: ${token}` };
  }

  const [, rawKey, rawValue] = match;
  const key = rawKey.trim();
  const value = rawValue.trim();
  if (!value) {
    return { error: `Missing value for ${key}` };
  }

  const normKey = normalizePropertyKey(key);

  if (normKey === 'tag') {
    return { type: 'tag', value: unquoteValue(value) };
  }

  if (normKey === 'hasrelation') {
    const propertyKey = unquoteValue(value);
    if (!propertyKey) return { error: `Missing relation property key for hasRelation` };
    return { type: 'hasRelation', propertyKey };
  }

  if (normKey === 'linkedto') {
    const title = unquoteValue(value);
    if (!title) return { error: `Missing target title for linkedTo` };
    return { type: 'linkedTo', title };
  }

  if (normKey === 'relation') {
    const relationMatch = value.match(RELATION_VALUE_RE);
    if (!relationMatch) {
      return { error: `Invalid relation clause: ${token}` };
    }
    const propertyKey = relationMatch[1].trim();
    const title = unquoteValue(relationMatch[2]);
    if (!propertyKey || !title) {
      return { error: `Invalid relation clause: ${token}` };
    }
    return { type: 'relation', propertyKey, title };
  }

  if (normKey === 'formula') {
    return parseFormulaPredicate(value);
  }

  if (normKey === 'meta') {
    return parseComparePredicate(value, 'metadata');
  }

  if (normKey === 'prop') {
    return parseComparePredicate(value, 'propertyCompare');
  }

  return { type: 'property', key, value: unquoteValue(value) };
}

/** Parse `tag:japanese status:active relation:course:"N1"` into AND clauses */
export function parseQuery(input: string): ParsedQuery {
  const trimmed = input.trim();
  if (!trimmed) return { clauses: [] };

  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) {
    return { clauses: [], error: `Invalid query token: ${trimmed}` };
  }

  const clauses: QueryClause[] = [];

  for (const token of tokens) {
    const parsed = parseClauseToken(token);
    if ('error' in parsed) {
      return { clauses: [], error: parsed.error };
    }
    clauses.push(parsed);
  }

  return { clauses };
}

export function formatParsedQuery(parsed: ParsedQuery): string {
  return parsed.clauses.map(clause => {
    if (clause.type === 'tag') return `tag:${clause.value}`;
    if (clause.type === 'hasRelation') return `hasRelation:${clause.propertyKey}`;
    if (clause.type === 'linkedTo') return `linkedTo:${quoteValueIfNeeded(clause.title)}`;
    if (clause.type === 'relation') {
      return `relation:${clause.propertyKey}:${quoteValueIfNeeded(clause.title)}`;
    }
    if (clause.type === 'formula') {
      return `formula:${clause.key}${clause.operator}${clause.value}`;
    }
    if (clause.type === 'metadata') {
      return `meta:${clause.key}${clause.operator}${quoteValueIfNeeded(clause.value)}`;
    }
    if (clause.type === 'propertyCompare') {
      return `prop:${clause.key}${clause.operator}${quoteValueIfNeeded(clause.value)}`;
    }
    return `${clause.key}:${quoteValueIfNeeded(clause.value)}`;
  }).join(' ');
}

function isValidClauseToken(token: string): boolean {
  return CLAUSE_RE.test(token);
}

/** Whether every token uses key:value syntax */
export function isKnowledgeQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) return false;
  if (tokens.join(' ') !== trimmed) return false;
  if (!tokens.every(isValidClauseToken)) return false;
  return !parseQuery(trimmed).error;
}

/** Whether input attempts knowledge query syntax (at least one key:value token) */
export function hasKnowledgeQuerySyntax(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return tokenizeQuery(trimmed).some(isValidClauseToken);
}

export { normalizeTagName };
