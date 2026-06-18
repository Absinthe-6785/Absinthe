import type { NoteBase } from '../../../noteUtils';
import { extractLinks, normalizeWikiTitle, noteReferencesTitle } from '../../../noteUtils';

export interface ParagraphOffsetEntry {
  start: number;
  end: number;
}

/** noteId → cached paragraph byte ranges (offsets only — no paragraph text). */
export type ParagraphOffsetIndex = Map<string, {
  fingerprint: number;
  offsets: ParagraphOffsetEntry[];
}>;

export interface LinkContext {
  noteId: string;
  noteTitle: string;
  excerpts: string[];
}

export interface ExtractLinkContextsOptions {
  maxExcerpts?: number;
  excerptMax?: number;
  /** Bumps with note body edits — cache entries mismatch when body fingerprint changes. */
  contentVersion?: number;
}

const DEFAULT_MAX_EXCERPTS = 2;
const DEFAULT_EXCERPT_MAX = 140;

const paragraphOffsetCache: ParagraphOffsetIndex = new Map();
let lastContentVersion = -1;

/** FNV-1a 32-bit fingerprint for per-note invalidation without storing body text. */
export function bodyFingerprint(body: string): number {
  let hash = 2166136261;
  for (let i = 0; i < body.length; i += 1) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Build paragraph byte ranges matching `body.split(/\\n{2,}/)` boundaries. */
export function buildParagraphOffsets(body: string): ParagraphOffsetEntry[] {
  const offsets: ParagraphOffsetEntry[] = [];
  if (body.length === 0) {
    offsets.push({ start: 0, end: 0 });
    return offsets;
  }

  const re = /\n{2,}/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    offsets.push({ start, end: match.index });
    start = match.index + match[0].length;
  }
  offsets.push({ start, end: body.length });
  return offsets;
}

/** Line byte ranges for legacy fallback when no paragraph contains the link. */
export function buildLineOffsets(body: string): ParagraphOffsetEntry[] {
  const offsets: ParagraphOffsetEntry[] = [];
  let lineStart = 0;
  for (let i = 0; i <= body.length; i += 1) {
    if (i === body.length || body[i] === '\n') {
      if (i > lineStart) offsets.push({ start: lineStart, end: i });
      lineStart = i + 1;
    }
  }
  return offsets;
}

export function invalidateLinkContextOffsetNote(noteId: string): void {
  paragraphOffsetCache.delete(noteId);
}

export function clearLinkContextOffsetIndex(): void {
  paragraphOffsetCache.clear();
}

/** Drop stale cache entries when vault content generation changes. */
export function syncLinkContextOffsetCache(contentVersion?: number): void {
  if (contentVersion == null) return;
  if (lastContentVersion === contentVersion) return;
  paragraphOffsetCache.clear();
  lastContentVersion = contentVersion;
}

export function getCachedParagraphOffsets(noteId: string, body: string): ParagraphOffsetEntry[] {
  const fingerprint = bodyFingerprint(body);
  const cached = paragraphOffsetCache.get(noteId);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.offsets;
  }
  const offsets = buildParagraphOffsets(body);
  paragraphOffsetCache.set(noteId, { fingerprint, offsets });
  return offsets;
}

function paragraphHasLink(body: string, start: number, end: number, targetKey: string): boolean {
  const slice = body.slice(start, end);
  return extractLinks(slice).some(link => normalizeWikiTitle(link) === targetKey);
}

function formatExcerpt(body: string, start: number, end: number, excerptMax: number): string {
  const raw = body.slice(start, end);
  const clean = raw
    .split('\n')
    .map(line => line.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean)
    .join(' ');
  return clean.length > excerptMax ? `${clean.slice(0, excerptMax)}…` : clean;
}

function formatLineExcerpt(body: string, start: number, end: number, excerptMax: number): string {
  const clean = body.slice(start, end).replace(/^#{1,6}\s+/, '').trim();
  return clean.length > excerptMax ? `${clean.slice(0, excerptMax)}…` : clean;
}

function excerptsFromOffsets(
  body: string,
  offsets: readonly ParagraphOffsetEntry[],
  targetKey: string,
  maxExcerpts: number,
  excerptMax: number,
  lineFallback: boolean,
): string[] {
  const excerpts: string[] = [];
  for (const { start, end } of offsets) {
    if (!paragraphHasLink(body, start, end, targetKey)) continue;
    excerpts.push(formatExcerpt(body, start, end, excerptMax));
    if (excerpts.length >= maxExcerpts) break;
  }

  if (excerpts.length === 0 && lineFallback) {
    for (const { start, end } of buildLineOffsets(body)) {
      if (!paragraphHasLink(body, start, end, targetKey)) continue;
      excerpts.push(formatLineExcerpt(body, start, end, excerptMax));
      if (excerpts.length >= maxExcerpts) break;
    }
  }

  return excerpts;
}

/** Offset-indexed link context extraction — output matches legacy `extractLinkContexts`. */
export function extractLinkContexts(
  targetTitle: string,
  allNotes: readonly NoteBase[],
  opts: ExtractLinkContextsOptions = {},
): LinkContext[] {
  if (!targetTitle.trim()) return [];

  syncLinkContextOffsetCache(opts.contentVersion);

  const maxExcerpts = opts.maxExcerpts ?? DEFAULT_MAX_EXCERPTS;
  const excerptMax = opts.excerptMax ?? DEFAULT_EXCERPT_MAX;
  const targetKey = normalizeWikiTitle(targetTitle);
  const results: LinkContext[] = [];

  for (const note of allNotes) {
    if (note.deletedAt) continue;
    const body = note.body ?? '';
    if (!noteReferencesTitle(body, targetTitle)) continue;

    const offsets = getCachedParagraphOffsets(note.id, body);
    const excerpts = excerptsFromOffsets(body, offsets, targetKey, maxExcerpts, excerptMax, true);
    if (excerpts.length > 0) {
      results.push({ noteId: note.id, noteTitle: note.title ?? '', excerpts });
    }
  }

  return results;
}

/** Legacy full-split path — audit baseline only. */
export function extractLinkContextsLegacy(
  targetTitle: string,
  allNotes: readonly NoteBase[],
  opts: ExtractLinkContextsOptions = {},
): LinkContext[] {
  if (!targetTitle.trim()) return [];

  const maxExcerpts = opts.maxExcerpts ?? DEFAULT_MAX_EXCERPTS;
  const excerptMax = opts.excerptMax ?? DEFAULT_EXCERPT_MAX;
  const targetKey = normalizeWikiTitle(targetTitle);
  const results: LinkContext[] = [];

  for (const note of allNotes) {
    if (note.deletedAt) continue;
    const body = note.body ?? '';
    if (!noteReferencesTitle(body, targetTitle)) continue;

    const paragraphHasLink = (paragraph: string) =>
      extractLinks(paragraph).some(link => normalizeWikiTitle(link) === targetKey);

    const paragraphs = body.split(/\n{2,}/);
    let excerpts = paragraphs
      .filter(paragraphHasLink)
      .slice(0, maxExcerpts)
      .map(paragraph => {
        const clean = paragraph
          .split('\n')
          .map(line => line.replace(/^#{1,6}\s+/, '').trim())
          .filter(Boolean)
          .join(' ');
        return clean.length > excerptMax ? `${clean.slice(0, excerptMax)}…` : clean;
      });

    if (excerpts.length === 0) {
      excerpts = body
        .split('\n')
        .filter(paragraphHasLink)
        .slice(0, maxExcerpts)
        .map(line => {
          const clean = line.replace(/^#{1,6}\s+/, '').trim();
          return clean.length > excerptMax ? `${clean.slice(0, excerptMax)}…` : clean;
        });
    }

    if (excerpts.length > 0) {
      results.push({ noteId: note.id, noteTitle: note.title ?? '', excerpts });
    }
  }

  return results;
}

export function getParagraphOffsetIndexSnapshot(): ParagraphOffsetIndex {
  return paragraphOffsetCache;
}
