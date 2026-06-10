// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import {
  BoardViewControls,
  CalendarViewControls,
  DatabasePresentationRenderer,
  DatabaseViewControls,
  GalleryViewControls,
  SharedDatabaseControls,
  TableViewControls,
  TimelineViewControls,
} from '../components/databaseControls';
import { defaultTablePresentationConfig } from './databasePresentationConfig';
import { prepareDatabaseViewPresentation } from './prepareDatabaseViewPresentation';
import { createDatabaseView } from './databaseViews';
import { setDatabaseViewPresentation } from './databaseViewOperations';
import { withPresentationDefaults } from './databasePresentationConfig';
import type { DatabaseView } from './databaseViewModels';

const colors = {
  wrap: '#fff',
  sidebar: '#f5f5f5',
  sideBdr: '#ddd',
  notelist: '#fafafa',
  editor: '#fff',
  toolbar: '#f5f5f5',
  toolBdr: '#ddd',
  card: '#fff',
  cardHov: '#f0f0f0',
  cardAct: '#eee',
  cardActBdr: '#0066cc',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#0066cc',
  accentBg: '#eef',
  input: '#fff',
  inputBdr: '#ccc',
  badge: '#eee',
  badgeTxt: '#111',
  tag: '#eef',
  tagTxt: '#0066cc',
  danger: '#cc0000',
  green: '#008800',
} satisfies NoteChromeColors;

function noop() {}

function baseView(presentation: DatabaseView['presentation'] = 'table'): DatabaseView {
  const tableConfig = defaultTablePresentationConfig();
  return withPresentationDefaults({
    id: 'db-1',
    name: 'Study',
    query: 'tag:japanese',
    presentation,
    presentationConfig: tableConfig,
    columns: tableConfig.columns,
    sort: tableConfig.sort,
  });
}

function renderToText(element: ReturnType<typeof createElement>): string {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  const text = container.textContent ?? '';
  root.unmount();
  container.remove();
  return text;
}

describe('presentation-specific controls', () => {
  it('renders shared presentation switcher', () => {
    const text = renderToText(createElement(SharedDatabaseControls, {
      colors,
      presentation: 'table',
      onPresentationChange: noop,
    }));
    expect(text).toContain('Table');
    expect(text).toContain('Gallery');
  });

  it('renders table controls with sort and columns sections', () => {
    const view = baseView('table');
    const tableConfig = defaultTablePresentationConfig();
    const text = renderToText(createElement(TableViewControls, {
      colors,
      tableConfig,
      onAddColumn: noop,
      onRemoveColumn: noop,
      onToggleColumnVisibility: noop,
      onSortChange: noop,
      onSortRulesChange: noop,
      onAddSortRule: noop,
      onRemoveSortRule: noop,
      onMoveSortRule: noop,
      onAddRollupColumn: noop,
      onRemoveRollupColumn: noop,
      onToggleRollupColumnVisibility: noop,
      onAddFormulaColumn: noop,
      onRemoveFormulaColumn: noop,
      onToggleFormulaColumnVisibility: noop,
    }));
    expect(text).toContain('Sort rules');
    expect(text).toContain('Columns');
    expect(text).toContain('Rollup Columns');
    expect(text).toContain('Formula Columns');
    expect(view.presentation).toBe('table');
  });

  it('renders board controls with group by field', () => {
    const view = baseView('board');
    const configured = withPresentationDefaults(view);
    const text = renderToText(createElement(BoardViewControls, {
      colors,
      boardConfig: configured.presentationConfig.type === 'board'
        ? configured.presentationConfig
        : { type: 'board', groupBy: 'status' },
      onGroupByChange: noop,
    }));
    expect(text).toContain('Group by');
  });

  it('renders calendar controls with date property field', () => {
    const view = baseView('calendar');
    const configured = withPresentationDefaults(view);
    const text = renderToText(createElement(CalendarViewControls, {
      calendarConfig: configured.presentationConfig.type === 'calendar'
        ? configured.presentationConfig
        : { type: 'calendar', dateProperty: 'reviewDate' },
      onDatePropertyChange: noop,
    }));
    expect(text).toContain('Date property');
  });

  it('renders timeline controls with start and end fields', () => {
    const view = baseView('timeline');
    const configured = withPresentationDefaults(view);
    const text = renderToText(createElement(TimelineViewControls, {
      timelineConfig: configured.presentationConfig.type === 'timeline'
        ? configured.presentationConfig
        : { type: 'timeline', startDateProperty: 'startDate' },
      onTimelineStartChange: noop,
      onTimelineEndChange: noop,
    }));
    expect(text).toContain('Start date property');
    expect(text).toContain('End date property');
  });

  it('renders gallery controls with cover and card fields', () => {
    const view = baseView('gallery');
    const configured = withPresentationDefaults(view);
    const text = renderToText(createElement(GalleryViewControls, {
      colors,
      galleryConfig: configured.presentationConfig.type === 'gallery'
        ? configured.presentationConfig
        : { type: 'gallery', coverProperty: 'coverImage', cardFields: ['status'] },
      columnKeys: ['title', 'status'],
      onGalleryCoverChange: noop,
      onGalleryCardFieldsChange: noop,
    }));
    expect(text).toContain('Cover image property');
    expect(text).toContain('Card fields');
  });
});

describe('DatabaseViewControls router', () => {
  it('shows table controls only for table presentation', () => {
    const tableText = renderToText(createElement(DatabaseViewControls, {
      colors,
      view: baseView('table'),
      onPresentationChange: noop,
      onGroupByChange: noop,
      onDatePropertyChange: noop,
      onTimelineStartChange: noop,
      onTimelineEndChange: noop,
      onGalleryCoverChange: noop,
      onGalleryCardFieldsChange: noop,
      onAddColumn: noop,
      onRemoveColumn: noop,
      onToggleColumnVisibility: noop,
      onSortChange: noop,
      onSortRulesChange: noop,
      onAddSortRule: noop,
      onRemoveSortRule: noop,
      onMoveSortRule: noop,
      onAddRollupColumn: noop,
      onRemoveRollupColumn: noop,
      onToggleRollupColumnVisibility: noop,
      onAddFormulaColumn: noop,
      onRemoveFormulaColumn: noop,
      onToggleFormulaColumnVisibility: noop,
    }));
    expect(tableText).toContain('Sort rules');
    expect(tableText).not.toContain('Group by');
  });

  it('shows board controls only for board presentation', () => {
    const boardText = renderToText(createElement(DatabaseViewControls, {
      colors,
      view: baseView('board'),
      onPresentationChange: noop,
      onGroupByChange: noop,
      onDatePropertyChange: noop,
      onTimelineStartChange: noop,
      onTimelineEndChange: noop,
      onGalleryCoverChange: noop,
      onGalleryCardFieldsChange: noop,
      onAddColumn: noop,
      onRemoveColumn: noop,
      onToggleColumnVisibility: noop,
      onSortChange: noop,
      onSortRulesChange: noop,
      onAddSortRule: noop,
      onRemoveSortRule: noop,
      onMoveSortRule: noop,
      onAddRollupColumn: noop,
      onRemoveRollupColumn: noop,
      onToggleRollupColumnVisibility: noop,
      onAddFormulaColumn: noop,
      onRemoveFormulaColumn: noop,
      onToggleFormulaColumnVisibility: noop,
    }));
    expect(boardText).toContain('Group by');
    expect(boardText).not.toContain('Sort rules');
  });
});

describe('DatabasePresentationRenderer', () => {
  let service: KnowledgeIndexService;
  let notes: NoteBase[];

  beforeEach(() => {
    service = new KnowledgeIndexService();
    notes = [
      {
        id: 'a',
        title: 'Alpha',
        body: '',
        updatedAt: 100,
        folderId: null,
        deletedAt: null,
        properties: { tags: 'japanese', status: 'Todo' },
      },
    ];
    service.buildFromNotes(notes);
  });

  it('dispatches table renderer for table presentation data', () => {
    const view = createDatabaseView([], 'Study', 'tag:japanese')[0];
    const data = prepareDatabaseViewPresentation(view, notes, service);
    const text = renderToText(createElement(DatabasePresentationRenderer, {
      colors,
      view,
      presentationData: data,
      service,
      activeNoteId: null,
      onSelectNote: noop,
    }));
    expect(data.type).toBe('table');
    expect(text).toContain('Alpha');
  });

  it('dispatches board renderer after presentation switch', () => {
    let view = createDatabaseView([], 'Study', 'tag:japanese')[0];
    view = setDatabaseViewPresentation(view, 'board');
    const data = prepareDatabaseViewPresentation(view, notes, service);
    const text = renderToText(createElement(DatabasePresentationRenderer, {
      colors,
      view,
      presentationData: data,
      service,
      activeNoteId: null,
      onSelectNote: noop,
    }));
    expect(data.type).toBe('board');
    expect(text).toContain('Alpha');
  });
});

describe('control isolation', () => {
  it('exports remain available from legacy DatabaseViewControls entry point', async () => {
    const legacy = await import('../components/DatabaseViewControls');
    expect(legacy.DatabaseViewPanel).toBeDefined();
    expect(legacy.DatabaseViewControls).toBeDefined();
    expect(legacy.TableViewControls).toBeDefined();
  });
});
