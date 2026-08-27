// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSearchProjection } from '../buildSearchProjection';
import type { SearchDatasetState } from '../../../../../lib/searchReadiness';
import { SearchWorkspacePalette } from './SearchWorkspacePalette';
import type { NoteChromeColors } from '../../../noteEditorTheme';

const colors: NoteChromeColors = {
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
  cardActBdr: '#00f',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#00f',
  accentBg: '#eef',
  input: '#fff',
  inputBdr: '#ddd',
  badge: '#eef',
  badgeTxt: '#00f',
  tag: '#eef',
  tagTxt: '#00f',
  danger: '#f00',
  green: '#0a0',
};

function makeProjection(
  todosState: SearchDatasetState,
  healthBlocksState: SearchDatasetState,
) {
  return buildSearchProjection({
    query: 'does-not-match',
    filter: 'all',
    notes: [],
    folders: [],
    schedules: [],
    todos: [],
    todosState,
    routines: [],
    workouts: [],
    healthBlocks: [],
    healthBlocksState,
    weeklySchedules: [],
    recipes: [],
    recentSearches: [],
    now: new Date('2026-08-26T12:00:00.000Z'),
  });
}

describe('SearchWorkspacePalette readiness empty-state rendering', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function renderState(todosState: SearchDatasetState, healthBlocksState: SearchDatasetState): void {
    root.render(createElement(SearchWorkspacePalette, {
      colors,
      projection: makeProjection(todosState, healthBlocksState),
      open: true,
      query: 'does-not-match',
      onQueryChange: () => undefined,
      onClose: () => undefined,
      onRecentRevision: () => undefined,
    }));
  }

  it('shows the established no-results UI after both deferred sources settle empty', async () => {
    await act(async () => renderState(
      { status: 'READY_EMPTY', validating: false },
      { status: 'READY_EMPTY', validating: false },
    ));

    expect(host.querySelector('[data-k111-empty-results]')).not.toBeNull();
    expect(host.querySelector('[data-k111-search-section="planner"]')).toBeNull();
    expect(host.querySelector('[data-k111-search-section="health"]')).toBeNull();
  });

  it('keeps an unresolved deferred group visible instead of claiming no results', async () => {
    await act(async () => renderState(
      { status: 'LOADING', validating: true },
      { status: 'READY_EMPTY', validating: false },
    ));

    expect(host.querySelector('[data-k111-empty-results]')).toBeNull();
    expect(host.querySelector('[data-k111-search-section="planner"]')).not.toBeNull();
    expect(host.querySelector('[data-k111-section-state="LOADING"]')).not.toBeNull();
  });
});
