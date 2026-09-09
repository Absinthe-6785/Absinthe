// @vitest-environment happy-dom
import { act, createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyViewportWidth } from '../../../lib/responsiveLayout';
import { NOTE_LIST_SECTION_PREFS_KEY } from '../noteListSectionPrefs';
import { KnowledgeContextPanel, type KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import { NoteEditorHeaderActions } from './NoteEditorHeaderActions';
import {
  NotesAdvancedOrganizationDisclosure,
  resolveNotesPrimarySurfaceVisibility,
  shouldRevealNotesAdvancedOrganization,
} from './NotesAdvancedOrganizationDisclosure';
import { useNoteViewPanelConfig } from './useNoteViewPanelConfig';
import { useNoteViewState } from './useNoteViewState';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const colors = {
  wrap: '#fff', sidebar: '#fff', sideBdr: '#ddd', notelist: '#fff', editor: '#fff', toolbar: '#fff',
  toolBdr: '#ddd', card: '#fff', cardHov: '#fafafa', cardAct: '#f0f0f0', cardActBdr: '#ddd',
  text: '#111', textMuted: '#555', textFaint: '#888', accent: '#7c3aed', accentBg: '#f3e8ff',
  input: '#fff', inputBdr: '#ddd', badge: '#eee', badgeTxt: '#111', tag: '#eee', tagTxt: '#111',
  danger: '#dc2626', green: '#16a34a',
} as never;

const mountedRoots: Root[] = [];

function mount(element: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(element));
  return { host, root };
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    if (root) act(() => root.unmount());
  }
  document.body.replaceChildren();
  localStorage.clear();
});

function StatefulAdvancedOrganization({ active = false }: { active?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return createElement(
    NotesAdvancedOrganizationDisclosure,
    {
      colors,
      expanded,
      active,
      label: 'Knowledge · Workspace',
      onToggle: () => setExpanded(value => !value),
    },
    createElement('button', { type: 'button', 'data-advanced-capability': 'areas' }, 'Areas'),
    createElement('button', { type: 'button', 'data-advanced-capability': 'smart-collections' }, 'Smart collections'),
    createElement('button', { type: 'button', 'data-advanced-capability': 'database-views' }, 'Database views'),
  );
}

function ContextHarness({ width, noteId = 'note-a' }: { width: number; noteId?: string }) {
  const category = classifyViewportWidth(width);
  const compact = category === 'mobile' || category === 'tablet';
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<KnowledgeContextTab>('toc');
  const { rightPanels } = useNoteViewPanelConfig();

  return createElement(
    'div',
    { 'data-viewport-category': category },
    createElement('main', { 'data-notes-hierarchy-level': 'document' }, `Active document ${noteId}`),
    createElement('button', {
      type: 'button',
      'aria-expanded': open,
      'aria-controls': 'noteview-context-panel',
      onClick: () => setOpen(value => !value),
      'data-open-context': true,
      'data-k126c-header-panel': true,
    }, 'Context'),
    open ? createElement(
      KnowledgeContextPanel,
      {
        colors,
        compact,
        tablet: category === 'tablet',
        activeTab,
        tabs: rightPanels,
        onTabChange: setActiveTab,
        onClose: () => setOpen(false),
      },
      createElement('div', { 'data-active-context-mode': activeTab }, `${activeTab} content`),
    ) : null,
  );
}

function NoteViewStateProbe() {
  const state = useNoteViewState();
  return createElement('output', {
    'data-workspace-expanded': state.workspaceExpanded,
    'data-context-open': state.showRightPanel,
  });
}

function ResponsiveReachabilityHarness({ width }: { width: number }) {
  const category = classifyViewportWidth(width);
  const isMobile = category === 'mobile';
  const [mobileShowEditor, setMobileShowEditor] = useState(false);
  const visibility = resolveNotesPrimarySurfaceVisibility({
    isMobile,
    mobileShowEditor,
    hasActiveNote: true,
    isMobileEmptyVault: false,
  });

  return createElement(
    'div',
    { 'data-viewport-category': category },
    createElement('button', { type: 'button', 'data-open-navigation': true }, 'Navigation'),
    createElement(
      'section',
      { 'data-note-list': true, hidden: visibility.hideNoteList },
      createElement('button', { type: 'button', onClick: () => setMobileShowEditor(true) }, 'Open note'),
    ),
    createElement(
      'main',
      { 'data-note-editor': true, hidden: visibility.hideEditorArea },
      'Active document',
      createElement('button', { type: 'button', onClick: () => setMobileShowEditor(false) }, 'Back to list'),
    ),
  );
}

function renderHeaderActions(showRightPanel: boolean, onTogglePanel: () => void) {
  const noop = vi.fn();
  return createElement(NoteEditorHeaderActions, {
    colors,
    isTrash: false,
    isMobile: false,
    showRightPanel,
    viewMode: 'edit',
    viewModeButtons: [],
    starred: false,
    docCopied: false,
    isEvent: false,
    isMilestone: false,
    isArea: false,
    canMarkArea: true,
    onViewModeToggle: noop,
    onMarkEvent: noop,
    onMarkMilestone: noop,
    onToggleArea: noop,
    onToggleStar: noop,
    onDuplicate: noop,
    onTogglePanel,
    onCopyDocument: noop,
    onExport: noop,
    onRestore: noop,
    onTrash: noop,
  });
}

describe('UI-04 Notes hierarchy containment', () => {
  it('starts document-first while respecting the existing durable advanced-section preference', () => {
    const defaults = mount(createElement(NoteViewStateProbe));
    expect(defaults.host.querySelector('output')?.getAttribute('data-workspace-expanded')).toBe('false');
    expect(defaults.host.querySelector('output')?.getAttribute('data-context-open')).toBe('false');
    act(() => defaults.root.unmount());
    mountedRoots.splice(mountedRoots.indexOf(defaults.root), 1);
    defaults.host.remove();

    localStorage.setItem(NOTE_LIST_SECTION_PREFS_KEY, JSON.stringify({ workspaceCollapsed: false }));
    const restored = mount(createElement(NoteViewStateProbe));
    expect(restored.host.querySelector('output')?.getAttribute('data-workspace-expanded')).toBe('true');
    expect(restored.host.querySelector('output')?.getAttribute('data-context-open')).toBe('false');
  });

  it('keeps advanced capabilities mounted but hidden behind a real collapsed disclosure by default', () => {
    const { host } = mount(createElement(StatefulAdvancedOrganization));
    const toggle = host.querySelector('[data-notes-advanced-organization-toggle]');
    const content = host.querySelector('[data-notes-advanced-organization-content]');

    expect(toggle).toBeInstanceOf(HTMLButtonElement);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe(content?.id);
    expect(content?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelectorAll('[data-advanced-capability]')).toHaveLength(3);

    act(() => (toggle as HTMLButtonElement).click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(content?.hasAttribute('hidden')).toBe(false);
  });

  it('keeps a collapsed active advanced destination understandable and reveals every explicit advanced mode', () => {
    const { host } = mount(createElement(StatefulAdvancedOrganization, { active: true }));
    expect(host.querySelector('[data-notes-hierarchy-level="advanced-organization"]')?.getAttribute('data-notes-advanced-active')).toBe('true');

    const base = {
      hasActiveTag: false,
      isDashboardMode: false,
      isTraceAreaMode: false,
      isTraceDiscoveryMode: false,
      hasWorkspaceActivation: false,
    };
    expect(shouldRevealNotesAdvancedOrganization(base)).toBe(false);
    for (const key of Object.keys(base) as Array<keyof typeof base>) {
      expect(shouldRevealNotesAdvancedOrganization({ ...base, [key]: true })).toBe(true);
    }
  });

  it('opens context explicitly, preserves the canonical eleven modes across note switches, and closes to the document', () => {
    const mounted = mount(createElement(ContextHarness, { width: 1440, noteId: 'note-a' }));
    expect(mounted.host.querySelector('[data-notes-hierarchy-level="document"]')).not.toBeNull();
    expect(mounted.host.querySelector('#noteview-context-panel')).toBeNull();

    act(() => (mounted.host.querySelector('[data-open-context]') as HTMLButtonElement).click());
    expect(mounted.host.querySelector('[data-notes-context-presentation="aside"]')).not.toBeNull();
    expect(mounted.host.querySelector('[data-active-context-mode="toc"]')).not.toBeNull();

    const primaryKeys = Array.from(mounted.host.querySelectorAll('[data-k104-context-tab]'))
      .map(element => element.getAttribute('data-k104-context-tab'));
    act(() => (mounted.host.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement).click());
    const moreKeys = Array.from(mounted.host.querySelectorAll('[data-k104-context-more-tab]'))
      .map(element => element.getAttribute('data-k104-context-more-tab'));
    expect([...primaryKeys, ...moreKeys]).toEqual(expect.arrayContaining([
      'toc', 'links', 'graph', 'discover', 'properties', 'insights',
      'actions', 'timeline', 'tags', 'relations', 'stats',
    ]));
    expect([...primaryKeys, ...moreKeys]).toHaveLength(11);

    act(() => mounted.root.render(createElement(ContextHarness, { width: 1440, noteId: 'note-b' })));
    expect(mounted.host.textContent).toContain('Active document note-b');
    expect(mounted.host.querySelector('#noteview-context-panel')).not.toBeNull();

    act(() => (mounted.host.querySelector('[data-notes-context-close]') as HTMLButtonElement).click());
    expect(mounted.host.querySelector('#noteview-context-panel')).toBeNull();
    expect(mounted.host.textContent).toContain('Active document note-b');
    expect(document.activeElement).toBe(mounted.host.querySelector('[data-open-context]'));
  });

  it.each([
    [767, 'mobile', 'overlay'],
    [768, 'tablet', 'overlay'],
    [769, 'tablet', 'overlay'],
    [1023, 'tablet', 'overlay'],
    [1024, 'desktop', 'aside'],
  ] as const)('uses canonical %ipx containment for %s context', (width, category, presentation) => {
    const { host } = mount(createElement(ContextHarness, { width }));
    expect(host.firstElementChild?.getAttribute('data-viewport-category')).toBe(category);
    act(() => (host.querySelector('[data-open-context]') as HTMLButtonElement).click());
    expect(host.querySelector('[data-notes-context-presentation]')?.getAttribute('data-notes-context-presentation')).toBe(presentation);
  });

  it('keeps mobile navigation, list, and editor reachable without stacking both primary surfaces', () => {
    const { host } = mount(createElement(ResponsiveReachabilityHarness, { width: 767 }));
    const list = host.querySelector('[data-note-list]');
    const editor = host.querySelector('[data-note-editor]');

    expect(host.querySelector('[data-open-navigation]')).toBeInstanceOf(HTMLButtonElement);
    expect(list?.hasAttribute('hidden')).toBe(false);
    expect(editor?.hasAttribute('hidden')).toBe(true);

    act(() => (list?.querySelector('button') as HTMLButtonElement).click());
    expect(list?.hasAttribute('hidden')).toBe(true);
    expect(editor?.hasAttribute('hidden')).toBe(false);

    act(() => (editor?.querySelector('button') as HTMLButtonElement).click());
    expect(list?.hasAttribute('hidden')).toBe(false);
    expect(editor?.hasAttribute('hidden')).toBe(true);
  });

  it.each([768, 769, 1023, 1024])('keeps note list and active document simultaneously reachable at %ipx', width => {
    const { host } = mount(createElement(ResponsiveReachabilityHarness, { width }));
    expect(host.querySelector('[data-note-list]')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('[data-note-editor]')?.hasAttribute('hidden')).toBe(false);
  });

  it('exposes the editor context toggle as the controller for the on-demand panel', () => {
    const onTogglePanel = vi.fn();
    const { host, root } = mount(renderHeaderActions(false, onTogglePanel));
    const toggle = host.querySelector('[data-k126c-header-panel]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('noteview-context-panel');
    act(() => (toggle as HTMLButtonElement).click());
    expect(onTogglePanel).toHaveBeenCalledTimes(1);

    act(() => root.render(renderHeaderActions(true, onTogglePanel)));
    expect(host.querySelector('[data-k126c-header-panel]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps every existing advanced navigation capability inside the single production boundary', () => {
    const source = readFileSync(join(
      process.cwd(),
      'src/components/views/noteview/NoteViewSidebar.tsx',
    ), 'utf8');
    const boundaryStart = source.indexOf('<NotesAdvancedOrganizationDisclosure');
    const boundaryEnd = source.indexOf('</NotesAdvancedOrganizationDisclosure>');
    const boundary = source.slice(boundaryStart, boundaryEnd);

    expect(boundaryStart).toBeGreaterThan(-1);
    expect(boundaryEnd).toBeGreaterThan(boundaryStart);
    for (const capability of [
      'data-k104-areas-section',
      'allTags.map',
      'handleActivateDashboardWithTraceClear',
      '<SmartCollectionsSection',
      '<PinnedWorkspacesSection',
      '<RecentWorkSection',
      '<RuleCollectionsSection',
      '<DatabaseViewsSection',
      '<SavedViewsSection',
    ]) {
      expect(boundary).toContain(capability);
    }
  });
});
