import type { NoteBase } from '../../../noteUtils';
import { normalizeNoteProperties } from '../../../noteUtils';

/** Case-insensitive property key for lookup */
export function normalizePropertyKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Get a property value by key (case-insensitive) */
export function getProperty(note: NoteBase, key: string): string | undefined {
  const props = note.properties;
  if (!props) return undefined;

  const target = normalizePropertyKey(key);
  for (const [k, v] of Object.entries(props)) {
    if (normalizePropertyKey(k) === target) return v;
  }
  return undefined;
}

/** Set a property, preserving original key casing for display */
export function setProperty(note: NoteBase, key: string, value: string): NoteBase {
  const trimmedKey = key.trim();
  if (!trimmedKey) return note;

  const target = normalizePropertyKey(trimmedKey);
  const props = { ...(note.properties ?? {}) };

  for (const k of Object.keys(props)) {
    if (normalizePropertyKey(k) === target) delete props[k];
  }
  props[trimmedKey] = value;

  return { ...note, properties: props };
}

/** Remove a property by key (case-insensitive) */
export function removeProperty(note: NoteBase, key: string): NoteBase {
  if (!note.properties) return note;

  const target = normalizePropertyKey(key);
  const props = { ...note.properties };
  for (const k of Object.keys(props)) {
    if (normalizePropertyKey(k) === target) delete props[k];
  }

  const properties = Object.keys(props).length > 0 ? props : undefined;
  return { ...note, properties };
}

/** List all properties preserving stored key casing */
export function listProperties(note: NoteBase): { key: string; value: string }[] {
  if (!note.properties) return [];
  return Object.entries(note.properties).map(([key, value]) => ({ key, value }));
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function escapeYamlValue(value: string): string {
  if (/[:#\n\r]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
    return JSON.stringify(value);
  }
  return value;
}

function parseFrontmatterLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const colon = trimmed.indexOf(':');
  if (colon <= 0) return null;

  const key = trimmed.slice(0, colon).trim();
  let value = trimmed.slice(colon + 1).trim();
  if (!key) return null;

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      value = JSON.parse(value.startsWith('"') ? value : `"${value.slice(1, -1)}"`);
    } catch {
      value = value.slice(1, -1);
    }
  }

  return { key, value };
}

/** Parse simple YAML frontmatter from imported markdown */
export function parseNoteMarkdown(raw: string): { body: string; properties?: Record<string, string> } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { body: raw };

  const properties: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const parsed = parseFrontmatterLine(line);
    if (parsed) properties[parsed.key] = parsed.value;
  }

  return {
    body: raw.slice(match[0].length).replace(/^\n+/, ''),
    properties: normalizeNoteProperties(properties),
  };
}

/** Serialize note body with optional YAML frontmatter for export */
export function serializeNoteMarkdown(note: NoteBase): string {
  const entries = listProperties(note);
  if (entries.length === 0) return note.body ?? '';

  const frontmatter = entries
    .map(({ key, value }) => `${key}: ${escapeYamlValue(value)}`)
    .join('\n');

  const body = note.body ?? '';
  return `---\n${frontmatter}\n---\n\n${body}`;
}
