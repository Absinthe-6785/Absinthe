import type { NoteBase } from '../../../../noteUtils';
import { setProperty } from '../../properties/noteProperties';
import { applyAreaToNote } from '../../trace/areaNotes';

/** Append a wiki link to note body if not already present. */
export function appendWikiLinkIfMissing(body: string, title: string): string {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return body;
  const link = `[[${trimmedTitle}]]`;
  if (body.includes(link)) return body;
  const trimmed = body.trimEnd();
  if (!trimmed) return `${link}\n`;
  return `${trimmed}\n\n${link}\n`;
}

export function buildHubNoteTemplate(areaLabel: string): { title: string; body: string } {
  const label = areaLabel.trim() || 'Area';
  return {
    title: `${label} Hub`,
    body: `# Overview\n\n## Timeline\n\n## Key Concepts\n\n## Important Notes\n`,
  };
}

export interface NoteMutationPatch {
  body?: string;
  properties?: Record<string, string>;
  relations?: Record<string, string[]>;
}

export function buildAreaAssignmentPatch(
  note: NoteBase,
  areaLabel: string,
  linkTitle?: string,
): NoteMutationPatch {
  let updated = setProperty(note, 'area', areaLabel.trim());
  const patch: NoteMutationPatch = { properties: updated.properties };
  if (linkTitle?.trim()) {
    patch.body = appendWikiLinkIfMissing(note.body ?? '', linkTitle.trim());
  }
  return patch;
}

export function buildConnectPatch(note: NoteBase, targetTitle: string): NoteMutationPatch {
  return { body: appendWikiLinkIfMissing(note.body ?? '', targetTitle) };
}

export function buildHubCreationPatch(note: NoteBase): NoteMutationPatch {
  const withArea = applyAreaToNote(note);
  return { properties: withArea.properties };
}
