/** K-114 — Backend memory profile audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '../../../backend');

export const K114_PROFILED_ROUTES = [
  'GET /api/notes',
  'GET /api/note_folders',
  'GET /api/backup',
] as const;

export function auditMemoryProfile(): readonly string[] {
  const main = readFileSync(join(BACKEND, 'main.py'), 'utf8');
  const profile = readFileSync(join(BACKEND, 'memory_profile.py'), 'utf8');
  const watchdog = readFileSync(join(BACKEND, 'request_memory_watchdog.py'), 'utf8');
  return [
    profile.includes('MemoryDelta') ? 'memory-delta' : 'missing-delta',
    profile.includes('rss_delta') ? 'rss-delta' : 'missing-rss-delta',
    watchdog.includes('request_id') ? 'request-id' : 'missing-request-id',
    watchdog.includes('duration_ms') ? 'duration-ms' : 'missing-duration',
    main.includes('RequestMemoryWatchdog') ? 'middleware-wired' : 'middleware-missing',
    ...K114_PROFILED_ROUTES,
  ];
}
