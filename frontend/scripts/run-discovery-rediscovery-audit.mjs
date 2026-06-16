/**
 * K-89D — Manual discovery rediscovery audit runner.
 * Usage: npm run audit:discovery
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', 'discoveryRediscoveryAudit'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, RUN_VAULT_AUDIT: '1' },
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
