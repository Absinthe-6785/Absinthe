/**
 * K-120 — Documentation health audit (K-107 … K-119).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const K120_DOC_TICKETS = [
  'K-107-health-performance',
  'K-108-planner-cohesion',
  'K-108A-editor-header-localization-cleanup',
  'K-109-archive-history-cohesion',
  'K-110-recipe-studio',
  'K-111-search-responsiveness',
  'K-112-product-audit',
  'K-113-cross-domain-cohesion',
  'K-114-sync-memory-audit',
  'K-115-release-candidate',
  'K-116-real-usage-cleanup',
  'K-117-schedule-layout-cleanup',
  'K-118-mobile-media-refinement',
  'K-119-workspace-polish',
] as const;

export function auditDocsHealth(): Record<string, boolean> {
  const handbook = readFileSync(join(ROOT, 'docs/K-120-long-term-maintenance.md'), 'utf8');
  const k119 = readFileSync(join(ROOT, 'docs/K-119-workspace-polish.md'), 'utf8');
  const allExist = K120_DOC_TICKETS.every(t => existsSync(join(ROOT, `docs/${t}.md`)));
  return {
    allTicketDocs: allExist,
    handbookExists: handbook.includes('Architecture map'),
    handbookFlaky: handbook.includes('flaky'),
    k119Maintenance: k119.includes('Maintenance notes'),
    k119Limitations: k119.includes('Known limitations'),
  };
}

export function auditDocsRc(): boolean {
  const r = auditDocsHealth();
  return r.allTicketDocs && r.handbookExists && r.k119Maintenance;
}
