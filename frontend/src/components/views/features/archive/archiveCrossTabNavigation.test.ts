// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { AppSettings, Theme } from '../../../../types';
import type { NoteBase } from '../../noteUtils';
import { applyMilestoneToNote } from '../knowledge/trace/milestoneNotes';
import { applyAreaToNote } from '../knowledge/trace/areaNotes';
import { buildArchiveHomeProjection } from '../knowledge/archive';
import { ArchiveHomeView } from './home/ArchiveHomeView';

const openNoteMock = vi.fn();

vi.mock('../../../../lib/noteNavigation', () => ({
  openNote: (noteId: string) => openNoteMock(noteId),
}));

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const appSettings: AppSettings = {
  darkMode: false,
  defaultCategory: 'Personal',
  defaultColor: 'blue',
  language: 'en',
};

const NOW = new Date(2026, 5, 12);

function note(id: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: 'Note',
    body: '',
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('ArchiveHomeView cross-tab note navigation', () => {
  beforeEach(() => {
    openNoteMock.mockReset();
  });

  it('opens milestone notes via openNote', () => {
    const projection = buildArchiveHomeProjection({
      notes: [
        applyMilestoneToNote(note('m1', { title: 'Shipped' }), {
          milestoneDate: '2026-06-11',
          milestoneLabel: 'Shipped',
        }),
      ],
      now: NOW,
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(createElement(ArchiveHomeView, { projection, theme, appSettings }));
    });

    const button = container.querySelector('[data-archive-milestone-note-id="m1"]') as HTMLButtonElement;
    act(() => {
      button.click();
    });

    expect(openNoteMock).toHaveBeenCalledWith('m1');

    act(() => {
      root.unmount();
    });
  });

  it('opens area hub notes via openNote', () => {
    const area = applyAreaToNote(note('area-1', { title: 'Research' }));
    const linked = note('linked', {
      title: 'Prep',
      body: '[[Research]]',
      updatedAt: NOW.getTime(),
    });
    const projection = buildArchiveHomeProjection({
      notes: [area, linked],
      now: NOW,
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(createElement(ArchiveHomeView, { projection, theme, appSettings }));
    });

    const pill = container.querySelector('[data-archive-area-pill]') as HTMLButtonElement;
    act(() => {
      pill.click();
    });

    expect(openNoteMock).toHaveBeenCalledWith('area-1');

    act(() => {
      root.unmount();
    });
  });
});
