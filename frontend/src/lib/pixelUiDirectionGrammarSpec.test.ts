import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const specPath = join(process.cwd(), 'docs', 'K-207-pixel-ui-direction-grammar-spec.md');

function readSpec(): string {
  return readFileSync(specPath, 'utf8');
}

describe('K-207 pixel UI direction grammar spec', () => {
  it('exists and defines the K-207 docs-only scope', () => {
    expect(existsSync(specPath)).toBe(true);
    const text = readSpec();

    for (const required of [
      'K-207 Pixel UI Direction / Grammar Spec',
      'too generic, too SaaS-like',
      'AI-generated productivity dashboard',
      'design direction and specification PR only',
      'K-207 does not implement runtime UI',
      'does not add generated assets',
      'does not add font files',
      'does not change application behavior',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines the pixel-cosmos personal OS identity and principles', () => {
    const text = readSpec();

    for (const required of [
      'Absinthe is not a clean SaaS dashboard.',
      'Absinthe is a pixel-cosmos personal operating system.',
      'cosmic inventory',
      'signals, nodes, slots, and logs',
      'Pixel is grammar, not decoration.',
      'Information readability comes before nostalgia.',
      'cosmic, not arcade',
      'Long reading and writing surfaces remain modern and calm.',
      'AI-generated assets are allowed for prototype exploration',
      'human-curated',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('captures mood keywords and anti-patterns', () => {
    const text = readSpec();

    for (const required of [
      'pixel-cosmos',
      'cozy sci-fi',
      'observatory',
      'inventory dashboard',
      'personal space archive',
      'satellite viewpoint',
      'signal / node / orbit',
      'quiet interface',
      'cosmic operating system',
      'childish retro game skin',
      'noisy arcade UI',
      'low-readability pixel fonts everywhere',
      'generic SaaS with pixel stickers',
      'random decorative stars without system meaning',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines information hierarchy and pixel usage boundaries', () => {
    const text = readSpec();

    for (const required of [
      'Text and content remain readable.',
      'UI frame, status, icon, and background treatment can be pixel-inspired.',
      'Data-dense areas must stay clean.',
      'Pixel motif opacity should be low behind content.',
      'No pixel noise should sit behind long text.',
      'Primary actions must remain obvious.',
      'Warning and error states must remain clear.',
      'Pixel style is encouraged in:',
      'card borders',
      'panel frames',
      'status badges',
      'inventory slots',
      'loading and skeleton accents',
      'Pixel style should be avoided in:',
      'editor body text',
      'long paragraphs',
      'form inputs',
      'dense tables',
      'dates, times, and numbers',
      'accessibility-critical copy',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines component grammar and tab metaphor map', () => {
    const text = readSpec();

    for (const required of [
      '## Component Grammar',
      '### Pixel Panel',
      '### Inventory Card / Slot',
      'ready, blocked, manual review, synced, missing, and recoverable',
      '### Status Badge',
      'icon plus text, not icon-only state',
      '### Section Header',
      '### Background Motif',
      '### Empty State',
      '### Navigation Node',
      '## Tab Metaphor Map',
      '### Notes',
      'cosmos map',
      '### Health',
      'status panel',
      '### Schedule',
      'mission timeline',
      '### Attachments / Maintenance',
      'inventory or storage bay',
      '### Settings',
      'observatory control panel',
      '### Dashboard',
      'command center',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('documents AI-assisted asset workflow, constraints, and accessibility requirements', () => {
    const text = readSpec();

    for (const required of [
      '## AI-Assisted Pixel Asset Workflow',
      'Phase 1: AI-Assisted Prototype',
      'Phase 2: Style Lock',
      'Phase 3: Human-Authored Renewal',
      'retouch assets manually in Aseprite',
      '## AI Asset Constraints',
      '16x16, 24x24, 32x32, and 48x48',
      '1px dark outline',
      '8-12 colors per asset family',
      'transparent backgrounds for icons',
      'Do not include text inside generated pixel assets unless manually retouched.',
      'Avoid over-detailed sprites.',
      'Export assets only after review and retouch.',
      '## Accessibility / Readability Constraints',
      'Contrast must remain sufficient.',
      'Body font remains readable sans-serif.',
      'Pixel font, if ever used, is only for very short labels or decorative headings.',
      'Status cannot rely on color alone.',
      'Badges require text labels.',
      'Motion must respect reduced motion.',
      'Focus states must be clear.',
      'Interactive hit targets remain normal UI size',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('defines rollout, non-goals, and future acceptance criteria', () => {
    const text = readSpec();

    for (const required of [
      '## Rollout Plan',
      'K-207: Pixel UI Direction / Grammar Spec.',
      'K-208: Pixel Inventory Component Pilot.',
      'K-209: Attachment Maintenance Pixel Visual Pass.',
      'K-210: Notes/Cosmos Pixel Navigation Concept.',
      'K-211: Dashboard Shell Pixel-Cosmos Theme Pass.',
      'K-212: Health/Schedule Light Pixel Integration.',
      'Attachment Maintenance is a good pilot',
      'Notes/Cosmos remains core, but it should expand after grammar is locked',
      '## First Implementation Candidate',
      'K-208 Pixel Inventory Component Pilot is the recommended next step.',
      'no upload or recovery logic change',
      '## Non-Goals',
      'No runtime implementation in K-207.',
      'No new generated assets in K-207.',
      'No Health/Schedule layout rewrite.',
      'No Notes persistence changes.',
      'No attachment/OAuth/Supabase behavior changes.',
      'No pixel font files.',
      '## Future Implementation Acceptance Criteria',
      'no horizontal overflow',
      'no unreadable text',
      'clear primary action',
      'clear destructive action',
      'clear disabled and blocked state',
      'reusable pixel elements through components or tokens',
    ]) {
      expect(text).toContain(required);
    }
  });

  it('does not contain obvious committed credential material', () => {
    const text = readSpec();

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
