import { useCallback } from 'react';
import type { NoteBase as Note } from '../../noteUtils';
import { normalizeNoteFolderId } from '../../noteUtils';
import { serializeNoteMarkdown, parseNoteMarkdown } from '../../features/knowledge';
import { buildValidatedVaultBackupManifest } from '../../../../lib/vaultBackupExport';
import { downloadVaultBackup } from '../../../../lib/exportVaultBackup';
import { downloadVaultBackupZip } from '../../../../lib/vaultBackupZip';
import { useNotesStore } from '../../../../store/useNotesStore';
import { createLocalAttachmentBlobAdapter } from '../../../../lib/attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from '../../../../lib/attachmentMetadataIndexedDb';
import { attachLocalImageToNote } from '../../../../lib/localImageAttachments';
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
    updateNote,
  } = params;

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
    const folders = useNotesStore.getState().folders;
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    await downloadVaultBackupZip(buildValidatedVaultBackupManifest(active, folders));
  }, [notes]);

  const exportVaultBackupJson = useCallback(() => {
    const folders = useNotesStore.getState().folders;
    const active = notes.filter(n => !n.deletedAt);
    if (active.length === 0) return;
    downloadVaultBackup(buildValidatedVaultBackupManifest(active, folders));
  }, [notes]);

  const handleCopyDocument = useCallback(async () => {
    const ok = await blockEditorRef.current?.copyDocument();
    if (!ok) return;
    setDocCopied(true);
    if (docCopyTimerRef.current) clearTimeout(docCopyTimerRef.current);
    docCopyTimerRef.current = setTimeout(() => setDocCopied(false), 1500);
  }, [blockEditorRef, docCopyTimerRef, setDocCopied]);

  const insertImageAtCursor = useCallback((name: string, src: string) => {
    if (viewMode !== 'edit' || !blockEditorRef.current) return;
    blockEditorRef.current.insertImage(src, name);
  }, [viewMode, blockEditorRef]);

  const insertEmptyImageBlockAtCursor = useCallback(() => {
    if (viewMode !== 'edit' || !blockEditorRef.current) return;
    blockEditorRef.current.insertEmptyImageBlock();
  }, [viewMode, blockEditorRef]);

  const attachImageFilesToActiveNote = useCallback((files: readonly File[]) => {
    if (!activeNote || viewMode !== 'edit') return;
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    void (async () => {
      let nextBody = activeNote.body;
      for (const file of imageFiles) {
        const result = await attachLocalImageToNote({
          noteId: activeNote.id,
          file,
          currentBody: nextBody,
          repository: attachmentRepository,
          blobAdapter: attachmentBlobAdapter,
        });
        nextBody = result.body;
      }
      updateNote(activeNote.id, { body: nextBody });
    })();
  }, [activeNote, updateNote, viewMode]);

  const handleEditorDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!activeNote || viewMode !== 'edit') return;
    if ((e.target as HTMLElement).closest('.be-image-block')) return;
    attachImageFilesToActiveNote(Array.from(e.dataTransfer.files));
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
