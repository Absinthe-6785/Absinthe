import { webcrypto } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';
import { createServer } from 'vite';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage() {
  return [
    'Recovery preservation only; this command never restores or synchronizes data.',
    'npm run recovery:export -- --input <vault-backup.json> --output <directory>',
    'npm run recovery:verify -- --package <directory-or-zip>',
  ].join('\n');
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function loadModules() {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const packageModule = await server.ssrLoadModule('/src/lib/recoveryExportPackage.ts');
  const adapterModule = await server.ssrLoadModule('/src/lib/recoveryExportSourceAdapters.ts');
  return { server, packageModule, adapterModule };
}

async function readDirectory(root) {
  const files = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files[path.relative(root, absolute).replace(/\\/g, '/')] = await readFile(absolute, 'utf8');
    }
  }
  await visit(root);
  return files;
}

async function readPackage(packagePath) {
  if (packagePath.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await readFile(packagePath));
    const files = {};
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const normalized = name.replace(/^absinthe-recovery-export\//, '');
      files[normalized] = await entry.async('string');
    }
    return files;
  }
  const nested = path.join(packagePath, 'absinthe-recovery-export');
  try { return await readDirectory(nested); } catch { return readDirectory(packagePath); }
}

async function exportPackage(packageModule, adapterModule) {
  const inputPath = option('--input');
  const outputPath = option('--output');
  if (!inputPath || !outputPath) throw new Error(usage());
  const input = path.resolve(inputPath);
  const output = path.resolve(outputPath);
  if (input === output || inside(output, input)) throw new Error('Output must not contain or overwrite the source backup');
  const sourceText = await readFile(input, 'utf8');
  const sourceManifest = JSON.parse(sourceText);
  const adapted = adapterModule.adaptVaultBackupManifest(sourceText, {
    kind: 'backup', label: path.basename(input), ownerScope: 'unconfirmed',
  });
  const built = await packageModule.buildRecoveryExportPackage(adapterModule.applyAdapterResult({
    exportedAt: sourceManifest.exportedAt,
  }, adapted));
  const root = path.join(output, 'absinthe-recovery-export');
  await mkdir(root, { recursive: true });
  for (const [relative, content] of Object.entries(built.files)) {
    const target = path.resolve(root, ...relative.split('/'));
    if (!inside(root, target)) throw new Error('Unsafe output path rejected');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
  }
  const archive = await packageModule.createRecoveryExportArchive(built);
  await writeFile(path.join(output, 'absinthe-recovery-export.zip'), archive, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({
    status: 'exported', completeness: built.manifest.completeness,
    fileCount: built.manifest.fileCount, conflictCount: built.manifest.conflictCount,
  })}\n`);
}

async function verifyPackage(packageModule) {
  const packagePath = option('--package');
  if (!packagePath) throw new Error(usage());
  const files = await readPackage(path.resolve(packagePath));
  const result = await packageModule.verifyRecoveryExportPackage({ files });
  process.stdout.write(`${JSON.stringify({
    valid: result.valid, completeness: result.completeness,
    verifiedFiles: result.verifiedFiles.length,
    errorCodes: result.errors.map(item => item.code),
    warningCodes: result.warnings.map(item => item.code),
    conflictCodes: result.conflictDiagnostics.map(item => item.code),
  })}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (process.argv.includes('--help')) {
  process.stdout.write(`${usage()}\n`);
} else {
  const { server, packageModule, adapterModule } = await loadModules();
  try {
    if (process.argv[2] === 'export') await exportPackage(packageModule, adapterModule);
    else if (process.argv[2] === 'verify') await verifyPackage(packageModule);
    else throw new Error(usage());
  } finally {
    await server.close();
  }
}
