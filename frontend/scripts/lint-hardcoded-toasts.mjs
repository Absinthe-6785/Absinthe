/**
 * Flags showToast calls with hardcoded string literals (K-67).
 * Allows t('key') and template literals that start with t(.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(frontendDir, 'src');

const HARDCODED = /showToast\s*\(\s*['"`][^'"`]+['"`]/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(srcDir)) {
  const rel = path.relative(frontendDir, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (HARDCODED.test(line)) {
      violations.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
    HARDCODED.lastIndex = 0;
  });
}

if (violations.length > 0) {
  console.error('Hardcoded showToast strings:\n');
  for (const v of violations) console.error(v);
  process.exit(1);
}

console.log('lint:hardcoded-toasts — no hardcoded showToast literals');
