import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(process.cwd(), 'src');

function listSourceFiles(dir = SRC_ROOT): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

function sourceText(path: string): string {
  return readFileSync(path, 'utf8');
}

function isProductionSource(path: string): boolean {
  return !/\.test\.(ts|tsx)$/.test(path);
}

describe('K-141 local-mode remote boundary audit', () => {
  it('does not introduce Supabase realtime, storage, or edge function paths', () => {
    const offenders = listSourceFiles()
      .filter(isProductionSource)
      .map(path => ({ path, text: sourceText(path) }))
      .filter(({ path }) => !path.endsWith('k141LocalModeRemoteBoundaryAudit.test.ts'))
      .filter(({ text }) =>
        /\.channel\s*\(/.test(text)
        || /\.storage\b/.test(text)
        || /functions\.invoke\s*\(/.test(text),
      )
      .map(({ path }) => relative(SRC_ROOT, path));

    expect(offenders).toEqual([]);
  });

  it('keeps automatic SWR API keys behind the remote boundary helper', () => {
    const offenders = listSourceFiles(join(SRC_ROOT, 'components'))
      .concat(listSourceFiles(join(SRC_ROOT, 'hooks')))
      .filter(isProductionSource)
      .map(path => ({ path, text: sourceText(path) }))
      .filter(({ text }) => text.includes('useSWR'))
      .filter(({ text }) => /useSWR[^(]*\(\s*(?:`|["'])/.test(text))
      .map(({ path }) => relative(SRC_ROOT, path));

    expect(offenders).toEqual([]);
  });
});
