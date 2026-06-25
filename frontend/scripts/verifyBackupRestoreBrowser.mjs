import puppeteer from 'puppeteer';

const BASE_URL = process.env.ABSINTHE_URL ?? 'http://127.0.0.1:5173';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30_000 });

  const roundTrip = await page.evaluate(async () => {
    const { buildValidatedVaultBackupManifest } = await import('/src/lib/vaultBackupExport.ts');
    const { buildVaultRestorePreview, parseVaultBackupJson, applyVaultRestore } = await import('/src/lib/importVaultBackup.ts');

    const notes = [
      {
        id: 'browser-note-1',
        title: '',
        body: 'Browser round-trip body',
        folderId: null,
        starred: false,
        deletedAt: null,
        createdAt: 1,
        updatedAt: 2,
        properties: { status: 'active' },
        relations: {},
      },
      {
        id: 'browser-note-2',
        title: 'Named note',
        body: 'Second body',
        folderId: null,
        starred: false,
        deletedAt: null,
        createdAt: 1,
        updatedAt: 2,
        properties: {},
        relations: {},
      },
    ];

    const manifest = buildValidatedVaultBackupManifest(notes, [{ id: 'f1', name: 'Work', createdAt: 1 }]);
    const parsed = parseVaultBackupJson(JSON.stringify(manifest));
    if (!parsed) return { ok: false, step: 'parse', corrupted: [] };

    const preview = buildVaultRestorePreview(parsed, [], []);
    if (!preview.valid || !preview.manifest) {
      return {
        ok: false,
        step: 'preview',
        corrupted: preview.validation?.corruptedNoteIds ?? [],
        issues: preview.validation?.noteIssues?.map(issue => issue.message) ?? [],
      };
    }

    const { notes: restored } = applyVaultRestore(preview.manifest, [], [], 'replace');
    const first = restored.find(note => note.id === 'browser-note-1');
    const second = restored.find(note => note.id === 'browser-note-2');

    return {
      ok: true,
      step: 'restore',
      titles: [first?.title ?? null, second?.title ?? null],
      bodies: [first?.body ?? null, second?.body ?? null],
      property: first?.properties?.status ?? null,
      corrupted: preview.validation?.corruptedNoteIds ?? [],
      repaired: preview.validation?.repairedNoteIds ?? [],
    };
  });

  const appLoaded = await page.evaluate(() => ({
    title: document.title,
    hasRoot: Boolean(document.getElementById('root')),
  }));

  await browser.close();

  if (!roundTrip.ok) {
    console.error('Browser backup round-trip failed:', roundTrip);
    process.exit(1);
  }

  if (roundTrip.titles?.[0] !== 'Browser round-trip body') {
    console.error('Unexpected restored title:', roundTrip);
    process.exit(1);
  }

  console.log(JSON.stringify({
    appLoaded,
    roundTrip,
    result: 'Browser export → restore verified in Chromium',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
