import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star, FileText, Search, Trash2 } from 'lucide-react';
import type { NoteBase as Note, NoteFolderBase } from '../noteUtils';
import { displayNoteTitle } from '../noteDisplayTitle';
import type { NoteChromeColors } from '../noteEditorTheme';
import { TagChip } from '../features/knowledge/components/TagChip';
import { listTags } from '../features/knowledge/tags/noteTags';
import { ProductEmptyState } from '../../common/ProductEmptyState';
import { listDensityStyles, type ListDensityMode } from '../listDensityPreference';
import type { TranslationKey } from '@/lib/i18n';

const VIRTUALIZE_THRESHOLD = 40;

function noteRowHeight(density: ListDensityMode): number {
  return listDensityStyles(density).noteItemMinHeight + 28;
}

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
  hasActiveSearch?: boolean;
  onClearSearch?: () => void;
  listDensity?: ListDensityMode;
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
  hasActiveSearch = false,
  onClearSearch,
  listDensity = 'comfortable',
}: NoteSidebarVirtualListProps) {
  const rowHeight = noteRowHeight(listDensity);
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = notes.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
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
          <span style={{ fontSize: 9, color: c.textFaint, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    );
  };

  if (notes.length === 0) {
    const emptyIcon = isTrash ? Trash2 : hasActiveSearch ? Search : FileText;
    const title = isTrash ? t('nvTrashEmpty') : hasActiveSearch ? t('nvSearchNoResults') : t('nvNoNotes');
    const description = isTrash
      ? t('k99EmptyTrashDesc')
      : hasActiveSearch
        ? t('k99EmptySearchDesc')
        : t('k99EmptyNotesDesc');
    const dataHook = isTrash ? 'trash-empty' : hasActiveSearch ? 'search-empty' : 'notes-empty';

    return (
      <ProductEmptyState
        variant="note-chrome"
        colors={c}
        icon={emptyIcon}
        title={title}
        description={description}
        dataHook={dataHook}
        primaryAction={
          !isTrash && hasActiveSearch && onClearSearch
            ? { label: t('nvClearQuery'), onClick: onClearSearch }
            : !isTrash && !hasActiveSearch
              ? {
                  label: t('nvCreateFirstNote'),
                  onClick: () => { createNote(); if (isMobile) setMobileShowEditor(true); },
                }
              : undefined
        }
      />
    );
  }

  if (!useVirtual) {
    return (
      <div ref={parentRef} className="bscroll-pane" style={{ flex: 1 }}>
        {notes.map(renderRow)}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="bscroll-pane" style={{ flex: 1 }}>
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
