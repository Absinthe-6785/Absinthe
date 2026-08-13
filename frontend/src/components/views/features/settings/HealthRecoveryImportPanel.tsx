import { useRef, useState, type ChangeEvent } from 'react';
import { ShieldCheck, Upload } from 'lucide-react';
import {
  importVerifiedHealthRecovery,
  prevalidateHealthRecoveryImport,
  type HealthRecoveryPrevalidation,
} from '@/lib/healthRecoveryImport';
import { orderHealthRecoveryDatasets, type HealthRecoveryDatasets } from '@/lib/healthRecoveryExport';
import { stableRecoveryJson } from '@/lib/recoveryExportPackage';
import { createLocalHealthDriver, type LocalHealthAccountSnapshot } from '@/lib/healthLocalRepository';
import { isRecoveryModeActive } from '@/lib/recoverySafetyPolicy';

type Theme = { card: string; border: string; input: string; textMuted: string };

export const HEALTH_RECOVERY_IMPORT_UI_BOUNDARY = 'temporary-rtu-local-recovery';

export function isHealthRecoveryImportUiEnabled(): boolean {
  return isRecoveryModeActive();
}

export function summarizeHealthRecoveryImport(preview: HealthRecoveryPrevalidation): string {
  return Object.entries(preview.datasetCounts)
    .map(([dataset, count]) => `${dataset}: ${count}`)
    .join(' | ');
}

export function assertHealthRecoveryAccountMatch(
  preview: HealthRecoveryPrevalidation,
  accountId: string,
): void {
  if (preview.export.sourceAccount.userId !== accountId) {
    throw new Error('health_import_authenticated_account_mismatch');
  }
}

function healthRecoveryImportErrorMessage(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : 'health_recovery_import_failed';
  if (code === 'health_recovery_already_imported') {
    return 'This exact Health recovery dataset is already present locally; reimport blocked.';
  }
  if (code === 'health_import_authenticated_account_mismatch') {
    return 'The selected recovery artifact does not match the authenticated account.';
  }
  if (code === 'health_import_prior_state_not_stable') {
    return 'A pending Health recovery operation must be resolved before retrying.';
  }
  return code;
}

export async function readHealthRecoveryPreflight(accountId: string): Promise<LocalHealthAccountSnapshot> {
  const driver = await createLocalHealthDriver();
  try {
    const snapshot = await driver.readAccountSnapshot(accountId);
    if (snapshot.importState !== null && snapshot.importState.status !== 'VERIFIED_IMPORT_COMPLETE') {
      throw new Error('health_import_prior_state_not_stable');
    }
    return snapshot;
  } finally {
    driver.close();
  }
}

export function isExactRecoveredDataset(
  current: HealthRecoveryDatasets,
  candidate: HealthRecoveryPrevalidation['export']['datasets'],
): boolean {
  return stableRecoveryJson(orderHealthRecoveryDatasets(current))
    === stableRecoveryJson(orderHealthRecoveryDatasets(candidate));
}

export interface HealthRecoveryImportPanelProps {
  accountId: string;
  theme: Theme;
  onToast?: (message: string, type?: 'success' | 'error') => void;
}

export function HealthRecoveryImportPanel({ accountId, theme, onToast }: HealthRecoveryImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<HealthRecoveryPrevalidation | null>(null);
  const [currentRows, setCurrentRows] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  if (!isHealthRecoveryImportUiEnabled()) return null;

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      const fileText = await file.text();
      const nextPreview = await prevalidateHealthRecoveryImport(fileText);
      assertHealthRecoveryAccountMatch(nextPreview, accountId);
      const currentSnapshot = await readHealthRecoveryPreflight(accountId);
      const current = currentSnapshot.datasets;
      const total = Object.values(current).reduce((sum, rows) => sum + rows.length, 0);
      if (currentSnapshot.importState?.status === 'VERIFIED_IMPORT_COMPLETE'
        && isExactRecoveredDataset(current, nextPreview.export.datasets)) {
        throw new Error('health_recovery_already_imported');
      }
      setCurrentRows(total);
      setSource(fileText);
      setPreview(nextPreview);
    } catch (cause) {
      setError(healthRecoveryImportErrorMessage(cause));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!source) throw new Error('health_recovery_source_missing');
      const driver = await createLocalHealthDriver();
      try {
        const result = await importVerifiedHealthRecovery({ source, driver, accountId });
        setMessage(`Local Health recovery complete: ${result.totalRows} rows read back. ${summarizeHealthRecoveryImport({ ...preview, datasetCounts: result.datasetCounts })}`);
        setPreview(null);
        setSource(null);
        onToast?.('Local historical Health recovery complete');
      } finally {
        driver.close();
      }
    } catch (cause) {
      setError(healthRecoveryImportErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void selectFile(event.target.files?.[0]);
  };

  return (
    <section className={`border-t pt-5 ${theme.border}`} data-health-recovery-import-boundary={HEALTH_RECOVERY_IMPORT_UI_BOUNDARY}>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-heading text-base font-bold flex items-center gap-2"><ShieldCheck size={16} className="text-primary" />Local historical Health recovery</h3>
          <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Temporary recovery mode only. The verified artifact is parsed and written to this browser&apos;s local Health storage. Remote Health and Notes writes are disabled.</p>
        </div>
        <div className={`rounded-xl border p-3 text-xs ${theme.border} ${theme.input}`}>
          <p className="font-bold">Authenticated account: checked against the selected artifact before local inspection</p>
          <p className="mt-1">Destination: local IndexedDB only | Remote writes: disabled</p>
          {currentRows !== null && <p className="mt-1">Current local Health rows: {currentRows}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground disabled:opacity-60">
          <Upload size={16} />{busy ? 'Validating...' : 'Select verified Health recovery JSON'}
        </button>
        {preview && (
          <div className={`rounded-xl border p-4 text-sm ${theme.border} ${theme.input}`} data-health-recovery-import-confirmation>
            <p className="font-bold">Confirm local historical Health import</p>
            <p className="mt-1">Account match: {preview.export.sourceAccount.userId === accountId ? 'PASS' : 'FAIL'}</p>
            <p>Total rows: {preview.totalRows}</p>
            <p className="text-xs mt-1">{summarizeHealthRecoveryImport(preview)}</p>
            <p className="text-xs mt-1">Destination: local IndexedDB only | Remote writes: disabled</p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => { setPreview(null); setSource(null); }} disabled={busy} className={`px-4 py-2 rounded-lg border ${theme.border}`}>Cancel</button>
              <button type="button" onClick={() => void confirmImport()} disabled={busy || preview.export.sourceAccount.userId !== accountId} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-60">Confirm local import</button>
            </div>
          </div>
        )}
        {message && <p className="text-sm font-bold text-green-600" role="status">{message}</p>}
        {error && <p className="text-sm font-bold text-red-500" role="alert">Import not completed: {error}</p>}
      </div>
    </section>
  );
}
