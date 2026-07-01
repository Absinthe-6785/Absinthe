import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const auditPath = join(process.cwd(), 'docs', 'K-216-notes-cosmos-current-surface-audit.md');

function readAudit(): string {
  return readFileSync(auditPath, 'utf8');
}

describe('K-216 Notes/Cosmos current surface audit', () => {
  it('exists and defines docs/audit-only scope', () => {
    expect(existsSync(auditPath)).toBe(true);
    const text = readAudit();

    for (const required of [
      'K-216 Notes/Cosmos Current Surface Audit',
      'K-216 audits the current Notes runtime surfaces after K-214 and K-215',
      'K-216 is docs/audit only',
      'K-216 does not implement Cosmos Map',
      'K-216 does not change runtime UI',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists the source inspection scope', () => {
    const text = readAudit();

    for (const required of [
      '## Source Inspection Scope',
      '`frontend/src/components/views/NoteView.tsx`',
      '`frontend/src/components/views/NoteGraphView.tsx`',
      '`frontend/src/components/views/noteview/NotesPixelCosmosEmptyState.tsx`',
      '`frontend/src/components/common/ProductEmptyState.tsx`',
      '`frontend/src/components/views/noteview/NoteSidebarVirtualList.tsx`',
      '`frontend/src/components/views/noteview/NoteViewEditorArea.tsx`',
      '`frontend/src/components/views/features/knowledge/graph/LocalGraphView.tsx`',
      'Current graph tests under',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents current Notes surface inventory', () => {
    const text = readAudit();

    for (const required of [
      '## Current Notes Surface Inventory',
      '### 1. Notes Shell / NoteView',
      '### 2. Notes List / Search / Filter',
      '### 3. Editor / Detail Surface',
      '### 4. NotesPixelCosmosEmptyState',
      '### 5. ProductEmptyState / Generic Empty-State Components',
      '### 6. NoteGraphView',
      '### 7. LocalGraphView / Context Graph',
      '### 8. Loading / Skeleton / Error States',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents graph/cosmos/knowledge data inventory with current and future classifications', () => {
    const text = readAudit();

    for (const required of [
      '## Current Graph / Cosmos / Knowledge Data Inventory',
      'Source-verified current runtime data',
      'Derived current runtime data',
      'Current UI state only',
      'Not found in audited sources',
      'Future concept only',
      'Requires separate schema/persistence spec',
      'persisted node positions',
      'account-age / satellite-distance data',
      'AI cluster data',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines NoteGraphView versus future Cosmos Map relationship', () => {
    const text = readAudit();

    for (const required of [
      '## NoteGraphView vs Future Cosmos Map Audit',
      'NoteGraphView is the current shipped graph-related surface.',
      'Future Cosmos Map is not implemented by K-216',
      'should not be assumed to replace NoteGraphView',
      'visually reinterprets NoteGraphView',
      'wraps NoteGraphView in a broader landing/preview',
      'becomes a separate exploratory mode',
      'replaces NoteGraphView after a separate migration/implementation spec',
      'Avoid duplicate graph/navigation responsibilities.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents empty-state and mobile findings', () => {
    const text = readAudit();

    for (const required of [
      '## Empty-State Findings',
      'No Notes / Empty Vault',
      'No Search Results',
      'Select A Note Placeholder',
      'Empty Trash',
      'Graph Empty / No Connected Notes',
      'Loading State',
      'Do not collapse all empty states into one metaphor.',
      '## Current Mobile / Responsive Findings',
      'isMobileEmptyVault',
      'mobile must not be treated as a smaller desktop graph',
      'future Cosmos preview needs a mobile fallback',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents runtime risks and recommends the next K-217 path', () => {
    const text = readAudit();

    for (const required of [
      '## Runtime Risk Findings',
      'NoteGraphView responsibilities may overlap with Cosmos Map',
      'LocalGraphView adds a second current graph surface',
      'Persisted spatial metadata was not found in audited sources.',
      'Graph/canvas implementation could pressure persistence/schema changes.',
      'Existing graph performance tests indicate graph rendering has meaningful cost',
      '## Implementation-Safe Next Options',
      'K-217 Notes/Cosmos Static Preview Plan',
      'K-217 NoteGraphView/Cosmos Relationship Decision Spec',
      '## Recommended Next PR',
      'Recommended K-217 target: **K-217 NoteGraphView/Cosmos Relationship Decision Spec**.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('lists non-goals and closure guardrails', () => {
    const text = readAudit();

    for (const required of [
      '## Non-Goals',
      'no runtime UI implementation in K-216',
      'no NoteView changes',
      'no NoteGraphView changes',
      'no NotesPixelCosmosEmptyState changes',
      'no ProductEmptyState changes',
      'no graph/canvas/navigation implementation',
      'no stores/schemas/providers changes',
      'no generated assets',
      'no fonts',
      'no dependencies',
      'no attachment/OAuth/Supabase changes',
      'No graph/canvas implementation should start until current surface responsibilities are clear.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not contain obvious committed credential material', () => {
    const text = readAudit();

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
