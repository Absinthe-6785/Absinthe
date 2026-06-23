/**
 * K-128 — Performance observation for release candidate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  K114_VAULT_NOTE_COUNTS,
  runK114LargeVaultMatrix,
} from '@/server/k114LargeVaultAudit';
import {
  runK115PerformanceMatrix,
  K115_PERF_DOMAINS,
} from '@/server/k115PerformanceAudit';
import { AUDIT_SIZES } from './editorPerformanceAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K128_PERF_VAULT_COUNTS = K114_VAULT_NOTE_COUNTS;
export const K128_PERF_DOMAINS = [
  ...K115_PERF_DOMAINS,
  'gallery',
  'health',
] as const;

export function auditK128Performance(): Record<string, boolean> {
  const gallery = readFileSync(join(ROOT, 'components/views/ImageGalleryViewer.tsx'), 'utf8');
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchVirtualList.tsx'), 'utf8');
  const matrix = runK115PerformanceMatrix();
  const vault = runK114LargeVaultMatrix();
  return {
    vaultCounts: K128_PERF_VAULT_COUNTS.length === 4,
    editorAuditSizes: AUDIT_SIZES.includes(1000),
    perfMatrixRuns: matrix.length === 4,
    vaultMatrixRuns: vault.length === 4,
    searchVirtualized: search.includes('data-k111-search-virtual-list'),
    galleryExists: gallery.includes('ImageGalleryViewer'),
    domains: K115_PERF_DOMAINS.length >= 5,
  };
}

export function auditK128PerformanceRc(): boolean {
  const r = auditK128Performance();
  return r.vaultCounts && r.perfMatrixRuns && r.searchVirtualized && r.galleryExists;
}
