import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { TranslationKey } from '../../../../../lib/i18n';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteFolder } from '../../../../../store/useNotesStore';
import type { NoteBase } from '../../../noteUtils';
import {
  buildWorkspaceSearch,
  type WorkspaceSearchGroup,
  type WorkspaceSearchResult,
} from '../workspace/buildWorkspaceSearch';

const GROUP_LABEL_KEYS: Record<WorkspaceSearchGroup['kind'], TranslationKey> = {
  note: 'searchGroupNotes',
  project: 'searchGroupProjects',
  'learning-path': 'searchGroupLearningPaths',
  collection: 'searchGroupCollections',
  subject: 'searchGroupSubjects',
  tag: 'searchGroupTags',
  milestone: 'searchGroupMilestones',
  folder: 'searchGroupFolders',
};

export interface WorkspaceSearchPaletteProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  folders: readonly NoteFolder[];
  open: boolean;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectLearningPath: (pathId: string) => void;
}

export function WorkspaceSearchPalette({
  colors: c,
  notes,
  folders,
  open,
  onClose,
  onSelectNote,
  onSelectFolder,
  onSelectTag,
  onSelectCollection,
  onSelectLearningPath,
}: WorkspaceSearchPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(
    () => buildWorkspaceSearch(query, notes, folders),
    [query, notes, folders],
  );

  const flatResults = useMemo(
    () => groups.flatMap(g => g.results),
    [groups],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = useCallback((result: WorkspaceSearchResult) => {
    switch (result.kind) {
      case 'note':
      case 'project':
      case 'milestone':
        if (result.noteId) onSelectNote(result.noteId);
        break;
      case 'folder':
        if (result.folderId) onSelectFolder(result.folderId);
        break;
      case 'tag':
        if (result.tag) onSelectTag(result.tag);
        break;
      case 'collection':
      case 'subject':
        if (result.collectionId) onSelectCollection(result.collectionId);
        break;
      case 'learning-path':
        if (result.pathId) onSelectLearningPath(result.pathId);
        break;
    }
    onClose();
  }, [onClose, onSelectCollection, onSelectFolder, onSelectLearningPath, onSelectNote, onSelectTag]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && flatResults[activeIndex]) {
        e.preventDefault();
        handleSelect(flatResults[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatResults, activeIndex, handleSelect, onClose]);

  if (!open) return null;

  let rowIndex = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('workspaceSearchPlaceholder')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '10vh 16px 16px',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: c.card,
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${c.sideBdr}` }}>
          <Search size={16} color={c.textMuted} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('workspaceSearchPlaceholder')}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              color: c.text,
            }}
          />
          <kbd style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: `1px solid ${c.sideBdr}`, color: c.textMuted }}>
            {t('workspaceSearchShortcut')}
          </kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
          {flatResults.length === 0 ? (
            <div style={{ padding: '16px 14px', fontSize: 12, color: c.textFaint, textAlign: 'center' }}>
              {query.trim() ? t('workspaceSearchNoResults') : t('workspaceSearchPlaceholder')}
            </div>
          ) : (
            groups.map(group => (
              <div key={group.kind}>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, padding: '6px 12px 4px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {t(GROUP_LABEL_KEYS[group.kind])}
                </div>
                {group.results.map(result => {
                  const idx = rowIndex++;
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => handleSelect(result)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        border: 'none',
                        background: active ? c.accentBg : 'transparent',
                        cursor: 'pointer',
                        color: c.text,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{result.title}</div>
                      {result.subtitle && (
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{result.subtitle}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
