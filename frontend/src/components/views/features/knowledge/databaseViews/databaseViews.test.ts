// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { DatabaseTableView } from '../components/DatabaseTableView';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { filterNotes } from '../query/filterNotes';
import { DEFAULT_TABLE_COLUMNS, defaultDatabaseViewColumns } from './databaseColumns';
import { defaultTablePresentationConfig } from './databasePresentationConfig';
import { evaluateDatabaseView } from './evaluateDatabaseView';
import { filterByDatabaseView } from './filterByDatabaseView';
import {
  activateDatabaseView,
  createDatabaseView,
  deleteDatabaseView,
  findDatabaseView,
  isValidDatabaseViewQuery,
  normalizeDatabaseViews,
  renameDatabaseView,
} from './databaseViews';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import {
  activateDatabaseViewWorkspace,
  isWorkspaceKindActive,
} from '../workspace/workspaceActivation';
import { INACTIVE_WORKSPACE } from '../workspace/workspaceModels';

const tableColors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  toolbar: '#fff',
  toolBdr: '#ddd',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#8B5CF6',
  input: '#fff',
  inputBdr: '#ddd',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#8B5CF6',
  accentBg: '#eee',
  badge: '#eee',
  badgeTxt: '#333',
  tag: '#eee',
  tagTxt: '#333',
  green: '#0a0',
  danger: '#c00',
};

function note(
  id: string,
  title: string,
  body: string,
  extras: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title,
    body,
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...extras,
  };
}

describe('isValidDatabaseViewQuery', () => {
  it('accepts valid knowledge queries', () => {
    expect(isValidDatabaseViewQuery('tag:japanese')).toBe(true);
    expect(isValidDatabaseViewQuery('tag:japanese status:active')).toBe(true);
  });

  it('rejects plain text and invalid syntax', () => {
    expect(isValidDatabaseViewQuery('hello')).toBe(false);
  });
});

describe('database view CRUD', () => {
  const tableConfig = defaultTablePresentationConfig();
  const seed = [{
    id: 'a',
    name: 'Japanese Study',
    query: 'tag:japanese',
    presentation: 'table' as const,
    presentationConfig: tableConfig,
    columns: tableConfig.columns,
    sort: tableConfig.sort,
  }];

  it('creates a database view with table presentation', () => {
    const next = createDatabaseView(seed, 'Textbooks', 'tag:textbook');
    const created = findDatabaseView(next, next.find(v => v.name === 'Textbooks')!.id);
    expect(created).toMatchObject({
      name: 'Textbooks',
      query: 'tag:textbook',
      presentation: 'table',
    });
  });

  it('renames and deletes database views', () => {
    expect(renameDatabaseView(seed, 'a', 'JLPT N1')[0].name).toBe('JLPT N1');
    expect(deleteDatabaseView(seed, 'a')).toEqual([]);
  });

  it('activates as workspace database-view kind', () => {
    expect(activateDatabaseView(seed[0])).toEqual({ kind: 'database-view', id: 'a' });
  });
});

describe('databaseViewsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and loads database views', () => {
    const tableConfig = defaultTablePresentationConfig();
    const views = [{
      id: '1',
      name: 'Japanese Study',
      query: 'tag:japanese',
      presentation: 'table' as const,
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    }];
    saveDatabaseViews(views);
    expect(loadDatabaseViews()).toEqual(views);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(DATABASE_VIEWS_KEY, '{bad json');
    expect(loadDatabaseViews()).toEqual([]);
  });

  it('normalizes legacy entries without presentation', () => {
    const views = normalizeDatabaseViews([
      { id: '1', name: 'Legacy', query: 'tag:legacy' },
    ]);
    expect(views[0].presentation).toBe('table');
    expect(views[0].presentationConfig.type).toBe('table');
    expect(views[0].columns?.length).toBeGreaterThan(0);
    expect(views[0].sort?.key).toBe('updatedAt');
  });
});

describe('query integration', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Japanese Grammar', '', { properties: { tags: 'japanese', status: 'active' }, updatedAt: 200 }),
      note('b', 'English Notes', '', { properties: { tags: 'english' }, updatedAt: 100 }),
    ];
    service.buildFromNotes(notes);
  });

  it('evaluates database views through filterNotes', () => {
    const tableConfig = defaultTablePresentationConfig();
    const view = {
      id: '1',
      name: 'Japanese Study',
      query: 'tag:japanese',
      presentation: 'table' as const,
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };
    expect(evaluateDatabaseView(view, service, notes)).toEqual(['a']);
  });

  it('routes database views through the query engine', () => {
    const tableConfig = defaultTablePresentationConfig();
    const view = {
      id: '1',
      name: 'Japanese Study',
      query: 'tag:japanese',
      presentation: 'table' as const,
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };
    const direct = filterNotes(notes, service, view.query);
    const viaView = filterByDatabaseView(notes, service, view);
    expect(viaView.notes.map(n => n.id)).toEqual(direct.notes.map(n => n.id));
    expect(viaView.usedKnowledgeQuery).toBe(true);
  });

  it('updates dynamically when indexed metadata changes', () => {
    const tableConfig = defaultTablePresentationConfig();
    const view = {
      id: '1',
      name: 'Japanese',
      query: 'tag:japanese status:active',
      presentation: 'table' as const,
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };
    expect(evaluateDatabaseView(view, service, notes)).toEqual(['a']);

    service.updateNote(note('b', 'English Notes', '', { properties: { tags: 'japanese', status: 'active' } }));
    expect(evaluateDatabaseView(view, service, notes).sort()).toEqual(['a', 'b']);
  });
});

describe('workspace integration', () => {
  it('activates database views through workspace helpers', () => {
    const tableConfig = defaultTablePresentationConfig();
    const view = {
      id: 'db-1',
      name: 'Japanese Study',
      query: 'tag:japanese',
      presentation: 'table' as const,
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };
    const result = activateDatabaseViewWorkspace(view);
    expect(result.activation).toEqual({ kind: 'database-view', id: 'db-1' });
    expect(result.searchQuery).toBe('');
    expect(isWorkspaceKindActive(result.activation, 'database-view', 'db-1')).toBe(true);
    expect(isWorkspaceKindActive(INACTIVE_WORKSPACE, 'database-view')).toBe(false);
  });
});

describe('DatabaseTableView', () => {
  it('renders table rows for matching notes', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Alpha Note', '', { updatedAt: Date.parse('2024-01-02'), properties: { tags: 'work' } }),
      note('b', 'Beta Note', '', { updatedAt: Date.parse('2024-01-01'), properties: { tags: 'personal' } }),
    ];
    service.buildFromNotes(notes);
    const colors = tableColors;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(DatabaseTableView, {
        colors,
        notes,
        columns: DEFAULT_TABLE_COLUMNS,
        service,
        activeNoteId: 'a',
        onSelectNote: () => {},
      }));
    });

    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Alpha Note');
    expect(container.textContent).toContain('Beta Note');
    expect(container.textContent).toContain('work');
  });
});
