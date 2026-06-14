import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { KnowledgeHistoryEvent } from './eventTypes';
import { buildAreaEvolutionDetail } from './historyAreaEvolutionQueries';
import { buildKnowledgeJourney } from './historyJourneyQueries';
import { exportCosmosEvolutionMarkdown } from './knowledgeHistoryExport';
import { buildExpandedCosmosEvolutionStory, buildCosmosEvolutionSummary } from './historyEvolutionQueries';
import { buildKnowledgeTimeline } from '../timeline/knowledgeTimeline';
import {
  dismissBootstrapSummary,
  loadBootstrapImportSummary,
  saveBootstrapImportSummary,
  buildBootstrapImportSummaryFromEvents,
} from './bootstrapSummaryStorage';
import { clearKnowledgeHistory } from './historyStorage';

function note(id: string, body = '', extra: Partial<NoteBase> = {}): NoteBase {
  return { id, title: id, body, createdAt: Date.parse('2026-02-11'), ...extra };
}

describe('K-46 area evolution queries', () => {
  let service: KnowledgeIndexService;

  beforeEach(() => {
    service = new KnowledgeIndexService();
  });

  it('builds area detail from history events', () => {
    const notes = [
      note('n1', '', { properties: { area: 'History' } }),
      note('n2', '[[n1]]', { properties: { area: 'History' } }),
    ];
    service.buildFromNotes(notes);
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: 100, noteId: 'n1', areaId: 'History' },
      { id: '2', type: 'NOTE_CREATED', timestamp: 200, noteId: 'n2', areaId: 'History' },
      { id: '3', type: 'LINK_CREATED', timestamp: 250, noteId: 'n2' },
      { id: '4', type: 'HUB_CREATED', timestamp: 300, noteId: 'n1', areaId: 'History' },
    ];
    const detail = buildAreaEvolutionDetail('History', notes, events, undefined, 'en');
    expect(detail.noteCount).toBe(2);
    expect(detail.linkCount).toBe(1);
    expect(detail.journeyPeriods.length).toBeGreaterThan(0);
  });
});

describe('K-46 knowledge journey', () => {
  it('maps milestones to journey steps', () => {
    const timeline = buildKnowledgeTimeline(
      [note('n1')],
      new KnowledgeIndexService(),
      undefined,
      { now: Date.now() },
    );
    const journey = buildKnowledgeJourney(timeline.milestones, []);
    expect(journey.steps.length).toBeGreaterThan(0);
  });
});

describe('K-46 history export', () => {
  it('exports deterministic markdown', () => {
    const summary = buildCosmosEvolutionSummary([note('n1')], new KnowledgeIndexService(), []);
    const story = buildExpandedCosmosEvolutionStory(summary, [], [note('n1')], [], []);
    const md = exportCosmosEvolutionMarkdown({ summary, story, milestones: [], lang: 'en' });
    expect(md).toContain('# Cosmos Evolution');
    expect(md).toContain('Notes');
  });
});

describe('K-46 bootstrap summary', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
      removeItem(key: string) { delete this.store[key]; },
    });
    clearKnowledgeHistory();
  });

  it('persists and dismisses bootstrap summary', () => {
    const events: KnowledgeHistoryEvent[] = [
      { id: '1', type: 'NOTE_CREATED', timestamp: 1, noteId: 'n1', metadata: { imported: 'true' } },
    ];
    saveBootstrapImportSummary(buildBootstrapImportSummaryFromEvents(events));
    expect(loadBootstrapImportSummary()?.notesImported).toBe(1);
    dismissBootstrapSummary();
    expect(loadBootstrapImportSummary()?.notesImported).toBe(1);
  });
});
