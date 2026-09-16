import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getTranslator, resolveAppLanguage } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import type { NoteBase } from '../../../../noteUtils';
import { buildNoteChrome } from '../../../../noteEditorTheme';
import { isIntelligenceContextTabActive } from '../../../../noteview/contextPanelTabGate';
import { KnowledgeIndexService } from '../../KnowledgeIndexService';
import {
  invalidateNoteGalaxyMapCache,
} from '../../graph/knowledgeUniverse/galaxyClustering';
import { buildNoteIntelligenceSnapshot } from '../intelligence';
import { CosmosActionsPanel } from './CosmosActionsPanel';

function note(id: string, title: string): NoteBase {
  return { id, title, body: '', folderId: 'history' };
}

describe('REL-04D Cosmos Actions intelligence reachability', () => {
  it('renders the conditional hub assistant from an intelligence-enabled Actions context', () => {
    const notes = [
      note('history-1', 'History Origins'),
      note('history-2', 'History Timeline'),
      note('history-3', 'History Sources'),
    ];
    const service = new KnowledgeIndexService();
    service.buildFromNotes(notes);
    invalidateNoteGalaxyMapCache();

    const intelligenceEnabled = isIntelligenceContextTabActive(true, 'actions');
    const snapshot = intelligenceEnabled
      ? buildNoteIntelligenceSnapshot(notes[0], notes, service)
      : null;

    expect(intelligenceEnabled).toBe(true);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.gaps.some(gap => gap.kind === 'missing-hub')).toBe(true);
    expect(snapshot?.areaHealth).not.toBeNull();

    const html = renderToStaticMarkup(createElement(CosmosActionsPanel, {
      colors: buildNoteChrome(false, {
        darkMode: false,
        language: 'en',
        defaultCategory: 'Study',
      }),
      note: notes[0],
      snapshot: snapshot!,
      notes,
      service,
      onConnect: () => {},
      onViewCandidates: () => {},
      onAssignArea: () => {},
      onCreateHub: () => {},
      onCreateRelation: () => {},
      onNavigateToNote: () => {},
    }));
    const t = getTranslator(resolveAppLanguage(useAppStore.getState().appSettings.language));

    expect(html).toContain(t('k37NoHubDetected'));
    expect(html).toContain(t('k37ActionCreateHub'));
  });
});
