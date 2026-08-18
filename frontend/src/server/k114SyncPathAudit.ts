/** K-114 — Frontend Notes bootstrap path audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export const K114_FULL_SYNC_ALLOWED = [
  'notesSyncClient.ts — complete account snapshot',
  'useNotesStore.ts — bootstrapFromSupabase durable apply',
  'useNotesStore.ts — POST upsert (push)',
] as const;

export const K114_DELTA_SYNC_CALLERS = [] as const;

export const K114_FORBIDDEN_UNCONDITIONAL = [
  'retired hydrateFromDB/hydrateFromDBFull entry points',
] as const;

export interface K114AppContentStartupContract {
  coordinatorWired: boolean;
  notesBootstrapOrdered: boolean;
  cancellationBoundaryWired: boolean;
  accountScoped: boolean;
  healthSingleFlightWired: boolean;
  appContentOnceGuard: boolean;
}

/**
 * Locate a deliberate call boundary without coupling the audit to formatting
 * or to a component-local variable name.  These checks are intentionally
 * narrow: the coordinator and bootstrap APIs are architectural entry points,
 * while local refs/state and dependency-array formatting are not.
 */
function callIndex(source: string, name: string, from = 0): number {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.slice(from).search(new RegExp(`\\b${escaped}\\s*\\(`));
  return match < 0 ? -1 : from + match;
}

function skipQuotedOrComment(source: string, start: number): number {
  const quote = source[start];
  if (quote === '/' && source[start + 1] === '/') {
    const newline = source.indexOf('\n', start + 2);
    return newline < 0 ? source.length : newline;
  }
  if (quote === '/' && source[start + 1] === '*') {
    const end = source.indexOf('*/', start + 2);
    return end < 0 ? source.length : end + 2;
  }
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function maskNonExecutableRegions(source: string): string {
  // Template literals are masked wholesale, including interpolation, so
  // literal text cannot satisfy this source audit without a parser.
  const masked = source.split('');
  for (let index = 0; index < source.length;) {
    const character = source[index];
    const isQuoted = character === '\'' || character === '"' || character === '`';
    const isComment = character === '/' && (source[index + 1] === '/' || source[index + 1] === '*');
    if (!isQuoted && !isComment) {
      index += 1;
      continue;
    }
    const end = skipQuotedOrComment(source, index);
    for (let cursor = index; cursor < end; cursor += 1) {
      if (source[cursor] !== '\n' && source[cursor] !== '\r') masked[cursor] = ' ';
    }
    index = end;
  }
  return masked.join('');
}

function propertyValueEnd(source: string, valueStart: number, objectClose: number): number {
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let index = valueStart; index < objectClose; index += 1) {
    const character = source[index];
    if (character === '\'' || character === '"' || character === '`') {
      index = skipQuotedOrComment(source, index) - 1;
      continue;
    }
    if (character === '/' && (source[index + 1] === '/' || source[index + 1] === '*')) {
      index = skipQuotedOrComment(source, index) - 1;
      continue;
    }
    if (character === '(') {
      parenDepth += 1;
      continue;
    }
    if (character === ')' && parenDepth > 0) {
      parenDepth -= 1;
      continue;
    }
    if (character === '{') {
      braceDepth += 1;
      continue;
    }
    if (character === '}' && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']' && bracketDepth > 0) {
      bracketDepth -= 1;
      continue;
    }
    if (character === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      return index;
    }
  }
  return objectClose;
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function matchingParenthesis(source: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '(') {
      depth += 1;
      continue;
    }
    if (source[index] === ')' && --depth === 0) return index;
  }
  return -1;
}

function rootInlineArrowBlockBody(propertyValue: string): string | null {
  const maskedValue = maskNonExecutableRegions(propertyValue);
  let cursor = skipWhitespace(maskedValue, 0);
  if (maskedValue.startsWith('async', cursor)
    && !/[A-Za-z0-9_$]/.test(maskedValue[cursor + 'async'.length] ?? '')) {
    cursor = skipWhitespace(maskedValue, cursor + 'async'.length);
  }
  if (maskedValue[cursor] !== '(') return null;
  const parametersClose = matchingParenthesis(maskedValue, cursor);
  if (parametersClose < 0) return null;
  cursor = skipWhitespace(maskedValue, parametersClose + 1);
  if (maskedValue.slice(cursor, cursor + 2) !== '=>') return null;
  cursor = skipWhitespace(maskedValue, cursor + 2);
  if (maskedValue[cursor] !== '{') return null;
  const bodyClose = matchingBrace(propertyValue, cursor);
  if (bodyClose < 0) return null;
  if (skipWhitespace(maskedValue, bodyClose + 1) !== maskedValue.length) return null;
  return propertyValue.slice(cursor + 1, bodyClose);
}

function matchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\'' || character === '"' || character === '`') {
      index = skipQuotedOrComment(source, index) - 1;
      continue;
    }
    if (character === '/' && (source[index + 1] === '/' || source[index + 1] === '*')) {
      index = skipQuotedOrComment(source, index) - 1;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}' && --depth === 0) return index;
  }
  return -1;
}

function coordinatorObjectClose(source: string, coordinatorStart: number): number {
  const objectOpen = source.indexOf('{', coordinatorStart);
  return objectOpen < 0 ? -1 : matchingBrace(source, objectOpen);
}

function topLevelPropertyIndex(source: string, propertyName: string): number {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const property = new RegExp(`^\\b${escaped}\\s*:`);
  let braceDepth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\'' || character === '"' || character === '`') {
      index = skipQuotedOrComment(source, index) - 1;
      continue;
    }
    if (character === '/' && (source[index + 1] === '/' || source[index + 1] === '*')) {
      index = skipQuotedOrComment(source, index) - 1;
      continue;
    }
    if (character === '{') {
      braceDepth += 1;
      continue;
    }
    if (character === '}') {
      braceDepth -= 1;
      continue;
    }
    if (braceDepth === 0 && property.test(source.slice(index))) return index;
  }
  return -1;
}

function extractStartNotesBody(source: string, coordinatorStart: number): string | null {
  const objectOpen = source.indexOf('{', coordinatorStart);
  if (objectOpen < 0) return null;
  const objectClose = matchingBrace(source, objectOpen);
  if (objectClose < 0) return null;
  const objectSource = source.slice(objectOpen + 1, objectClose);
  const propertyIndex = topLevelPropertyIndex(objectSource, 'startNotes');
  if (propertyIndex < 0) return null;
  const propertyStart = objectOpen + 1 + propertyIndex;
  const propertyColon = source.indexOf(':', propertyStart);
  if (propertyColon < 0 || propertyColon > objectClose) return null;
  const valueStart = propertyColon + 1;
  const valueEnd = propertyValueEnd(source, valueStart, objectClose);
  const propertyValue = source.slice(valueStart, valueEnd);
  return rootInlineArrowBlockBody(propertyValue);
}

function startupRunBinding(source: string, coordinatorStart: number): string | null {
  const bindings = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*startIndependentStartup\s*\(/g;
  let latest: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = bindings.exec(source)) && match.index <= coordinatorStart) {
    latest = match[1];
  }
  return latest;
}

export function auditAppContentStartupContract(appSrc: string): K114AppContentStartupContract {
  const coordinatorStart = callIndex(appSrc, 'startIndependentStartup');
  const notesBody = coordinatorStart >= 0 ? extractStartNotesBody(appSrc, coordinatorStart) : null;
  const executableNotesBody = notesBody === null ? '' : maskNonExecutableRegions(notesBody);
  const initNotes = notesBody ? callIndex(executableNotesBody, 'initNotesStorage') : -1;
  const bootstrapNotes = notesBody ? callIndex(executableNotesBody, 'bootstrapFromSupabase') : -1;
  const coordinatorWired = coordinatorStart >= 0 && notesBody !== null;
  const notesBootstrapOrdered = coordinatorWired
    && /\binitNotesStorage\s*\(\s*authUser\s*\.\s*id\s*\)/.test(executableNotesBody)
    && initNotes >= 0
    && bootstrapNotes > initNotes;
  const startupRun = coordinatorStart >= 0 ? startupRunBinding(appSrc, coordinatorStart) : null;
  const coordinatorClose = coordinatorStart >= 0 ? coordinatorObjectClose(appSrc, coordinatorStart) : -1;
  const cleanupStart = appSrc.indexOf('return () =>', coordinatorClose + 1);
  const cleanupOpen = cleanupStart < 0 ? -1 : appSrc.indexOf('{', cleanupStart);
  const cleanupClose = cleanupOpen < 0 ? -1 : matchingBrace(appSrc, cleanupOpen);
  const cleanupBody = cleanupClose < 0 ? '' : appSrc.slice(cleanupOpen + 1, cleanupClose);
  const executableCleanupBody = maskNonExecutableRegions(cleanupBody);
  const cancellationBoundaryWired = cleanupStart >= 0
    && startupRun !== null
    && new RegExp(`\\b${startupRun.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\.\\s*cancel\\s*\\(`).test(executableCleanupBody)
    && callIndex(executableCleanupBody, 'detachNotesStorage') >= 0;
  const accountScoped = /\binitNotesStorage\s*\(\s*authUser\s*\.\s*id\s*\)/.test(executableNotesBody);
  const healthSingleFlightWired = /runHealthBootstrapSingleFlight\s*\(\s*authUser\s*\.\s*id\s*,/.test(appSrc);

  return {
    coordinatorWired,
    notesBootstrapOrdered,
    cancellationBoundaryWired,
    accountScoped,
    healthSingleFlightWired,
    appContentOnceGuard: coordinatorWired
      && notesBootstrapOrdered
      && cancellationBoundaryWired
      && accountScoped,
  };
}

export function auditSyncPaths(): {
  fullSyncCallers: readonly string[];
  deltaSyncCallers: readonly string[];
  duplicateFetchRisks: readonly string[];
  usesNotesSyncClient: boolean;
  appContentOnceGuard: boolean;
  healthSingleFlightWired: boolean;
  dormantHydrateEntryPointsRemoved: boolean;
} {
  const storeSrc = read('store/useNotesStore.ts');
  const appSrc = read('components/AppContent.tsx');
  const clientSrc = read('lib/notesSyncClient.ts');
  const appContract = auditAppContentStartupContract(appSrc);

  const unconditionalNotesGet = (storeSrc.match(/authFetch\(`\$\{API_URL\}\/api\/notes`\)/g) ?? []).length;
  const usesClient = storeSrc.includes('fetchCompleteNotesFoldersSnapshot')
    && storeSrc.includes('bootstrapFromSupabase');

  return {
    fullSyncCallers: [...K114_FULL_SYNC_ALLOWED],
    deltaSyncCallers: [...K114_DELTA_SYNC_CALLERS],
    duplicateFetchRisks: unconditionalNotesGet > 0
      ? ['useNotesStore still has unconditional GET /api/notes'] : [],
    usesNotesSyncClient: usesClient && clientSrc.includes('updated_after=0&bootstrap=true'),
    appContentOnceGuard: appContract.appContentOnceGuard,
    healthSingleFlightWired: appContract.healthSingleFlightWired,
    dormantHydrateEntryPointsRemoved: !storeSrc.includes('hydrateFromDB')
      && !storeSrc.includes('hydrateFromDBFull')
      && !appSrc.includes('hydrateFromDB')
      && !clientSrc.includes('fetchNotesFromCloud')
      && !clientSrc.includes('fetchFoldersFromCloud'),
  };
}

export function auditSyncPathHooks(): readonly string[] {
  return [
    'notesSyncClient.ts',
    'fetchCompleteNotesFoldersSnapshot',
    'startIndependentStartup',
    'account-scoped Notes storage initialization',
    'complete snapshot durable bootstrap',
    'startup cancellation cleanup',
  ];
}
