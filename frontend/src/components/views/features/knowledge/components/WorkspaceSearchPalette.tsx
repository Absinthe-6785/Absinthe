import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { TranslationKey } from '../../../../../lib/i18n';
import { useTranslation } from '../../../../../lib/i18n';
import { useModalA11y } from '../../../../../hooks/useModalA11y';
import type { NoteFolder } from '../../../../../store/useNotesStore';
import type { NoteBase } from '../../../noteUtils';
import {
  buildWorkspaceSearch,
  buildWorkspaceSearchRecentGroups,
  buildWorkspaceSearchSuggestions,
  type WorkspaceSearchFilter,
  type WorkspaceSearchGroup,
  type WorkspaceSearchResult,
} from '../workspace/buildWorkspaceSearch';
import { importanceClassificationLabel } from '../knowledgeLabels';
import { knowledgeIndexService } from '../KnowledgeIndexService';
import type { DiscoveryFeed } from '../discovery';
import { buildDiscoveryFeed } from '../discovery';

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

const FILTER_OPTIONS: { id: WorkspaceSearchFilter; labelKey: TranslationKey }[] = [
  { id: 'all', labelKey: 'searchFilterAll' },
  { id: 'note', labelKey: 'searchFilterNotes' },
  { id: 'project', labelKey: 'searchFilterProjects' },
  { id: 'learning-path', labelKey: 'searchFilterPaths' },
  { id: 'collection', labelKey: 'searchFilterCollections' },
  { id: 'subject', labelKey: 'searchFilterSubjects' },
];

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
  /** Reuse vault discovery feed when already computed upstream. */
  discoveryFeed?: DiscoveryFeed;
}

function recordRecent(result: WorkspaceSearchResult): void {
  pushWorkspaceSearchRecent({ kind: result.kind, id: result.id, title: result.title });
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
  discoveryFeed: discoveryFeedProp,
}: WorkspaceSearchPaletteProps) {
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<WorkspaceSearchFilter>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState(loadWorkspaceSearchRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);

  useModalA11y({ open, onClose, containerRef: panelRef });

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setFilter('all');
      setActiveIndex(0);
      setRecent(loadWorkspaceSearchRecent());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const discoveryFeed = useMemo(
    () => discoveryFeedProp ?? buildDiscoveryFeed(notes, knowledgeIndexService),
    [discoveryFeedProp, notes],
  );

  const queryGroups = useMemo(
    () => buildWorkspaceSearch(query, notes, folders, { filter, service: knowledgeIndexService, discoveryFeed, language: lang }),
    [query, notes, folders, filter, discoveryFeed],
  );

  const recentGroups = useMemo(
    () => (query.trim() ? [] : buildWorkspaceSearchRecentGroups(recent, notes, folders, filter)),
    [query, recent, notes, folders, filter],
  );

  const suggestionGroups = useMemo(
    () => (query.trim() ? [] : buildWorkspaceSearchSuggestions(notes, folders, filter)),
    [query, notes, folders, filter],
  );

  const displaySections = useMemo(() => {
    if (query.trim()) {
      return queryGroups.map(g => ({ labelKey: GROUP_LABEL_KEYS[g.kind] as TranslationKey, results: g.results }));
    }
    const sections: { labelKey: TranslationKey; results: WorkspaceSearchResult[] }[] = [];
    if (recentGroups.length > 0 && recentGroups[0]!.results.length > 0) {
      sections.push({ labelKey: 'searchRecent', results: recentGroups.flatMap(g => g.results) });
    }
    if (suggestionGroups.length > 0) {
      for (const g of suggestionGroups) {
        sections.push({ labelKey: GROUP_LABEL_KEYS[g.kind], results: g.results });
      }
    }
    return sections;
  }, [query, queryGroups, recentGroups, suggestionGroups]);

  const flatResults = useMemo(
    () => displaySections.flatMap(s => s.results),
    [displaySections],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter]);

  const handleSelect = useCallback((result: WorkspaceSearchResult) => {
    recordRecent(result);
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
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        const selected = flatResults[activeIndexRef.current];
        if (selected) {
          e.preventDefault();
          handleSelect(selected);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flatResults, handleSelect]);

  const activeDescendantId = flatResults.length > 0 ? `ws-search-opt-${activeIndex}` : undefined;

  if (!open) return null;

  let rowIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(5vh, 24px) 16px 16px',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-search-title"
        aria-describedby="ws-search-hint"
        style={{
          width: '100%',
          maxWidth: 'min(520px, calc(100vw - 32px))',
          background: c.card,
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="ws-search-title" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {t('workspaceSearchPlaceholder')}
        </h2>
        <p id="ws-search-hint" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {t('searchStartTyping')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${c.sideBdr}` }}>
          <Search size={16} color={c.textMuted} aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={flatResults.length > 0}
            aria-controls="ws-search-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeDescendantId}
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
        <div
          role="radiogroup"
          aria-label={t('searchFilterGroup')}
          style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '6px 10px', borderBottom: `1px solid ${c.sideBdr}` }}
        >
          {FILTER_OPTIONS.map(opt => {
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className="abs-focus-ring"
                onClick={() => setFilter(opt.id)}
                style={{
                  fontSize: 9,
                  padding: '4px 10px',
                  minHeight: 32,
                  borderRadius: 999,
                  border: `1px solid ${active ? c.accent : c.sideBdr}`,
                  background: active ? c.accentBg : c.cardHov,
                  color: active ? c.accent : c.textMuted,
                  cursor: 'pointer',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
        <div
          ref={listboxRef}
          id="ws-search-listbox"
          role="listbox"
          aria-label={t('searchResultsList')}
          style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}
        >
          {flatResults.length === 0 ? (
            <div role="status" style={{ padding: '16px 14px', fontSize: 12, color: c.textFaint, textAlign: 'center' }}>
              {query.trim() ? t('workspaceSearchNoResults') : t('searchStartTyping')}
            </div>
          ) : (
            displaySections.map(section => (
              <div key={section.labelKey} role="group" aria-label={t(section.labelKey)}>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, padding: '6px 12px 4px', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {t(section.labelKey)}
                </div>
                {section.results.map(result => {
                  const idx = rowIndex++;
                  const active = idx === activeIndex;
                  const optionId = `ws-search-opt-${idx}`;
                  return (
                    <button
                      key={`${result.kind}-${result.id}-${idx}`}
                      id={optionId}
                      role="option"
                      aria-selected={active}
                      type="button"
                      className="abs-focus-ring"
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
                        boxShadow: active ? `inset 3px 0 0 ${c.accent}` : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{result.title}</span>
                        {result.importanceClass && (
                          <span
                            title={result.tierHint ?? undefined}
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: c.accent,
                              background: c.accentBg,
                              borderRadius: 999,
                              padding: '1px 6px',
                            }}
                          >
                            {importanceClassificationLabel(result.importanceClass, lang)}
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{result.subtitle}</div>
                      )}
                      {result.tierHint && (
                        <div style={{ fontSize: 9, color: c.textFaint, marginTop: 2, lineHeight: 1.4 }}>
                          {t('k41WhyThisTier')}: {result.tierHint}
                        </div>
                      )}
                      {result.actionsAvailable && (
                        <div style={{ fontSize: 9, color: c.accent, fontWeight: 700, marginTop: 3 }}>
                          {t('k37SearchActionsAvailable')}
                        </div>
                      )}
                      {result.discoveryOpportunity && (
                        <div style={{ fontSize: 9, color: c.textFaint, fontWeight: 600, marginTop: 3 }}>
                          {t('k38SearchDiscoveryOpportunity')}
                        </div>
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
