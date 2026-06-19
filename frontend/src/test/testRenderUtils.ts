/**
 * K-120 — shared audit file-read helpers.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve `frontend/src` from an audit module under `components/views` or `server`. */
export function auditSrcRoot(fromModuleUrl: string, levelsUp = 2): string {
  return join(dirname(fileURLToPath(fromModuleUrl)), ...Array(levelsUp).fill('..'));
}

export function readSrcFile(fromModuleUrl: string, relativePath: string, levelsUp = 2): string {
  return readFileSync(join(auditSrcRoot(fromModuleUrl, levelsUp), relativePath), 'utf8');
}

export function srcIncludes(fromModuleUrl: string, relativePath: string, needle: string): boolean {
  return readSrcFile(fromModuleUrl, relativePath).includes(needle);
}
