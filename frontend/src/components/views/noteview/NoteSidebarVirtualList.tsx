import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star } from 'lucide-react';
import type { NoteBase as Note, NoteFolderBase } from '../noteUtils';
import { displayNoteTitle } from '../noteDisplayTitle';
import type { NoteChromeColors } from '../noteEditorTheme';
import { TagChip } from '../features/knowledge/components/TagChip';
import { listTags } from '../features/knowledge/tags/noteTags';

const NOTE_ROW_HEIGHT = 72;
const VIRTUALIZE_THRESHOLD = 40;

import type { TranslationKey } from '@/lib/i18n';

export interface NoteSidebarVirtualListProps {
  colors: NoteChromeColors;
  notes: readonly Note[];
  folders: NoteFolderBase[];
  activeNoteId: string | null;
  isTrash: boolean;
  isMobile: boolean;
  dragNoteId: string | null;
  t: (key: TranslationKey) => string;
  openNoteById: (id: string) => void;
  setMobileShowEditor: (show: boolean) => void;
  setDragNoteId: (id: string | null) => void;
  duplicateNote: (note: Note) => void;
  createNote: () => void;
}

export function NoteSidebarVirtualList({
  colors: c,
  notes,
  folders,
  activeNoteId,
  isTrash,
  isMobile,
  dragNoteId,
  t,
  openNoteById,
  setMobileShowEditor,
  setDragNoteId,
  duplicateNote,
  createNote,
}: NoteSidebarVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = notes.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => NOTE_ROW_HEIGHT,
    overscan: 8,
    enabled: useVirtual,
  });

  const renderRow = (n: Note) => {
    const folder = folders.find(f => f.id === n.folderId);
    const tags = listTags(n).slice(0, 2);
    const rawPreview = n.body.replace(/(^|\s)#[\w\uAC00-\uD7A3]+/g, '').replace(/[#*`[\]=~>$-]/g, '').split('\n').find(l => l.trim()) || '';
    const displayTitle = displayNoteTitle(n.title);
    return (
      <div
        key={n.id}
        className={`bni ${n.id === activeNoteId ? 'active' : ''} ${dragNoteId === n.id ? 'bnote-drag' : ''}`}
        onClick={() => { openNoteById(n.id); if (isMobile) setMobileShowEditor(true); }}
        draggable={!isTrash}
        onDragStart={() => setDragNoteId(n.id)}
        onDragEnd={() => setDragNoteId(null)}
        title={t('nvDragHint')}
        onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateNote(n); } }}
        tabIndex={0}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
          {n.starred && <Star size={9} color={c.accent} fill={c.accent} style={{ flexShrink: 0 }}/>}
          <span style={{ fontSize: 12, fontWeight: 600, color: n.id === activeNoteId ? c.accent : c.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            dangerouslySetInnerHTML={{ __html: displayTitle }}/>
        </div>
        <div style={{ fontSize: 10, color: c.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}
          dangerouslySetInnerHTML={{ __html: rawPreview }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', minWidth: 0 }}>
          {folder && <span style={{ fontSize: 9, background: c.badge, color: c.badgeTxt, borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>{folder.name}</span>}
          {tags.map(tag => (
            <TagChip key={tag} colors={c} tag={tag} size="sm" />
          ))}
          <span style={{ fontSize: 9, color: c.textFaint, marginLeft: 'auto' }}>
            {new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    );
  };

  if (notes.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: c.textFaint, fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span>{isTrash ? t('nvTrashEmpty') : t('nvNoNotes')}</span>
        {!isTrash && (
          <button type="button" className="bwbg" onClick={() => { createNote(); if (isMobile) setMobileShowEditor(true); }}
            style={{ minHeight: 44, padding: '8px 16px' }}>
            {t('nvCreateFirstNote')}
          </button>
        )}
      </div>
    );
  }

  if (!useVirtual) {
    return (
      <div ref={parentRef} style={{ flex: 1, overflowY: 'auto' }}>
        {notes.map(renderRow)}
      </div>
    );
  }

  return (
    <div ref={parentRef} style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const note = notes[vRow.index];
          if (!note) return null;
          return (
            <div
              key={note.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              {renderRow(note)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
