import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const sourceRoot = join(frontendRoot, 'src');

async function sourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      result.push(path);
    }
  }
  return result;
}

describe('K-328 production dormancy audit', () => {
  it('has no active caller outside its isolated module', async () => {
    const references: string[] = [];
    for (const path of await sourceFiles(sourceRoot)) {
      const local = relative(sourceRoot, path).replaceAll('\\', '/');
      const text = await readFile(path, 'utf8');
      if (text.includes('runCrossContextReadOnlyHandoff')) references.push(local);
    }
    expect(references).toEqual(['lib/localDatabase/crossContextHandoff/handoff.ts']);
  });

  it('keeps K-326G production sources explicitly cross-context unsafe', async () => {
    const migration = await readFile(join(sourceRoot, 'lib/localDatabase/legacyNotesMigration.ts'), 'utf8');
    expect(migration.match(/mutationSafety: 'uncoordinated_legacy_writers', crossContextSafe: false/g))
      .toHaveLength(2);
    const cutover = await readFile(join(sourceRoot, 'lib/localDatabase/localFirstCutover.ts'), 'utf8');
    expect(cutover).toContain("if (!safety.crossContextSafe) fail('CUTOVER_SOURCE_NOT_CROSS_CONTEXT_SAFE'");
  });

  it('does not import network, UI, sync, restore, or legacy writer modules', async () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const production = (await readdir(directory)).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    const combined = (await Promise.all(production.map(name => readFile(join(directory, name), 'utf8')))).join('\n');
    for (const forbidden of [
      '@supabase', 'fetch(', 'XMLHttpRequest', 'WebSocket(', 'notePersistence', 'noteIndexedDb',
      'localFirstCutover', 'legacyNotesMigration', 'restore', 'react', 'setInterval(',
    ]) {
      expect(combined, forbidden).not.toContain(forbidden);
    }
  });
});
