import { useCallback } from 'react';
import type { NoteBase as Note } from '../../noteUtils';
import { normalizeNoteFolderId } from '../../noteUtils';
import { serializeNoteMarkdown, parseNoteMarkdown } from '../../features/knowledge';
import { downloadVaultBackup } from '../../../../lib/exportVaultBackup';
import { downloadVaultBackupZip } from '../../../../lib/vaultBackupZip';
import { runAccountScopedVaultExport } from '../../../../lib/vaultBackupFlow';
import { productionHealthRoutinePersistence } from '../../../../lib/healthRoutineSync';
import { observePublishedNotesHydration, useNotesStore } from '../../../../store/useNotesStore';
import { createLocalAttachmentBlobAdapter } from '../../../../lib/attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from '../../../../lib/attachmentMetadataIndexedDb';
import { attachLocalImageToNote } from '../../../../lib/localImageAttachments';
import { attachmentReferenceAck } from '../../../../lib/notesAttachmentReferenceAck';
import { isReturnToUseAttachmentIsolationEnabled } from '../../../../lib/returnToUseAttachmentIsolation';
import type { UseNoteViewActionsParams } from './types';

const attachmentRepository = createLocalAttachmentMetadataRepository();
const attachmentBlobAdapter = createLocalAttachmentBlobAdapter();

export function useNoteImportExportActions(params: UseNoteViewActionsParams) {
  const {
    notes,
    activeNote,
    activeFolderId,
    viewMode,
    blockEditorRef,
    docCopyTimerRef,
    setDocCopied,
    setIsDragOver,
    importNote,
  } = params;
  // The rendered callback owns this request; never rebind a retained callback to a later account.
  const attachmentObservation = observePublishedNotesHydration();
  const attachmentOwner = attachmentObservation.status === 'CURRENT' ? attachmentObservation.request : null;

  const exportNote = useCallback((note: Note) => {
    const blob = new Blob([serializeNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[/\\?%*:|"<>]/g, '-') || 'untitled'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportAllNotes = useCallback(() => {
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    const nameCount: Record<string, number> = {};
    active.forEach((note, idx) => {
      const safeName = (note.title ?? 'untitled').replace(/[/\\?%*:|"<>]/g, '-') || 'untitled';
      const count = nameCount[safeName] ?? 0;
      nameCount[safeName] = count + 1;
      const fileName = count > 0 ? `${safeName}_${count}.md` : `${safeName}.md`;
      setTimeout(() => {
        const blob = new Blob([serializeNoteMarkdown(note)], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }, idx * 200);
    });
  }, [notes]);

  const exportVaultBackup = useCallback(async () => {
    const store = useNotesStore.getState();
    const accountId = store.activeAccountId;
    const folders = store.folders;
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    await runAccountScopedVaultExport({
      notes: active, folders, cloud: null, accountId, format: 'zip',
    }, {
      readHealthRoutineState: id => productionHealthRoutinePersistence.snapshot(id),
      isAccountCurrent: id => useNotesStore.getState().activeAccountId === id,
      downloadZip: downloadVaultBackupZip,
      downloadJson: downloadVaultBackup,
    });
  }, [notes]);

  const exportVaultBackupJson = useCallback(async () => {
    const store = useNotesStore.getState();
    const accountId = store.activeAccountId;
    const folders = store.folders;
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    await runAccountScopedVaultExport({
      notes: active, folders, cloud: null, accountId, format: 'json',
    }, {
      readHealthRoutineState: id => productionHealthRoutinePersistence.snapshot(id),
      isAccountCurrent: id => useNotesStore.getState().activeAccountId === id,
      downloadZip: downloadVaultBackupZip,
      downloadJson: downloadVaultBackup,
    });
  }, [notes]);

  const handleCopyDocument = useCallback(async () => {
    const ok = await blockEditorRef.current?.copyDocument();
    if (!ok) return;
    setDocCopied(true);
    if (docCopyTimerRef.current) clearTimeout(docCopyTimerRef.current);
    docCopyTimerRef.current = setTimeout(() => setDocCopied(false), 1500);
  }, [blockEditorRef, docCopyTimerRef, setDocCopied]);

  const insertImageAtCursor = useCallback((name: string, src: string) => {
    if (viewMode !== 'edit' || !blockEditorRef.current || isReturnToUseAttachmentIsolationEnabled()) return;
    blockEditorRef.current.insertImage(src, name);
  }, [viewMode, blockEditorRef]);

  const insertEmptyImageBlockAtCursor = useCallback(() => {
    if (viewMode !== 'edit' || !blockEditorRef.current || isReturnToUseAttachmentIsolationEnabled()) return;
    blockEditorRef.current.insertEmptyImageBlock();
  }, [viewMode, blockEditorRef]);

  const attachImageFilesToActiveNote = useCallback(async (files: readonly File[]) => {
    if (!activeNote || viewMode !== 'edit' || isReturnToUseAttachmentIsolationEnabled()) return attachmentReferenceAck('DENIED');
    const current = () => {
      const publication = observePublishedNotesHydration(), store = useNotesStore.getState();
      return attachmentOwner !== null && publication.status === 'CURRENT' && publication.request === attachmentOwner
        && store.activeAccountId === attachmentOwner.accountId && store.activeNoteId === activeNote.id
        && store.notes.find(note => note.id === activeNote.id) === activeNote && activeNote.deletedAt === null
        && !isReturnToUseAttachmentIsolationEnabled();
    };
    if (!current()) return attachmentReferenceAck('DENIED');
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return attachmentReferenceAck('NOT_STARTED');
    const staged = [];
    for (const file of imageFiles) {
      if (!current()) return attachmentReferenceAck('DENIED');
      const result = await attachLocalImageToNote({
        accountId: attachmentOwner!.accountId,
        noteId: activeNote.id,
        file,
        currentBody: activeNote.body,
        repository: attachmentRepository,
        blobAdapter: attachmentBlobAdapter,
      });
      if (!current() || !result.isCurrent()) return attachmentReferenceAck('DENIED');
      staged.push(result);
    }
    if (!current() || !staged.every(result => result.isCurrent())) return attachmentReferenceAck('DENIED');
    return useNotesStore.getState().persistAttachmentReferences(attachmentOwner!, activeNote, staged);
  }, [activeNote, attachmentOwner, viewMode]);

  const handleEditorDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!activeNote || viewMode !== 'edit') return;
    if ((e.target as HTMLElement).closest('.be-image-block')) return;
    // Event handlers have no acknowledgement consumer; failure must never be shown as success.
    void attachImageFilesToActiveNote(Array.from(e.dataTransfer.files)).catch(() => undefined);
  }, [activeNote, viewMode, attachImageFilesToActiveNote, setIsDragOver]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const raw = ev.target?.result as string;
        const { body, properties } = parseNoteMarkdown(raw);
        const title = file.name.replace(/\.md$/i, '');
        const id = `note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        importNote({
          id, title, body, updatedAt: Date.now(),
          folderId: normalizeNoteFolderId(activeFolderId),
          deletedAt: null, starred: false,
          properties,
        });
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  }, [activeFolderId, importNote]);

  return {
    exportNote,
    exportAllNotes,
    exportVaultBackup,
    exportVaultBackupJson,
    handleCopyDocument,
    insertImageAtCursor,
    insertEmptyImageBlockAtCursor,
    attachImageFilesToActiveNote,
    handleEditorDrop,
    handleImport,
  };
}
