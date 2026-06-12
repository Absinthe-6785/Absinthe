import type { NoteBase } from '../../../noteUtils';
import { normalizeNoteProperties } from '../../../noteUtils';
import {
  isTagsPropertyKey,
  TAGS_PROPERTY_KEY,
  tagsFromPropertyValue,
  tagsToPropertyValue,
} from '../tags/tagConstants';
import {
  parseRelationsFrontmatter,
  serializeRelationsFrontmatter,
} from '../relations/relationMarkdown';

/** Case-insensitive property key for lookup */
export function normalizePropertyKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Get a property value by key (case-insensitive) */
export function getProperty(note: NoteBase, key: string): string | undefined {
  const props = note.properties;
  if (!props) return undefined;

  const target = normalizePropertyKey(key);
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (normalizePropertyKey(k) !== target) continue;
    if (typeof v === 'string') return v;
    if (isTagsPropertyKey(k) && Array.isArray(v)) {
      return tagsToPropertyValue(v.filter((t: unknown): t is string => typeof t === 'string'));
    }
    return undefined;
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

/** List all properties preserving stored key casing (includes reserved keys) */
export function listProperties(note: NoteBase): { key: string; value: string }[] {
  if (!note.properties) return [];
  return Object.entries(note.properties).map(([key, value]) => ({ key, value }));
}

/** User-editable properties — excludes reserved keys like tags */
export function listUserProperties(note: NoteBase): { key: string; value: string }[] {
  return listProperties(note).filter(p => !isTagsPropertyKey(p.key));
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

function parseFrontmatterContent(content: string): Record<string, string> {
  const properties: Record<string, string> = {};
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    if (/^relations\s*:\s*$/i.test(trimmed)) {
      i++;
      while (i < lines.length && /^\s/.test(lines[i])) i++;
      continue;
    }

    if (/^tags\s*:\s*$/i.test(trimmed)) {
      const tags: string[] = [];
      i++;
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*-\s+/, '').trim();
        if (
          (item.startsWith('"') && item.endsWith('"')) ||
          (item.startsWith("'") && item.endsWith("'"))
        ) {
          item = item.slice(1, -1);
        }
        if (item) tags.push(item);
        i++;
      }
      if (tags.length > 0) {
        properties[TAGS_PROPERTY_KEY] = tagsToPropertyValue(tags);
      }
      continue;
    }

    const parsed = parseFrontmatterLine(line);
    if (parsed && !isTagsPropertyKey(parsed.key)) {
      properties[parsed.key] = parsed.value;
    }
    i++;
  }

  return properties;
}

/** Parse simple YAML frontmatter from imported markdown */
export function parseNoteMarkdown(raw: string): {
  body: string;
  properties?: Record<string, string>;
  relations?: Record<string, string[]>;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { body: raw };

  const properties = parseFrontmatterContent(match[1]);
  const relations = parseRelationsFrontmatter(match[1]);

  return {
    body: raw.slice(match[0].length).replace(/^\n+/, ''),
    properties: normalizeNoteProperties(properties),
    relations,
  };
}

/** Serialize note body with optional YAML frontmatter for export */
export function serializeNoteMarkdown(note: NoteBase): string {
  const tags = tagsFromPropertyValue(getProperty(note, TAGS_PROPERTY_KEY));
  const userProps = listUserProperties(note);
  const relationLines = serializeRelationsFrontmatter(note.relations);

  if (tags.length === 0 && userProps.length === 0 && relationLines.length === 0) {
    return note.body ?? '';
  }

  const lines: string[] = [];
  if (tags.length > 0) {
    lines.push('tags:');
    for (const tag of tags) {
      lines.push(`  - ${escapeYamlValue(tag)}`);
    }
  }
  lines.push(...relationLines);
  for (const { key, value } of userProps) {
    lines.push(`${key}: ${escapeYamlValue(value)}`);
  }

  const body = note.body ?? '';
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}
