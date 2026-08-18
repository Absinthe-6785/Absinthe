import { describe, expect, it } from 'vitest';
import { auditStartupGuards, auditLargeVaultStartup } from './k115StartupAudit';
import { auditSessionStability, estimateSessionRequestCount } from './k115SessionAudit';
import { auditMobileChecklist, auditMobileTouchTargets, auditMobileDomains } from './k115MobileAudit';
import { auditDesktopLayout, auditDesktopPanels } from './k115DesktopAudit';
import { auditKeyboardRc, auditKeyboardMatrix } from './k115KeyboardAudit';
import { auditProjectionIndependence, auditProjectionRc } from './k115ProjectionAudit';
import {
  auditRecoveryComplete,
  auditRecoveryPanelContract,
  auditRecoveryRc,
  recoveryWiringComplete,
  type K115RecoveryWiring,
} from './k115RecoveryAudit';
import { auditPerformanceMatrix, runK115PerformanceMatrix } from './k115PerformanceAudit';
import { auditRenderReady, auditRenderRc } from './k115RenderAudit';

describe('k115 release candidate audits', () => {
  it('A — startup guards', () => {
    const guards = auditStartupGuards();
    expect(guards.bootstrapOnce).toBe(true);
    expect(guards.noDuplicateHydration).toBe(true);
    expect(guards.completeSnapshotBootstrap).toBe(true);
    expect(guards.retiredHydratePaths).toBe(true);
    expect(auditLargeVaultStartup().length).toBeGreaterThan(0);
  });

  it('B — session stability policy', () => {
    const items = auditSessionStability();
    expect(items).toContain('account-bootstrap');
    expect(items).toContain('complete-snapshot');
    expect(estimateSessionRequestCount(120)).toBeLessThan(500);
  });

  it('C — mobile QA matrix', () => {
    expect(auditMobileTouchTargets()).toBe(true);
    expect(auditMobileChecklist()).toContain('320');
    expect(auditMobileDomains().some(d => d.startsWith('search:'))).toBe(true);
  });

  it('D — desktop QA', () => {
    expect(auditDesktopPanels().length).toBeGreaterThan(3);
    expect(auditDesktopLayout()).toContain('panel-widths-bounded');
  });

  it('E — keyboard RC matrix', () => {
    expect(auditKeyboardRc()).toBe(true);
    expect(auditKeyboardMatrix().length).toBe(12);
  });

  it('F — projection independence', () => {
    const ind = auditProjectionIndependence();
    expect(ind.count).toBe(6);
    expect(ind.noGlobalProjection).toBe(true);
    expect(ind.noCircularImports).toBe(true);
    expect(auditProjectionRc()).toContain('no-cycles');
  });

  it('G — error recovery', () => {
    expect(auditRecoveryComplete()).toBe(true);
    expect(auditRecoveryRc()).toContain('sync-failure-retrySync');
    expect(auditRecoveryPanelContract(`
      <section data-settings-data-safety-restore>
        <button onClick={vaultRestore.openFilePicker} />
      </section>
      <section data-settings-data-safety-snapshots>
        <button onClick={() => vaultRestore.openSnapshotRestore(snap.snapshotId)} />
      </section>
    `))
      .toBe(true);
    expect(auditRecoveryPanelContract('<section>Restore snapshots</section>')).toBe(false);
  });

  it('requires executable recovery capabilities, not markers alone', () => {
    const complete: K115RecoveryWiring = {
      retrySync: true,
      localCoreRestore: true,
      vaultImport: true,
      recoveryCenter: true,
      snapshotValidate: true,
      snapshotEnumerate: true,
      panelRestore: true,
      offlineNotes: true,
      storageMergeGuard: true,
    };
    expect(recoveryWiringComplete(complete)).toBe(true);
    for (const capability of [
      'panelRestore',
      'snapshotEnumerate',
      'offlineNotes',
      'storageMergeGuard',
    ] as const) {
      expect(recoveryWiringComplete({ ...complete, [capability]: false })).toBe(false);
    }
    expect(auditRecoveryPanelContract(
      '<section data-settings-data-safety-restore data-settings-data-safety-snapshots />',
    )).toBe(false);
    expect(auditRecoveryPanelContract(`
      <section data-settings-data-safety-restore />
      <section data-settings-data-safety-snapshots>
        <button onClick={() => vaultRestore.openSnapshotRestore(snap.snapshotId)} />
      </section>
    `)).toBe(false);
    expect(auditRecoveryPanelContract(`
      <section data-settings-data-safety-restore>
        <button onClick={vaultRestore.openFilePicker} />
      </section>
      <section data-settings-data-safety-snapshots />
    `)).toBe(false);
  });

  it('H — performance matrix', () => {
    const rows = runK115PerformanceMatrix();
    expect(rows[rows.length - 1]?.noteCount).toBe(10000);
    expect(auditPerformanceMatrix()).toContain('10000');
  });

  it('I — render production validation', () => {
    expect(auditRenderReady()).toBe(true);
    expect(auditRenderRc()).toContain('bootstrap-once');
    expect(auditRenderRc()).toContain('complete-snapshot-adopted');
    expect(auditRenderRc()).toContain('no-get-loop');
  });
});
