/**
 * K-118 — Media URL detection and display labels (no storage/schema changes).
 */
import type { Block } from './blockUtils';

export type MediaKind = 'youtube' | 'pdf' | 'audio' | 'video' | 'web' | 'file';

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;
const PDF_EXT = /\.pdf(\?.*)?$/i;

const YOUTUBE_RE =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractLoneUrl(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(/^<(https?:\/\/[^>]+)>$/);
  if (angle) return angle[1]!;
  const bare = trimmed.match(/^(https?:\/\/\S+)$/);
  if (bare) return bare[1]!;
  const md = trimmed.match(/^\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
  if (md && !md[1]?.trim()) return md[2]!;
  return null;
}

export function youtubeVideoId(url: string): string | null {
  const m = url.trim().match(YOUTUBE_RE);
  return m?.[1] ?? null;
}

export function classifyMediaUrl(url: string): MediaKind {
  const id = youtubeVideoId(url);
  if (id) return 'youtube';
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (PDF_EXT.test(path)) return 'pdf';
    if (AUDIO_EXT.test(path)) return 'audio';
    if (VIDEO_EXT.test(path)) return 'video';
  } catch {
    // ignore
  }
  return 'web';
}

export function fileNameFromUrl(url: string): string {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    return base || 'file';
  } catch {
    return 'file';
  }
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function isLongUrl(url: string, max = 48): boolean {
  return url.length > max;
}

export function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

export function faviconUrl(url: string): string {
  const host = hostFromUrl(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

/** K-118 — Human-readable preview kind label (not raw URL). */
export function formatMediaDisplayLabel(kind: MediaKind, url: string): string {
  const name = fileNameFromUrl(url);
  switch (kind) {
    case 'youtube':
      return 'YouTube';
    case 'pdf':
      return name.toLowerCase().endsWith('.pdf') ? name : 'PDF';
    case 'audio':
      return AUDIO_EXT.test(name) ? name.replace(/\?.*$/, '') : 'Audio';
    case 'video':
      return VIDEO_EXT.test(name) ? name.replace(/\?.*$/, '') : 'Video';
    case 'web':
      return hostFromUrl(url);
    default:
      return name;
  }
}

export function paragraphShowsEmbedPreview(block: Pick<Block, 'type' | 'content'>): string | null {
  if (block.type !== 'paragraph') return null;
  return extractLoneUrl(block.content);
}
