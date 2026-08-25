import { useMemo } from 'react';
import type { DateTime } from 'luxon';
import type { AppSettings, Theme } from '../../../../types';
import type { ToastType } from '../../../../hooks/useToast';
import { resolveAppLanguage, getTranslator } from '../../../../lib/i18n';
import { useVaultRestoreFlow } from '../../../../hooks/useVaultRestoreFlow';
import { VaultRestoreModal } from '../knowledge/VaultRestoreModal';
import { ArchiveUnifiedView } from './ArchiveUnifiedView';
import { WorkspaceErrorBoundary } from '../../../common/WorkspaceErrorBoundary';
import { useArchiveProjection } from './hooks/useArchiveProjection';

export interface ArchiveShellProps {
  accountId?: string;
  now: DateTime;
  appSettings: AppSettings;
  theme: Theme;
  showToast: (msg: string, type?: ToastType) => void;
  cloudSyncEnabled?: boolean;
}

/** K-109 Archive — history workspace with unified projection. */
export function ArchiveShell({
  now,
  accountId,
  appSettings,
  theme,
  showToast,
  cloudSyncEnabled = false,
}: ArchiveShellProps) {
  const nowDate = useMemo(() => now.toJSDate(), [now]);
  const { projection, isLoading } = useArchiveProjection(nowDate, appSettings.language);
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const vaultRestore = useVaultRestoreFlow(showToast, t, cloudSyncEnabled, accountId);

  return (
    <>
      <WorkspaceErrorBoundary workspace="archive">
      <div
        className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-2 lg:px-4 py-1 pr-2 pb-4 animate-in fade-in duration-300"
        data-archive-shell
        data-archive-mode="cohesion"
        data-k109-archive-shell
        data-k120-scroll-archive
      >
        <ArchiveUnifiedView
          projection={projection}
          theme={theme}
          appSettings={appSettings}
          isLoading={isLoading}
          onRestoreSnapshot={vaultRestore.openSnapshotRestore}
          onImportBackup={vaultRestore.openFilePicker}
        />
      </div>
      </WorkspaceErrorBoundary>
      {vaultRestore.preview && vaultRestore.selection && (
        <VaultRestoreModal
          preview={vaultRestore.preview}
          fullPreview={vaultRestore.fullPreview}
          pipelineOptions={vaultRestore.pipelineOptions}
          restoreSource={vaultRestore.restoreSource}
          strategy={vaultRestore.strategy}
          selection={vaultRestore.selection}
          onStrategyChange={vaultRestore.setStrategy}
          onPipelineOptionsChange={vaultRestore.updatePipelineOptions}
          onToggleNote={vaultRestore.toggleNote}
          onToggleFolder={vaultRestore.toggleFolder}
          onSelectAll={vaultRestore.selectAll}
          onSelectNone={vaultRestore.selectNone}
          onConfirm={vaultRestore.confirmRestore}
          onCancel={vaultRestore.cancelRestore}
          importing={vaultRestore.importing}
        />
      )}
      <input
        ref={vaultRestore.fileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        className="hidden"
        onChange={vaultRestore.handleFileChange}
      />
    </>
  );
}
