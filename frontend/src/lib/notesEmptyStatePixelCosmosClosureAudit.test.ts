import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const closurePath = join(process.cwd(), 'docs', 'K-213-notes-empty-state-pixel-cosmos-closure-audit.md');

function readClosure(): string {
  return readFileSync(closurePath, 'utf8');
}

describe('K-213 notes empty state pixel-cosmos closure audit', () => {
  it('exists and defines the docs-only closure scope', () => {
    expect(existsSync(closurePath)).toBe(true);
    const text = readClosure();

    for (const required of [
      'K-213 Notes Empty State Pixel-Cosmos Pilot Closure / QA Audit',
      'K-213 closes the K-212 Notes empty-state pixel-cosmos pilot',
      'K-213 does not implement new UI',
      'does not expand Notes/Cosmos',
      'does not change runtime behavior',
      'decision point before broader Notes/Cosmos work',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes K-212 and the mobile 390px blocker resolution', () => {
    const text = readClosure();

    for (const required of [
      'K-212 added the Notes empty-state pixel-cosmos pilot',
      'Notes empty vault / empty state',
      'introduced a Notes / Living Cosmos identity',
      'Create note',
      'without implementing a graph engine',
      'full Notes/Cosmos navigation',
      'mobile 390px empty vault issue was found',
      'latest K-212 fix commit, `05fb864`',
      'isMobile && isMobileEmptyVault',
      'collapse the note list',
      'non-empty mobile Notes behavior remains preserved',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('audits callback, data-hook, and non-empty Notes preservation', () => {
    const text = readClosure();

    for (const required of [
      '## Callback / Data-Hook Preservation Audit',
      'did not change note creation callback semantics',
      'open-today callback',
      'import-backup callback',
      'note selection callback semantics',
      'editor callbacks',
      'persistence hooks',
      'store wiring',
      'provider wiring',
      'schema/data model',
      'routing semantics',
      'Existing vault-empty data hooks were preserved',
      '## Non-Empty Notes Regression Audit',
      'non-empty desktop Notes behavior',
      'non-empty mobile Notes behavior',
      'Existing note list rendering remains the same',
      'sidebar search/filter behavior',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('includes QA matrix, safety boundaries, and accessibility baseline', () => {
    const text = readClosure();

    for (const required of [
      '## QA Matrix',
      'Desktop empty Notes',
      'Tablet-ish empty Notes',
      'Mobile 390px empty Notes',
      'Non-empty desktop Notes',
      'Non-empty mobile Notes',
      'Search/filter empty state',
      'Create-note CTA visibility',
      'Keyboard tab reachability',
      'Visible focus ring',
      'No horizontal overflow',
      'Attachment Maintenance smoke',
      'Health smoke',
      'Schedule smoke',
      '## Safety Boundaries Confirmed',
      'stores unchanged',
      'persistence unchanged',
      'schemas unchanged',
      'providers unchanged',
      'OAuth unchanged',
      'Supabase unchanged',
      'attachments unchanged',
      'Health/Schedule unchanged',
      'assets/fonts/dependencies unchanged',
      'graph/cosmos navigation not implemented',
      '## Accessibility Baseline',
      'native button',
      'No empty-state action is icon-only or color-only',
      'Decorative motif elements are secondary',
      'avoids tiny hit targets',
      'understandable without the pixel-cosmos metaphor',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('records learnings, risks, and K-214 recommendation scope', () => {
    const text = readClosure();

    for (const required of [
      '## What Worked',
      'Notes empty state was a good low-risk next surface',
      'Pixel-cosmos identity can be introduced without data model changes',
      'Mobile-first validation was necessary',
      'The mobile blocker was caught before merge and fixed narrowly',
      '## Risks / What To Watch',
      'Notes/Cosmos can easily become too broad',
      'Mobile Notes layout is sensitive',
      'Archive should carry the stronger Voyager/time-distance metaphor later',
      'Home should carry the Signal Board concept later',
      'avoid jumping directly into graph/canvas implementation',
      'Recommended K-214 target: **K-214 Notes/Cosmos Concept Spec**.',
      '## Proposed K-214 Notes/Cosmos Concept Spec Scope',
      'docs/spec only',
      'Notes as Cosmos Map / Living Cosmos',
      'node/orbit/signal/cluster metaphor',
      'what belongs in Notes vs Archive',
      'how time participates without overloading Notes',
      'no graph/canvas engine',
      'no persistence changes',
      'no generated assets',
      'no global theme rollout',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closes K-212 surface-by-surface', () => {
    const text = readClosure();

    for (const required of [
      '## Non-Goals',
      'no runtime UI implementation in K-213',
      'no Notes graph/cosmos implementation',
      'no Archive/Voyager implementation',
      'no Home Signal Board implementation',
      'no editor changes',
      'no persistence changes',
      'no routing changes',
      'no assets/fonts/dependencies',
      'no global theme rollout',
      'no Health/Schedule changes',
      'no attachment/OAuth/Supabase changes',
      'no Google Drive QA work',
      '## Closure Statement',
      'K-212 is considered closed as the first Notes pixel-cosmos runtime surface',
      'Future Notes/Cosmos work should proceed through concept/spec',
      'Broader pixel UI work should continue surface-by-surface',
      'K-214 should define Notes/Cosmos boundaries before any graph/canvas work begins',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not contain obvious committed credential material', () => {
    const text = readClosure();

    for (const forbidden of [
      'AI' + 'za',
      'ya' + '29.',
      '-----BEGIN PRIVATE ' + 'KEY-----',
      'client_' + 'secret=',
      '"client_' + 'secret":',
      'access_' + 'token=',
      'refresh_' + 'token=',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
