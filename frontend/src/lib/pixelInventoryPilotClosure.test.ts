import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const closurePath = join(process.cwd(), 'docs', 'K-211-pixel-inventory-pilot-closure-next-surface.md');

function readClosure(): string {
  return readFileSync(closurePath, 'utf8');
}

describe('K-211 pixel inventory pilot closure', () => {
  it('exists and defines the docs-only closure scope', () => {
    expect(existsSync(closurePath)).toBe(true);
    const text = readClosure();

    for (const required of [
      'K-211 Pixel Inventory Pilot Closure and Next Surface Selection',
      'K-211 closes the first Pixel Inventory pilot cycle',
      'evaluates K-207 through K-210',
      'K-211 does not implement runtime UI',
      'K-211 does not expand the Attachment Maintenance pilot',
      'design evaluation and selection document only',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('summarizes K-207 through K-210', () => {
    const text = readClosure();

    for (const required of [
      '### K-207 Pixel UI Direction / Grammar Spec',
      'pixel-cosmos personal OS direction',
      'pixel as grammar, not decoration',
      'Attachment Maintenance as the first safe pilot candidate',
      '### K-208 Pixel Inventory Component Pilot',
      'Attachment Maintenance queue/status buckets',
      'no generated assets, no font files, and no dependencies',
      '### K-209 Attachment Maintenance Pixel Inventory Polish',
      'literal-first',
      'title/count rhythm',
      '### K-210 Attachment Pixel Item Row Overflow Hardening',
      'long attachment text wrapping',
      'action button visibility',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents learnings, keep rules, anti-patterns, and accessibility baseline', () => {
    const text = readClosure();

    for (const required of [
      '## What Worked',
      'Attachment Maintenance was a good pilot because it already uses inventory-like states.',
      'Pixel styling worked best as frame, status, and structure',
      '## What Did Not Work / Risks Observed',
      'Long item names can easily break visual rhythm',
      'Item rows are more fragile than bucket headers.',
      '## Keep Rules',
      'Literal state text first, metaphor second.',
      'No icon-only status.',
      'No color-only status.',
      'Long text must be hardened before merge.',
      'Each new surface should be narrow and reversible.',
      '## Anti-Patterns To Avoid',
      'Generic SaaS UI with pixel stickers.',
      'Full retro game skin.',
      'Decorative stars without system meaning.',
      'Pixel font for long text.',
      'Expanding to multiple tabs in one PR.',
      '## Accessibility and Responsive Baseline',
      'visible focus rings',
      'keyboard reachable controls',
      'native button and checkbox semantics',
      'no horizontal overflow',
      'reduced motion must be respected',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('compares candidate next surfaces and recommends K-212', () => {
    const text = readClosure();

    for (const required of [
      '### 1. Notes Empty State Pixel-Cosmos Pilot',
      '### 2. Dashboard Command-Center Summary Pilot',
      '### 3. Attachment Diagnostics Compact Status Strip',
      '### 4. Notes/Cosmos Navigation Concept Doc or Pilot',
      '### 5. Settings / Observatory Controls Small Pilot',
      '### 6. Health/Schedule Light Pixel Integration',
      'Recommended K-212 target: **K-212 Notes Empty State Pixel-Cosmos Pilot**.',
      'Fallback if the team wants lower risk: **K-212 Attachment Diagnostics Pixel Status Strip Pilot**.',
      '## K-212 Proposed Scope',
      'No graph engine.',
      'No cosmos engine.',
      'No note persistence changes.',
      'No editor behavior changes.',
      'No broad Notes redesign.',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('captures the product metaphor split and non-goals', () => {
    const text = readClosure();

    for (const required of [
      'Home = Signal Board.',
      'Notes = Cosmos Map / Living Cosmos.',
      'Archive = Voyager View / Time-Distance Archive.',
      'Attachments = Inventory Bay.',
      'Health = Status Core.',
      'Schedule = Mission Orbit.',
      'Time can be a main concept across the product.',
      'No runtime UI implementation in K-211.',
      'No new assets.',
      'No fonts.',
      'No dependencies.',
      'No Health/Schedule changes.',
      'No attachment, OAuth, or Supabase behavior changes.',
      'No persistence or data model changes.',
      'Future pixel work should move surface-by-surface.',
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
