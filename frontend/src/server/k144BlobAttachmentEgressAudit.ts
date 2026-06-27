import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..');

function readFrontend(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

const USER_BLOB_PATTERNS = [
  'readAsDataURL',
  'data:image',
  'data:application/pdf',
  'FileReader',
] as const;

const SUPABASE_STORAGE_PATTERNS = [
  `supabase${'.'}storage`,
  `${'.'}storage${'.'}from`,
  'getPublicUrl',
  `signed${'Url'}`,
  'createSignedUrl',
] as const;

export interface K144BlobAttachmentAudit {
  noteSyncPayloadFields: readonly string[];
  noteSyncPayloadSanitizesBlobData: boolean;
  noteModelHasRawAttachmentField: boolean;
  supabaseStorageCallSites: readonly string[];
  userGeneratedBlobEntryPoints: readonly string[];
  explicitExportBlobPaths: readonly string[];
  knowledgeRawBlobHydrationRisks: readonly string[];
  localModeDefault: boolean;
}

export function runK144BlobAttachmentEgressAudit(): K144BlobAttachmentAudit {
  const noteUtils = readFrontend('components/views/noteUtils.ts');
  const syncMode = readFrontend('lib/syncMode.ts');
  const app = readFrontend('App.tsx');
  const appContent = readFrontend('components/AppContent.tsx');
  const imageBlock = readFrontend('components/views/ImageBlock.tsx');
  const noteActions = readFrontend('components/views/noteview/actions/useNoteImportExportActions.ts');
  const editorArea = readFrontend('components/views/noteview/NoteViewEditorArea.tsx');
  const knowledgeIndex = readFrontend('components/views/features/knowledge/KnowledgeIndexService.ts');
  const discovery = readRepo('frontend/src/components/views/features/knowledge/discovery/discoveryEngine.ts');
  const backupZip = readFrontend('lib/vaultBackupZip.ts');
  const backupJson = readFrontend('lib/exportVaultBackup.ts');
  const csvExport = readFrontend('lib/csvExport.ts');
  const backend = readRepo('backend/main.py');

  const repoSurface = [
    app,
    appContent,
    imageBlock,
    noteActions,
    editorArea,
    knowledgeIndex,
    discovery,
    backupZip,
    backupJson,
    csvExport,
    backend,
  ].join('\n');

  const supabaseStorageCallSites = SUPABASE_STORAGE_PATTERNS
    .filter(pattern => repoSurface.includes(pattern));

  const userGeneratedBlobEntryPoints = [
    imageBlock.includes('readAsDataURL') ? 'ImageBlock file/drop/paste stores local data URLs' : '',
    noteActions.includes('readAsDataURL') ? 'Note editor drag-drop image import stores local data URLs' : '',
    editorArea.includes('readAsDataURL') ? 'Note editor paste image import stores local data URLs' : '',
  ].filter(Boolean);

  const knowledgeSurface = [knowledgeIndex, discovery].join('\n');
  const knowledgeRawBlobHydrationRisks = USER_BLOB_PATTERNS
    .filter(pattern => knowledgeSurface.includes(pattern));

  return {
    noteSyncPayloadFields: ['id', 'title', 'body', 'updated_at', 'folder_id', 'deleted_at', 'starred', 'properties', 'relations'],
    noteSyncPayloadSanitizesBlobData:
      noteUtils.includes('stripRawBlobData(note.body') &&
      noteUtils.includes('sanitizeStringRecordForSync') &&
      noteUtils.includes('sanitizeRelationsForSync'),
    noteModelHasRawAttachmentField: /\b(?:attachment|attachments|blob|file|files|pdf|thumbnail)\??:/.test(noteUtils),
    supabaseStorageCallSites,
    userGeneratedBlobEntryPoints,
    explicitExportBlobPaths: [
      backupZip.includes("type: 'blob'") && backupZip.includes('URL.createObjectURL') ? 'vaultBackupZip explicit download' : '',
      backupJson.includes('new Blob') && backupJson.includes('URL.createObjectURL') ? 'exportVaultBackup explicit download' : '',
      csvExport.includes('new Blob') && csvExport.includes('URL.createObjectURL') ? 'csvExport explicit download' : '',
    ].filter(Boolean),
    knowledgeRawBlobHydrationRisks,
    localModeDefault: syncMode.includes("return 'local'"),
  };
}
