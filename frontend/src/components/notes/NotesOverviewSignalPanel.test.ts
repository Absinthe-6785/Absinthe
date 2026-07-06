import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotesOverviewSignalPanel } from './NotesOverviewSignalPanel';

const componentPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesOverviewSignalPanel.tsx');
const noteViewPath = join(process.cwd(), 'src', 'components', 'views', 'NoteView.tsx');
const noteViewEditorAreaPath = join(
  process.cwd(),
  'src',
  'components',
  'views',
  'noteview',
  'NoteViewEditorArea.tsx',
);
const staticPreviewPath = join(process.cwd(), 'src', 'components', 'notes', 'NotesCosmosStaticPreview.tsx');

type SignalPanelRecentNote = {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  signalLabel: 'recent';
};

type SignalPanelActiveWriting = {
  state: 'active' | 'idle' | 'unavailable';
  currentNoteId?: string;
  currentNoteTitle?: string;
  lastEditedAt?: string;
};

type SignalPanelData = {
  generatedFrom: 'local-note-metadata';
  recentNotes: SignalPanelRecentNote[];
  activeWriting: SignalPanelActiveWriting;
  emptyState: {
    hasNotes: boolean;
    noteCount?: number;
    reason?: 'empty-vault' | 'ready' | 'unavailable';
  };
};

const forbiddenFields = [
  'body',
  'content',
  'rawContent',
  'markdown',
  'editorState',
  'blockEditorState',
  'documentModel',
  'embedding',
  'vector',
  'semanticScore',
  'similarityScore',
  'graphCoordinates',
  'coordinates',
  'orbit',
  'spatialPosition',
  'relationshipStrength',
  'clusterId',
  'themeId',
  'knowledgeIndexResult',
  'providerId',
  'supabaseRowId',
  'syncStatus',
  'backupStatus',
  'preflightStatus',
  'dataSafetyStatus',
  'oauthState',
  'googleDriveState',
  'attachmentBlob',
  'restoreState',
  'importState',
  'exportState',
  'activityEvents',
  'keystrokeEvents',
  'analytics',
] as const;

const activeFixture: SignalPanelData = {
  generatedFrom: 'local-note-metadata',
  emptyState: {
    hasNotes: true,
    noteCount: 4,
    reason: 'ready',
  },
  recentNotes: [
    {
      id: 'note-pixel-grammar',
      title: 'Pixel grammar notes',
      updatedAt: '2026-07-06 09:10',
      signalLabel: 'recent',
    },
    {
      id: 'note-vault-review',
      title: 'Vault review',
      updatedAt: '2026-07-05 18:20',
      signalLabel: 'recent',
    },
    {
      id: 'note-cosmos-outline',
      title: 'Cosmos outline',
      updatedAt: '2026-07-04 13:40',
      signalLabel: 'recent',
    },
  ],
  activeWriting: {
    state: 'active',
    currentNoteId: 'note-pixel-grammar',
    currentNoteTitle: 'Pixel grammar notes',
    lastEditedAt: '2026-07-06 09:10',
  },
};

const idleFixture: SignalPanelData = {
  ...activeFixture,
  activeWriting: {
    state: 'idle',
  },
};

const unavailableFixture: SignalPanelData = {
  ...activeFixture,
  activeWriting: {
    state: 'unavailable',
  },
};

const emptyFixture: SignalPanelData = {
  generatedFrom: 'local-note-metadata',
  emptyState: {
    hasNotes: false,
    noteCount: 0,
    reason: 'empty-vault',
  },
  recentNotes: [],
  activeWriting: {
    state: 'unavailable',
  },
};

const fallbackTitleFixture: SignalPanelData = {
  ...activeFixture,
  recentNotes: [
    {
      id: 'note-fallback-title',
      title: 'Untitled note',
      updatedAt: '2026-07-06 07:00',
      signalLabel: 'recent',
    },
  ],
  activeWriting: {
    state: 'active',
    currentNoteId: 'note-fallback-title',
    currentNoteTitle: 'Untitled note',
  },
};

function manyRecentNotesFixture(): SignalPanelData {
  return {
    ...activeFixture,
    recentNotes: Array.from({ length: 7 }, (_, index) => ({
      id: `note-${index + 1}`,
      title: `Recent note ${index + 1}`,
      updatedAt: `2026-07-0${Math.min(index + 1, 6)} 10:00`,
      signalLabel: 'recent' as const,
    })),
  };
}

function renderPanel(data: SignalPanelData): string {
  return renderToStaticMarkup(createElement(NotesOverviewSignalPanel, { data }))
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function renderPanelInNarrowContainer(data: SignalPanelData): string {
  return renderToStaticMarkup(
    createElement(
      'div',
      {
        style: {
          width: '390px',
          maxWidth: '390px',
          minWidth: 0,
        },
      },
      createElement(NotesOverviewSignalPanel, { data }),
    ),
  )
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => collectKeys(item));
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [key, ...collectKeys(nestedValue)]);
}

describe('NotesOverviewSignalPanel', () => {
  it('renders panel heading and orientation summary', () => {
    const html = renderPanel(activeFixture);

    expect(html).toContain('data-notes-overview-signal-panel');
    expect(html).toContain('data-source="local-note-metadata"');
    expect(html).toContain('data-recent-note-limit="5"');
    expect(html).toContain('Notes signal panel');
    expect(html).toContain('<h2');
    expect(html).toContain('Notes Overview');
    expect(html).toContain('Current writing signal: Pixel grammar notes.');
    expect(html).toContain('Read-only local signal from 4 local notes.');
  });

  it('renders active writing fixture from passed props', () => {
    const html = renderPanel(activeFixture);

    expect(html).toContain('Active writing');
    expect(html).toContain('data-active-writing-state="active"');
    expect(html).toContain('Pixel grammar notes');
    expect(html).toContain('State: active');
    expect(html).toContain('Last edited 2026-07-06 09:10.');
  });

  it('renders idle writing fixture', () => {
    const html = renderPanel(idleFixture);

    expect(html).toContain('data-active-writing-state="idle"');
    expect(html).toContain('No active writing signal right now');
    expect(html).toContain('State: idle');
    expect(html).toContain('Keep writing when a note becomes the current focus.');
  });

  it('renders unavailable writing fixture', () => {
    const html = renderPanel(unavailableFixture);

    expect(html).toContain('data-active-writing-state="unavailable"');
    expect(html).toContain('Active writing signal unavailable');
    expect(html).toContain('State: unavailable');
    expect(html).toContain('The component stays quiet instead of inventing editor state.');
  });

  it('renders empty/degraded fixture without duplicating full Empty State CTA', () => {
    const html = renderPanel(emptyFixture);

    expect(html).toContain('Your vault is still quiet.');
    expect(html).toContain('0 local notes');
    expect(html).toContain('Recent notes are unavailable from the passed local-note metadata.');
    expect(html).toContain('Empty readout');
    expect(html).toContain('Empty vault');
    expect(html).toContain('The full Notes empty state remains the primary onboarding surface.');
    expect(html).not.toContain('Create note');
    expect(html).not.toContain('Open today');
    expect(html).not.toContain('Import backup');
    expect(html).not.toContain('<button');
  });

  it('caps recent notes to five without sorting the input array', () => {
    const fixture = manyRecentNotesFixture();
    const html = renderPanel(fixture);

    expect(html).toContain('Showing 5 of 7');
    expect(html).toContain('Recent note 1');
    expect(html).toContain('Recent note 2');
    expect(html).toContain('Recent note 3');
    expect(html).toContain('Recent note 4');
    expect(html).toContain('Recent note 5');
    expect(html).not.toContain('Recent note 6');
    expect(html).not.toContain('Recent note 7');
    expect(html.indexOf('Recent note 1')).toBeLessThan(html.indexOf('Recent note 2'));
  });

  it('renders display title fallback fixture from provided title', () => {
    const html = renderPanel(fallbackTitleFixture);

    expect(html).toContain('Untitled note');
    expect(html).toContain('Current writing signal: Untitled note.');
    expect(html).not.toContain('note-fallback-title</strong>');
  });

  it('keeps fixtures and rendered output free of forbidden raw fields', () => {
    const fixtureKeys = collectKeys(activeFixture);
    const html = renderPanel(activeFixture);

    for (const forbidden of forbiddenFields) {
      expect(fixtureKeys).not.toContain(forbidden);
      expect(html).not.toContain(forbidden);
    }

    expect(html).not.toContain('raw note');
    expect(html).not.toContain('AI summary');
  });

  it('exposes semantic recent notes and active writing groups', () => {
    const html = renderPanel(activeFixture);

    expect(html).toContain('<article');
    expect(html).toContain('<section');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
    expect(html).toContain('aria-labelledby="notes-overview-signal-panel-recent"');
    expect(html).toContain('aria-labelledby="notes-overview-signal-panel-active-writing"');
    expect(html).toContain('Recent signal');
    expect(html).toContain('Writing signal');
    expect(html).toContain('Signal: recent');
  });

  it('does not require callbacks, navigation, or interactive controls', () => {
    const html = renderPanel(activeFixture);

    expect(html).not.toContain('<button');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('tabindex=');
    expect(html).not.toContain('onSelectRecentNote');
    expect(html).not.toContain('onCreateNote');
  });

  it('keeps long text present in a 390px wrapper render', () => {
    const fixture: SignalPanelData = {
      ...activeFixture,
      recentNotes: [
        {
          id: 'note-long-title',
          title:
            'A deliberately long fallback-ready note title that should wrap and remain present at narrow width',
          updatedAt: '2026-07-06 06:30',
          signalLabel: 'recent',
        },
      ],
      activeWriting: {
        state: 'active',
        currentNoteTitle:
          'A deliberately long current writing title that remains readable in the signal panel',
      },
    };
    const html = renderPanelInNarrowContainer(fixture);

    expect(html).toContain('width:390px');
    expect(html).toContain('max-w-full');
    expect(html).toContain('min-w-0');
    expect(html).toContain('break-words');
    expect(html).toContain(fixture.recentNotes[0].title);
    expect(html).toContain(fixture.activeWriting.currentNoteTitle);
  });

  it('does not import forbidden runtime services or generated assets', () => {
    const source = readSource(componentPath);

    for (const forbiddenImport of [
      /from ['"].*NoteView/,
      /from ['"].*NoteGraphView/,
      /from ['"].*NoteGraphViewLazy/,
      /from ['"].*LocalGraphView/,
      /from ['"].*KnowledgeIndexService/,
      /from ['"].*buildGlobalGraphData/,
      /from ['"].*buildExpandedGraphData/,
      /from ['"].*useNotesStore/,
      /from ['"].*store/,
      /from ['"].*provider/i,
      /from ['"].*persistence/i,
      /from ['"].*preflight/i,
      /from ['"].*backup/i,
      /from ['"].*restore/i,
      /from ['"].*supabase/i,
      /from ['"].*google/i,
      /from ['"].*attac.*hment/i,
      /from ['"].*BlockEditor/,
      /from ['"].*route/i,
      /from ['"].*navigation/i,
      /from ['"].*\.png/,
      /from ['"].*\.jpg/,
      /from ['"].*\.webp/,
      /from ['"].*\.woff/,
      /from ['"].*\.ttf/,
    ]) {
      expect(source).not.toMatch(forbiddenImport);
    }

    expect(source).not.toContain('onSelectRecentNote');
    expect(source).not.toContain('onCreateNote');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('fetch(');
  });

  it('remains unmounted from runtime Notes and Static Preview surfaces', () => {
    const noteView = readSource(noteViewPath);
    const noteViewEditorArea = readSource(noteViewEditorAreaPath);
    const staticPreview = readSource(staticPreviewPath);

    expect(noteView).not.toContain('NotesOverviewSignalPanel');
    expect(noteViewEditorArea).not.toContain('NotesOverviewSignalPanel');
    expect(staticPreview).not.toContain('NotesOverviewSignalPanel');
  });
});
