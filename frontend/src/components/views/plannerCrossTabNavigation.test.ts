import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Schedule (PlannerView) wires CalendarShell event clicks to openNote (K-30.34).
 * Memo sidebar removed in K-48 — notes live in Note tab.
 */
describe('PlannerView cross-tab note navigation wiring', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'PlannerView.tsx'),
    'utf8',
  );

  it('imports openNote and passes it to CalendarShell event clicks', () => {
    expect(source).toContain("from '../../lib/noteNavigation'");
    expect(source).toContain('onEventNoteClick={openNote}');
  });

  it('does not embed a duplicate memo note list (K-48)', () => {
    expect(source).not.toContain('data-planner-column="memo"');
    expect(source).not.toContain('openNote(n.id)');
  });
});
