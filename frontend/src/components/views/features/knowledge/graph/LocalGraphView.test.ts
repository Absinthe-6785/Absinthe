// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import { buildLocalGraphData } from './buildLocalGraphData';
import { LocalGraphView } from './LocalGraphView';
import type { NoteChromeColors } from '../../../noteEditorTheme';

function note(id: string, title: string, body: string): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt: null };
}

const colors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#8B5CF6',
  accentBg: '#eee',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#8B5CF6',
  input: '#fff',
  inputBdr: '#ddd',
  toolbar: '#fff',
  toolBdr: '#ddd',
  badge: '#eee',
  badgeTxt: '#333',
  tag: '#eee',
  tagTxt: '#333',
  green: '#0a0',
  danger: '#c00',
};

function renderView(props: {
  graphData: ReturnType<typeof buildLocalGraphData>;
  onNavigate: (noteId: string) => void;
}): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(LocalGraphView, {
      colors,
      graphData: props.graphData,
      onNavigate: props.onNavigate,
    }));
  });
  return container;
}

describe('LocalGraphView', () => {
  it('selects a connected node on single click without navigating', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]]'),
    ]);

    const onNavigate = vi.fn();
    const container = renderView({
      graphData: buildLocalGraphData({
        noteId: 'genki',
        noteTitle: 'Genki',
        service,
      }),
      onNavigate,
    });

    const label = [...container.querySelectorAll('text')].find(
      node => node.textContent === 'Japanese Gram…',
    );
    expect(label).toBeTruthy();

    act(() => {
      label?.parentElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onNavigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Japanese Grammar');
  });

  it('navigates when a connected node is double-clicked', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]]'),
    ]);

    const onNavigate = vi.fn();
    const container = renderView({
      graphData: buildLocalGraphData({
        noteId: 'genki',
        noteTitle: 'Genki',
        service,
      }),
      onNavigate,
    });

    const label = [...container.querySelectorAll('text')].find(
      node => node.textContent === 'Japanese Gram…',
    );
    expect(label).toBeTruthy();

    act(() => {
      label?.parentElement?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(onNavigate).toHaveBeenCalledWith('grammar');
  });

  it('navigates when the detail strip open button is clicked', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('grammar', 'Japanese Grammar', '[[Genki]]'),
    ]);

    const onNavigate = vi.fn();
    const container = renderView({
      graphData: buildLocalGraphData({
        noteId: 'genki',
        noteTitle: 'Genki',
        service,
      }),
      onNavigate,
    });

    const label = [...container.querySelectorAll('text')].find(
      node => node.textContent === 'Japanese Gram…',
    );
    expect(label).toBeTruthy();

    act(() => {
      label?.parentElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const openButton = [...container.querySelectorAll('button')].find(
      btn => btn.textContent === '열기',
    );
    expect(openButton).toBeTruthy();

    act(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onNavigate).toHaveBeenCalledWith('grammar');
  });

  it('shows empty state when the graph has no connected notes', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([note('solo', 'Solo Note', '')]);

    const container = renderView({
      graphData: buildLocalGraphData({
        noteId: 'solo',
        noteTitle: 'Solo Note',
        service,
      }),
      onNavigate: vi.fn(),
    });

    expect(container.textContent).toContain('연결된 노트 없음');
  });
});
