import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { buildBacklinkIndex, getBacklinkCount } from '../backlinks';

export interface ReviewNoteEntry {
  noteId: string;
  noteTitle: string;
  /** Primary sort metric — timestamp ms or link count */
  metric: number;
  /** Human-readable secondary label */
  meta: string;
}

export interface KnowledgeReviewLists {
  recentlyEdited: ReviewNoteEntry[];
  recentlyCreated: ReviewNoteEntry[];
  mostLinked: ReviewNoteEntry[];
  leastRevisited: ReviewNoteEntry[];
}

export interface BuildKnowledgeReviewOptions {
  limit?: number;
  /** Exclude trash notes — default true */
  activeOnly?: boolean;
}

function noteCreatedAt(note: NoteBase): number {
  if (note.createdAt) return note.createdAt;
  const parsed = Number(note.id.split('-')[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : note.updatedAt;
}

function formatRelativeAge(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return '오늘';
  if (days === 1) return '1일 전';
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(months / 12)}년 전`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

/** Build lightweight review lists for rediscovery — no SRS, no AI. */
export function buildKnowledgeReviewLists(
  notes: readonly NoteBase[],
  opts: BuildKnowledgeReviewOptions = {},
): KnowledgeReviewLists {
  const limit = opts.limit ?? 8;
  const activeOnly = opts.activeOnly !== false;
  const now = Date.now();

  const active = notes.filter(n => !activeOnly || !n.deletedAt);
  const index = buildBacklinkIndex(active);

  const toEntry = (note: NoteBase, metric: number, meta: string): ReviewNoteEntry => ({
    noteId: note.id,
    noteTitle: displayNoteTitle(note.title),
    metric,
    meta,
  });

  const recentlyEdited = [...active]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(n => toEntry(n, n.updatedAt, formatRelativeAge(n.updatedAt, now)));

  const recentlyCreated = [...active]
    .sort((a, b) => noteCreatedAt(b) - noteCreatedAt(a))
    .slice(0, limit)
    .map(n => {
      const created = noteCreatedAt(n);
      return toEntry(n, created, formatDate(created));
    });

  const mostLinked = [...active]
    .map(note => {
      const incoming = getBacklinkCount(index, note.title ?? '', note.id);
      const outgoing = index.outgoingByNoteId.get(note.id)?.length ?? 0;
      const total = incoming + outgoing;
      return { note, total, incoming, outgoing };
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total || b.note.updatedAt - a.note.updatedAt)
    .slice(0, limit)
    .map(({ note, total, incoming, outgoing }) =>
      toEntry(note, total, `백링크 ${incoming} · 나감 ${outgoing}`),
    );

  const leastRevisited = [...active]
    .filter(n => (n.body ?? '').trim().length > 0)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, limit)
    .map(n => toEntry(n, n.updatedAt, `${formatRelativeAge(n.updatedAt, now)} 수정`));

  return {
    recentlyEdited,
    recentlyCreated,
    mostLinked,
    leastRevisited,
  };
}
