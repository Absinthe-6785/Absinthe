// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { DatabaseBoardView } from '../components/DatabaseBoardView';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { filterNotes } from '../query/filterNotes';
import {
  defaultTablePresentationConfig,
} from './databasePresentationConfig';
import { defaultDatabaseViewColumns } from './databaseViewConfig';
import { groupNotesByProperty } from './groupNotesByProperty';
import { UNASSIGNED_LANE_KEY } from './databasePresentationConfig';
import { prepareDatabaseBoardLanes } from './prepareDatabaseBoardLanes';
import {
  createDatabaseView,
  normalizeDatabaseViews,
} from './databaseViews';
import {
  setDatabaseViewGroupBy,
  setDatabaseViewPresentation,
} from './databaseViewOperations';
import type { DatabaseView } from './databaseViewModels';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import {
  activateDatabaseViewWorkspace,
  isWorkspaceKindActive,
} from '../workspace/workspaceActivation';
import { INACTIVE_WORKSPACE } from '../workspace/workspaceModels';
import { filterByDatabaseView } from './filterByDatabaseView';

const boardColors: NoteChromeColors = {
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

function tableView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  const presentationConfig = defaultTablePresentationConfig();
  return {
    id: 'db-1',
    name: 'Study Tasks',
    query: 'tag:japanese',
    presentation: 'table',
    presentationConfig,
    columns: presentationConfig.columns,
    sort: presentationConfig.sort,
    ...overrides,
  };
}

function boardView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  return createDatabaseView([], 'Board', 'tag:japanese', {
    id: 'board-1',
    presentation: 'board',
    groupBy: 'status',
  })[0];
}

describe('board view creation', () => {
  it('creates a board database view with groupBy config', () => {
    const created = createDatabaseView([], 'Study Tasks', 'tag:japanese', {
      presentation: 'board',
      groupBy: 'status',
    })[0];
    expect(created.presentation).toBe('board');
    expect(created.presentationConfig).toMatchObject({
      type: 'board',
      groupBy: 'status',
    });
  });
});

describe('presentation switching', () => {
  it('switches table to board and back', () => {
    let view = tableView();
    expect(view.presentation).toBe('table');
    expect(view.presentationConfig.type).toBe('table');

    view = setDatabaseViewPresentation(view, 'board');
    expect(view.presentation).toBe('board');
    expect(view.presentationConfig.type).toBe('board');

    view = setDatabaseViewPresentation(view, 'table');
    expect(view.presentation).toBe('table');
    expect(view.presentationConfig.type).toBe('table');
    expect(view.columns?.length).toBeGreaterThan(0);
  });

  it('updates groupBy on board views', () => {
    let view = boardView();
    view = setDatabaseViewGroupBy(view, 'priority');
    expect(view.presentationConfig).toMatchObject({
      type: 'board',
      groupBy: 'priority',
    });
  });
});

describe('groupNotesByProperty', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'Genki Ch.5', '', { properties: { tags: 'japanese', status: 'Todo' } }),
      note('b', 'N1 Reading', '', { properties: { tags: 'japanese', status: 'Todo' } }),
      note('c', 'Tobira Ch.3', '', { properties: { tags: 'japanese', status: 'Doing' } }),
      note('d', 'Kanji Review', '', { properties: { tags: 'japanese', status: 'Done' } }),
      note('e', 'Untagged status', '', { properties: { tags: 'japanese' } }),
    ];
    service.buildFromNotes(notes);
  });

  it('groups notes by property values', () => {
    const lanes = groupNotesByProperty(notes, 'status', service);
    expect(lanes.map(lane => lane.label)).toEqual(['Doing', 'Done', 'Todo', 'No value']);
    expect(lanes.find(l => l.label === 'Todo')?.notes.map(n => n.id).sort()).toEqual(['a', 'b']);
    expect(lanes.find(l => l.label === 'Doing')?.notes.map(n => n.id)).toEqual(['c']);
    expect(lanes.find(l => l.label === 'Done')?.notes.map(n => n.id)).toEqual(['d']);
    expect(lanes.find(l => l.key === UNASSIGNED_LANE_KEY)?.notes.map(n => n.id)).toEqual(['e']);
  });

  it('includes empty groups from indexed property values', () => {
    service.updateNote(note('f', 'Future task', '', {
      properties: { tags: 'japanese', status: 'Blocked' },
    }));
    const lanes = groupNotesByProperty(
      notes.filter(n => n.id !== 'f'),
      'status',
      service,
    );
    expect(lanes.some(l => l.label === 'Blocked' && l.notes.length === 0)).toBe(true);
  });
});

describe('prepareDatabaseBoardLanes', () => {
  it('filters then groups without changing query semantics', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Genki Ch.5', '', { properties: { tags: 'japanese', status: 'Todo' } }),
      note('b', 'English Notes', '', { properties: { tags: 'english', status: 'Todo' } }),
      note('c', 'Tobira Ch.3', '', { properties: { tags: 'japanese', status: 'Doing' } }),
    ];
    service.buildFromNotes(notes);

    const view = boardView({ query: 'tag:japanese' });
    const lanes = prepareDatabaseBoardLanes(view, notes, service);
    const allIds = lanes.flatMap(lane => lane.notes.map(n => n.id)).sort();
    expect(allIds).toEqual(['a', 'c']);

    const direct = filterNotes(notes, service, view.query);
    const viaView = filterByDatabaseView(notes, service, view);
    expect(viaView.notes.map(n => n.id).sort()).toEqual(direct.notes.map(n => n.id).sort());
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists board presentation and groupBy', () => {
    const views = [boardView()];
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentation).toBe('board');
    expect(loaded.presentationConfig).toMatchObject({
      type: 'board',
      groupBy: 'status',
    });
  });

  it('migrates legacy table views without presentationConfig', () => {
    const views = normalizeDatabaseViews([
      {
        id: '1',
        name: 'Legacy',
        query: 'tag:legacy',
        presentation: 'table',
        columns: defaultDatabaseViewColumns(),
        sort: { key: 'updatedAt', direction: 'desc' },
      },
    ]);
    expect(views[0].presentationConfig.type).toBe('table');
    expect(views[0].columns?.length).toBeGreaterThan(0);
    expect(views[0].sort?.key).toBe('updatedAt');
  });

  it('round-trips presentationConfig through localStorage', () => {
    const views = [tableView({
      presentationConfig: {
        type: 'table',
        columns: [
          { key: 'title', visible: true },
          { key: 'status', visible: true },
          { key: 'updatedAt', visible: false },
          { key: 'tags', visible: true },
        ],
        sort: { key: 'status', direction: 'asc' },
      },
    })];
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentationConfig.type).toBe('table');
    expect(loaded.sort).toEqual({ key: 'status', direction: 'asc' });
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(DATABASE_VIEWS_KEY, '{bad json');
    expect(loadDatabaseViews()).toEqual([]);
  });
});

describe('workspace integration', () => {
  it('activates board views through workspace helpers', () => {
    const view = boardView();
    const result = activateDatabaseViewWorkspace(view);
    expect(result.activation).toEqual({ kind: 'database-view', id: view.id });
    expect(isWorkspaceKindActive(result.activation, 'database-view', view.id)).toBe(true);
    expect(isWorkspaceKindActive(INACTIVE_WORKSPACE, 'database-view')).toBe(false);
  });
});

describe('DatabaseBoardView', () => {
  it('renders board lanes and cards', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Genki Ch.5', '', { properties: { tags: 'study', status: 'Todo' } }),
      note('b', 'Tobira Ch.3', '', { properties: { tags: 'study', status: 'Doing' } }),
    ];
    service.buildFromNotes(notes);
    const lanes = groupNotesByProperty(notes, 'status', service);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(DatabaseBoardView, {
        colors: boardColors,
        lanes,
        service,
        activeNoteId: 'a',
        onSelectNote: () => {},
      }));
    });

    expect(container.textContent).toContain('Todo');
    expect(container.textContent).toContain('Doing');
    expect(container.textContent).toContain('Genki Ch.5');
    expect(container.textContent).toContain('Tobira Ch.3');
  });
});
