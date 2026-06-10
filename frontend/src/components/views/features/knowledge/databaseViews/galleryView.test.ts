// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { DatabaseGalleryView } from '../components/DatabaseGalleryView';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { filterNotes } from '../query/filterNotes';
import {
  defaultTablePresentationConfig,
  normalizeGalleryConfig,
} from './databasePresentationConfig';
import { prepareDatabaseGalleryItems } from './prepareDatabaseGalleryItems';
import { prepareDatabaseViewPresentation } from './prepareDatabaseViewPresentation';
import {
  createDatabaseView,
  normalizeDatabaseViews,
} from './databaseViews';
import {
  setDatabaseViewGalleryCardFields,
  setDatabaseViewGalleryCoverProperty,
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
import { isValidCoverImageUrl } from './galleryModels';

const galleryColors: NoteChromeColors = {
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

function galleryView(overrides: Partial<DatabaseView> = {}): DatabaseView {
  return createDatabaseView([], 'Study Gallery', 'tag:japanese', {
    id: 'gallery-1',
    presentation: 'gallery',
    coverProperty: 'coverImage',
    cardFields: ['status', 'priority'],
    ...overrides,
  })[0];
}

describe('isValidCoverImageUrl', () => {
  it('accepts http and https image URLs', () => {
    expect(isValidCoverImageUrl('https://example.com/image.jpg')).toBe(true);
    expect(isValidCoverImageUrl('http://example.com/image.png')).toBe(true);
  });

  it('rejects non-URL values', () => {
    expect(isValidCoverImageUrl('not-a-url')).toBe(false);
    expect(isValidCoverImageUrl('')).toBe(false);
  });
});

describe('normalizeGalleryConfig', () => {
  it('normalizes cover property and card fields', () => {
    expect(normalizeGalleryConfig({
      type: 'gallery',
      coverProperty: ' coverImage ',
      cardFields: [' status ', 'priority', ''],
      cardSize: 'large',
    })).toMatchObject({
      type: 'gallery',
      coverProperty: 'coverImage',
      cardFields: ['status', 'priority'],
      cardSize: 'large',
    });
  });

  it('falls back to defaults for empty gallery config', () => {
    expect(normalizeGalleryConfig({ type: 'gallery' })).toMatchObject({
      type: 'gallery',
      coverProperty: 'coverImage',
      cardFields: ['status', 'priority', 'reviewDate'],
    });
  });
});

describe('gallery view creation', () => {
  it('creates a gallery database view with cover and card fields', () => {
    const created = createDatabaseView([], 'Study Gallery', 'tag:japanese', {
      presentation: 'gallery',
      coverProperty: 'coverImage',
      cardFields: ['status', 'priority', 'reviewDate'],
    })[0];
    expect(created.presentation).toBe('gallery');
    expect(created.presentationConfig).toMatchObject({
      type: 'gallery',
      coverProperty: 'coverImage',
      cardFields: ['status', 'priority', 'reviewDate'],
    });
  });
});

describe('presentation switching', () => {
  it('switches table to gallery and back', () => {
    const tableConfig = defaultTablePresentationConfig();
    let view: DatabaseView = {
      id: 'db-1',
      name: 'Study',
      query: 'tag:japanese',
      presentation: 'table',
      presentationConfig: tableConfig,
      columns: tableConfig.columns,
      sort: tableConfig.sort,
    };

    view = setDatabaseViewPresentation(view, 'gallery');
    expect(view.presentation).toBe('gallery');
    expect(view.presentationConfig.type).toBe('gallery');

    view = setDatabaseViewPresentation(view, 'table');
    expect(view.presentation).toBe('table');
    expect(view.presentationConfig.type).toBe('table');
  });

  it('updates gallery cover property and card fields', () => {
    let view = galleryView();
    view = setDatabaseViewGalleryCoverProperty(view, 'thumbnail');
    view = setDatabaseViewGalleryCardFields(view, ['status', 'reviewDate']);
    expect(view.presentationConfig).toMatchObject({
      type: 'gallery',
      coverProperty: 'thumbnail',
      cardFields: ['status', 'reviewDate'],
    });
  });
});

describe('prepareDatabaseGalleryItems', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      note('a', 'With Cover', '', {
        properties: {
          tags: 'japanese',
          coverImage: 'https://example.com/a.jpg',
          status: 'Active',
          priority: 'High',
        },
      }),
      note('b', 'No Cover', '', {
        properties: { tags: 'japanese', status: 'Todo', priority: 'Low' },
      }),
      note('c', 'Bad Cover', '', {
        properties: {
          tags: 'japanese',
          coverImage: 'not-a-url',
          status: 'Blocked',
        },
      }),
      note('d', 'English', '', {
        properties: {
          tags: 'english',
          coverImage: 'https://example.com/d.jpg',
          status: 'Active',
        },
      }),
    ];
    service.buildFromNotes(notes);
  });

  it('resolves cover image URLs from the configured property', () => {
    const items = prepareDatabaseGalleryItems(galleryView(), notes, service);
    const withCover = items.find(item => item.noteId === 'a');
    expect(withCover?.coverImage).toBe('https://example.com/a.jpg');
  });

  it('omits invalid cover URLs while still returning the note', () => {
    const items = prepareDatabaseGalleryItems(galleryView(), notes, service);
    const badCover = items.find(item => item.noteId === 'c');
    expect(badCover).toBeDefined();
    expect(badCover?.coverImage).toBeUndefined();
    expect(badCover?.fields.some(field => field.key === 'status')).toBe(true);
  });

  it('resolves configured card fields from properties', () => {
    const items = prepareDatabaseGalleryItems(galleryView(), notes, service);
    const item = items.find(entry => entry.noteId === 'a');
    expect(item?.fields).toEqual([
      { key: 'status', label: 'Status', value: 'Active' },
      { key: 'priority', label: 'Priority', value: 'High' },
    ]);
  });

  it('filters then prepares without changing query semantics', () => {
    const view = galleryView({ query: 'tag:japanese' });
    const items = prepareDatabaseGalleryItems(view, notes, service);
    expect(items.map(item => item.noteId).sort()).toEqual(['a', 'b', 'c']);

    const direct = filterNotes(notes, service, view.query);
    const viaView = filterByDatabaseView(notes, service, view);
    expect(viaView.notes.map(n => n.id)).toEqual(direct.notes.map(n => n.id));
  });
});

describe('prepareDatabaseViewPresentation', () => {
  it('dispatches gallery presentation', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'Card', '', {
        properties: { tags: 'japanese', status: 'Active', coverImage: 'https://example.com/a.jpg' },
      }),
    ];
    service.buildFromNotes(notes);
    const data = prepareDatabaseViewPresentation(galleryView(), notes, service);
    expect(data.type).toBe('gallery');
    if (data.type === 'gallery') {
      expect(data.items.map(item => item.noteId)).toEqual(['a']);
    }
  });
});

describe('persistence and backward compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists gallery presentation and config', () => {
    const views = [galleryView()];
    saveDatabaseViews(views);
    const loaded = loadDatabaseViews()[0];
    expect(loaded.presentation).toBe('gallery');
    expect(loaded.presentationConfig).toMatchObject({
      type: 'gallery',
      coverProperty: 'coverImage',
      cardFields: ['status', 'priority'],
    });
  });

  it('migrates legacy table views without presentationConfig', () => {
    const tableConfig = defaultTablePresentationConfig();
    const views = normalizeDatabaseViews([
      {
        id: '1',
        name: 'Legacy',
        query: 'tag:legacy',
        presentation: 'table',
        columns: tableConfig.columns,
        sort: tableConfig.sort,
      },
    ]);
    expect(views[0].presentationConfig.type).toBe('table');
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem(DATABASE_VIEWS_KEY, '{bad json');
    expect(loadDatabaseViews()).toEqual([]);
  });
});

describe('workspace integration', () => {
  it('activates gallery views through workspace helpers', () => {
    const view = galleryView();
    const result = activateDatabaseViewWorkspace(view);
    expect(result.activation).toEqual({ kind: 'database-view', id: view.id });
    expect(isWorkspaceKindActive(result.activation, 'database-view', view.id)).toBe(true);
    expect(isWorkspaceKindActive(INACTIVE_WORKSPACE, 'database-view')).toBe(false);
  });
});

describe('DatabaseGalleryView', () => {
  it('renders cards with cover, fields, and placeholder fallback', () => {
    const service = new KnowledgeIndexService();
    const notes = [
      note('a', 'With Cover', '', {
        properties: {
          tags: 'japanese',
          coverImage: 'https://example.com/a.jpg',
          status: 'Active',
          priority: 'High',
        },
      }),
      note('b', 'No Cover', '', {
        properties: { tags: 'japanese', status: 'Todo', priority: 'Low' },
      }),
    ];
    service.buildFromNotes(notes);
    const items = prepareDatabaseGalleryItems(galleryView(), notes, service);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let selectedId: string | null = null;

    act(() => {
      root.render(createElement(DatabaseGalleryView, {
        colors: galleryColors,
        items,
        service,
        activeNoteId: 'a',
        showCoverPlaceholder: true,
        onSelectNote: id => { selectedId = id; },
      }));
    });

    expect(container.textContent).toContain('With Cover');
    expect(container.textContent).toContain('No Cover');
    expect(container.textContent).toContain('No cover');
    expect(container.textContent).toContain('Status: Active');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.jpg');

    const noteButton = Array.from(container.querySelectorAll('[role="button"]')).find(
      btn => btn.textContent?.includes('With Cover'),
    );
    expect(noteButton).toBeTruthy();
    act(() => {
      noteButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(selectedId).toBe('a');
  });
});
