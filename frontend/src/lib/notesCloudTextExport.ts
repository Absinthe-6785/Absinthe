export interface NotesCloudTextDownload {
  readonly filename: string;
  readonly file: Blob;
}

const MAX_FILENAME_CODE_UNITS = 240;
const MAX_FILENAME_UTF8_BYTES = 255;
const FALLBACK_FILENAME_STEM = 'cloud-note';

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function exactIdFilenameToken(noteId: string): string {
  return Array.from({ length: noteId.length }, (_, index) => noteId.charCodeAt(index).toString(16).padStart(4, '0')).join('');
}

function safeFilenameStem(title: string | undefined, codeUnitLimit: number, utf8ByteLimit: number): string {
  let bounded = '';
  let bytes = 0;
  for (const character of typeof title === 'string' ? title : '') {
    const safeCharacter = character.replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\uD800-\uDFFF]/gu, '_');
    const characterBytes = utf8ByteLength(safeCharacter);
    if (bounded.length + safeCharacter.length > codeUnitLimit || bytes + characterBytes > utf8ByteLimit) break;
    bounded += safeCharacter;
    bytes += characterBytes;
  }
  const safe = bounded.trim().replace(/[. ]+$/g, '');
  const stem = safe || FALLBACK_FILENAME_STEM;
  const portableStem = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem) ? `note-${stem}` : stem;
  return portableStem.length <= codeUnitLimit && utf8ByteLength(portableStem) <= utf8ByteLimit ? portableStem : '';
}

/** Builds a byte-preserving Markdown Blob; the authored body is never decorated or normalized. */
export function createNotesCloudTextDownload(
  body: string,
  title: string | undefined,
  noteId: string,
): NotesCloudTextDownload | null {
  if (typeof body !== 'string' || typeof noteId !== 'string' || noteId.trim().length === 0) return null;
  const idToken = exactIdFilenameToken(noteId);
  const suffix = `-${idToken}.md`;
  const stemLimit = MAX_FILENAME_CODE_UNITS - suffix.length;
  const stemByteLimit = MAX_FILENAME_UTF8_BYTES - utf8ByteLength(suffix);
  if (stemLimit < 1 || stemByteLimit < 1) return null;
  const stem = safeFilenameStem(title, stemLimit, stemByteLimit);
  if (!stem || stem.length > stemLimit) return null;
  const filename = `${stem}${suffix}`;
  if (filename.length > MAX_FILENAME_CODE_UNITS || utf8ByteLength(filename) > MAX_FILENAME_UTF8_BYTES) return null;
  return Object.freeze({
    filename,
    file: new Blob([body], { type: 'text/markdown;charset=utf-8' }),
  });
}
