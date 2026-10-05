import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { PROTOCOL, stableJSON } from './core.mjs';

export const root = path.dirname(fileURLToPath(import.meta.url));
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const style = 'body{font:17px system-ui;max-width:960px;margin:24px auto;padding:16px}button,input,select{font:inherit;min-height:44px;margin:8px;padding:8px}label{display:block}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:12px}a{display:inline-block;margin:12px}';
export async function artifacts(sourceGitSha) {
  if (!/^[a-f0-9]{40}$/.test(sourceGitSha)) throw new Error('EXACT_SOURCE_SHA_REQUIRED');
  const core = await readFile(path.join(root, 'core.mjs'));
  const ui = await readFile(path.join(root, 'ui.mjs'));
  // Builder identity included: changes to generated HTML/manifests change the ID too.
  const builder = await readFile(path.join(root, 'build.mjs'));
  const buildId = hash(Buffer.concat([Buffer.from(`${PROTOCOL}\n${sourceGitSha}\n`), core, ui, builder]));
  const files = new Map();
  files.set(`/${buildId}/core.mjs`, core); files.set(`/${buildId}/ui.mjs`, ui);
  files.set(`/${buildId}/style.css`, Buffer.from(style));
  files.set(`/${buildId}/icon.svg`, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="#e5e7eb"/><text x="96" y="116" text-anchor="middle" font-family="sans-serif" font-size="56">QA</text></svg>'));
  for (const role of ['old', 'current', 'neutral']) {
    const metadata = { role: `${role.toUpperCase()}_FIXTURE`, buildId, sourceGitSha,
      protocolVersion: PROTOCOL, manifestPath: `/${buildId}/artifact-manifest.json` };
    files.set(`/${buildId}/${role}/boot.mjs`, Buffer.from(`import { boot } from '../ui.mjs';\nboot(${JSON.stringify(metadata)});\n`));
    files.set(`/${buildId}/${role}/index.html`, Buffer.from(`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="apple-mobile-web-app-capable" content="yes"><title>PATH A QA ${role}</title><link rel="stylesheet" href="../style.css"><link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="../icon.svg"></head><body><p>Qualification fixture loading… No run started.</p><script type="module" src="./boot.mjs"></script></body></html>\n`));
    files.set(`/${buildId}/${role}/manifest.webmanifest`, Buffer.from(stableJSON({
      id: `/${buildId}/${role}/`, name: `PATH A qualification ${role.toUpperCase()}`,
      short_name: `QA ${role.toUpperCase()}`, start_url: `/${buildId}/${role}/`,
      scope: `/${buildId}/${role}/`, display: 'standalone', background_color: '#ffffff',
      icons: [{ src: `/${buildId}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }) + '\n'));
  }
  const manifest = { schemaVersion: 'rel05g-patha-artifacts-v1', buildId, sourceGitSha,
    protocolVersion: PROTOCOL, qualificationOnly: true,
    roles: ['OLD_FIXTURE', 'CURRENT_FIXTURE', 'NEUTRAL_FIXTURE'],
    assets: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => ({
      path: name, size: data.length, sha256: hash(data),
      role: /\/(old|current|neutral)\//.exec(name)?.[1].toUpperCase() ?? 'SHARED',
      buildId, sourceGitSha, protocolVersion: PROTOCOL,
    })) };
  const manifestBytes = Buffer.from(stableJSON(manifest) + '\n');
  files.set(`/${buildId}/artifact-manifest.json`, manifestBytes);
  files.set(`/${buildId}/artifact-manifest.sha256`, Buffer.from(`${hash(manifestBytes)}\n`));
  // No self-hash cycle: manifest lists assets; independent sidecar hashes manifest itself.
  return { buildId, manifest, manifestSha256: hash(manifestBytes), files };
}
export async function build(output, sourceGitSha) {
  const generated = await artifacts(sourceGitSha);
  for (const [name, data] of generated.files) {
    const destination = path.join(output, name.slice(1));
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      const existing = await readFile(destination);
      if (!existing.equals(data)) throw new Error('IMMUTABLE_ASSET_ALREADY_EXISTS_DIFFERENT');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeFile(destination, data, { flag: 'wx' });
    }
  }
  const index = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PATH A isolated QA delivery</title><h1>PATH A qualification only</h1><p>No product data, auth, authority or physical results. Use an exact deployment URL, not a moving alias, and the reviewed build below.</p><pre>Source ${sourceGitSha}\nBuild ${generated.buildId}\nManifest SHA-256 ${generated.manifestSha256}</pre>${['old', 'current', 'neutral'].map((role) => `<p><a href="/${generated.buildId}/${role}/">${role.toUpperCase()} fixture</a></p>`).join('')}<p>Physical runs require independent review, merge, closure and separate authorization. No test starts automatically.</p></html>\n`;
  await writeFile(path.join(output, 'index.html'), index);
  await writeFile(path.join(output, 'vercel.json'), stableJSON({
    framework: null, buildCommand: null, outputDirectory: '.',
    headers: [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" },
    ] }],
  }) + '\n');
  return generated;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const sourceGitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' });
  if (dirty && !process.argv.includes('--allow-dirty-for-tests')) throw new Error('RELEASE_BUILD_REQUIRES_CLEAN_TRACKED_HEAD');
  const output = path.join(root, 'dist', sourceGitSha);
  await mkdir(output, { recursive: true });
  await stat(output);
  const generated = await build(output, sourceGitSha);
  console.log(JSON.stringify({ output, sourceGitSha, buildId: generated.buildId, manifestSha256: generated.manifestSha256 }));
}
