// @vitest-environment happy-dom
/**
 * K-92B2A — Graph signature restart gate verification.
 * Run: npm test -- k92b2aGraphSignature
 */
import { describe, expect, it } from 'vitest';
import {
  formatK92b2aAuditTable,
  formatK92b2aTopologyBaselineTable,
  noteGraphViewUsesGraphTopologySignatureGate,
  readForceSimEffectDepsFromNoteGraphView,
  runK92b2aRestartGateAudit,
  signatureAfterLinkAdd,
  signatureAfterLinkRemove,
  signatureAfterTagEdit,
  signatureAfterTitleEdit,
  simEffectWouldRestart,
  snapshotProductionSimConfig,
} from './k92b2aGraphSignatureRestartAudit';
import type { CosmosSimContextSnapshot } from './cosmosSimReheat';

const SCALES = [100, 300, 500, 1000] as const;
const SCENARIOS = ['metadata_only', 'link_add', 'link_remove'] as const;

const BASE_CONTEXT = (sig: string): CosmosSimContextSnapshot => ({
  graphTopologySignature: sig,
  sizeW: 800,
  sizeH: 600,
  relationshipFilter: 'all',
  graphViewMode: 'universe',
  reducedMotion: false,
});

describe('K-92B2A graph signature restart gate', () => {
  it('prints before/after benchmark table', () => {
    const rows = SCALES.flatMap(n => SCENARIOS.map(s => runK92b2aRestartGateAudit(n, s)));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b2aAuditTable(rows));
    // eslint-disable-next-line no-console
    console.log('\n' + formatK92b2aTopologyBaselineTable(SCALES));
    expect(rows.length).toBe(12);
  }, 300_000);

  it('force sim effect depends on graphTopologySignature not store versions', () => {
    const deps = readForceSimEffectDepsFromNoteGraphView();
    expect(deps).toContain('graphTopologySignature');
    expect(deps).not.toContain('vaultStructureVersion');
    expect(deps).not.toContain('indexContentVersion');
    expect(deps).not.toContain('dragging');
    expect(snapshotProductionSimConfig(1000).effectRestartDeps).toContain('graphTopologySignature');
    expect(snapshotProductionSimConfig(1000).effectRestartDeps).not.toContain('vaultStructureVersion');
  });

  it('NoteGraphView wires graph topology signature gate', () => {
    expect(noteGraphViewUsesGraphTopologySignatureGate()).toBe(true);
  });

  it('title edit does not restart sim (signature unchanged)', () => {
    const { before, after } = signatureAfterTitleEdit();
    expect(before).toBe(after);
    expect(simEffectWouldRestart(BASE_CONTEXT(before), BASE_CONTEXT(after))).toBe(false);
    const row = runK92b2aRestartGateAudit(500, 'metadata_only');
    expect(row.afterRestartCount).toBe(0);
    expect(row.afterTickCount).toBe(0);
  });

  it('tag edit does not restart sim (signature unchanged)', () => {
    const { before, after } = signatureAfterTagEdit();
    expect(before).toBe(after);
    expect(simEffectWouldRestart(BASE_CONTEXT(before), BASE_CONTEXT(after))).toBe(false);
  });

  it('link add restarts sim (signature changed)', () => {
    const { before, after } = signatureAfterLinkAdd();
    expect(before).not.toBe(after);
    expect(simEffectWouldRestart(BASE_CONTEXT(before), BASE_CONTEXT(after))).toBe(true);
    const row = runK92b2aRestartGateAudit(500, 'link_add');
    expect(row.afterRestartCount).toBe(1);
    expect(row.afterTickCount).toBeGreaterThan(0);
  });

  it('link remove restarts sim (signature changed)', () => {
    const { before, after } = signatureAfterLinkRemove();
    expect(before).not.toBe(after);
    expect(simEffectWouldRestart(BASE_CONTEXT(before), BASE_CONTEXT(after))).toBe(true);
    const row = runK92b2aRestartGateAudit(500, 'link_remove');
    expect(row.afterRestartCount).toBe(1);
    expect(row.afterTickCount).toBeGreaterThan(0);
  });

  it('metadata-only path eliminates warm settle @ all scales', () => {
    for (const n of SCALES) {
      const row = runK92b2aRestartGateAudit(n, 'metadata_only');
      expect(row.beforeRestartCount).toBe(1);
      expect(row.beforeTickCount).toBeGreaterThan(0);
      expect(row.afterRestartCount).toBe(0);
      expect(row.afterTickCount).toBe(0);
      expect(row.afterSettleCount).toBe(0);
    }
  }, 120_000);
});
