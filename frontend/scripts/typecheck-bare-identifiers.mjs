/**
 * Fails CI when app-wide tsc reports TS2304 (Cannot find name) errors.
 * Catches missing imports / bare identifiers without requiring full app type cleanliness.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let output = '';
try {
  execFileSync(npx, ['tsc', '--noEmit', '-p', 'tsconfig.app.json'], {
    cwd: frontendDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  const e = err;
  output = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
}

const bare = output.split(/\r?\n/).filter(line => /error TS2304:/.test(line));
if (bare.length > 0) {
  console.error('Bare identifiers (TS2304) in app scope:\n');
  for (const line of bare) console.error(line);
  process.exit(1);
}

console.log('typecheck:undefined — no TS2304 bare-identifier errors (app scope)');
