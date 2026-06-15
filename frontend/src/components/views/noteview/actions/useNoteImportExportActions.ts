import { useCallback } from 'react';
import type { NoteBase as Note } from '../../noteUtils';
import { normalizeNoteFolderId } from '../../noteUtils';
import { serializeNoteMarkdown, parseNoteMarkdown } from '../../features/knowledge';
import type { UseNoteViewActionsParams } from './types';

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

  const handleEditorDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!activeNote || viewMode !== 'edit') return;
    if ((e.target as HTMLElement).closest('.be-image-block')) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => insertImageAtCursor(file.name.replace(/\.[^.]+$/, ''), ev.target?.result as string);
      reader.readAsDataURL(file);
    });
  }, [activeNote, viewMode, insertImageAtCursor, setIsDragOver]);

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
    handleCopyDocument,
    insertImageAtCursor,
    insertEmptyImageBlockAtCursor,
    handleEditorDrop,
    handleImport,
  };
}
