import { normalizeNoteRelations } from './relationNormalize';

function escapeYamlValue(value: string): string {
  if (/[:#\n\r]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
    return JSON.stringify(value);
  }
  return value;
}

function unquoteYamlItem(item: string): string {
  let value = item.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

/** Parse relations block from YAML frontmatter content */
export function parseRelationsFrontmatter(content: string): Record<string, string[]> | undefined {
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (/^relations\s*:\s*$/i.test(trimmed)) {
      i++;
      const relations: Record<string, string[]> = {};

      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
          i++;
          continue;
        }
        if (!/^\s+/.test(line)) break;

        const keyMatch = line.match(/^\s{2}([^:\s][^:]*):\s*$/);
        if (!keyMatch) break;

        const propertyKey = keyMatch[1].trim();
        const targetIds: string[] = [];
        i++;

        while (i < lines.length && /^\s{4}-\s+/.test(lines[i])) {
          const item = unquoteYamlItem(lines[i].replace(/^\s{4}-\s+/, ''));
          if (item) targetIds.push(item);
          i++;
        }

        if (targetIds.length > 0) {
          relations[propertyKey] = targetIds;
        }
      }

      return normalizeNoteRelations(relations);
    }
    i++;
  }

  return undefined;
}

/** Serialize relations as YAML frontmatter lines */
export function serializeRelationsFrontmatter(
  relations: Record<string, string[]> | undefined,
): string[] {
  if (!relations || Object.keys(relations).length === 0) return [];

  const lines = ['relations:'];
  for (const [key, targetIds] of Object.entries(relations)) {
    lines.push(`  ${key}:`);
    for (const targetId of targetIds) {
      lines.push(`    - ${escapeYamlValue(targetId)}`);
    }
  }
  return lines;
}
