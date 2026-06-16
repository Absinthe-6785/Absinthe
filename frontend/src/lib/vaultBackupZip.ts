import JSZip from 'jszip';
import { normalizeVaultBackupManifest, type VaultBackupManifest } from './exportVaultBackup';
import { buildCloudZipSidecars } from './vaultCloudCsv';

const README_V3 = `Absinthe Vault Backup (v3)
============================
This archive contains:
- manifest.json  — full portable vault (notes, folders, extensions, optional cloud)
- notes/         — individual Markdown exports per note
- cloud/         — human-readable CSV sidecars (when cloud data was exported)

Restore via Settings → Import Vault Backup.
v2 and v3 manifests are supported on import (core notes + folders).
Extension and cloud restore UI is planned in K-88C/K-88B-3.
`;

function safeFileName(title: string, id: string): string {
  const base = (title || 'untitled').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'untitled';
  return `${base}-${id.slice(-6)}.md`;
}

export async function buildVaultBackupZip(manifest: VaultBackupManifest): Promise<Blob> {
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('README.txt', README_V3);

  const notesDir = zip.folder('notes');
  const nameCount: Record<string, number> = {};

  for (const entry of manifest.notes) {
    let fileName = safeFileName(entry.title, entry.id);
    const count = nameCount[fileName] ?? 0;
    nameCount[fileName] = count + 1;
    if (count > 0) {
      fileName = fileName.replace(/\.md$/, `_${count}.md`);
    }
    notesDir?.file(fileName, entry.markdown);
  }

  if (manifest.cloud && manifest.cloud.completeness !== 'skipped') {
    const sidecars = buildCloudZipSidecars(manifest.cloud);
    for (const [path, content] of Object.entries(sidecars)) {
      zip.file(path, content);
    }
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function downloadVaultBackupZip(manifest: VaultBackupManifest): Promise<void> {
  const blob = await buildVaultBackupZip(manifest);
  const date = manifest.exportedAt.slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `absinthe-backup-${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseVaultBackupZip(file: Blob): Promise<VaultBackupManifest | null> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) return null;
    const raw = await manifestFile.async('string');
    const data = JSON.parse(raw) as Partial<VaultBackupManifest>;
    return normalizeVaultBackupManifest(data);
  } catch {
    return null;
  }
}
