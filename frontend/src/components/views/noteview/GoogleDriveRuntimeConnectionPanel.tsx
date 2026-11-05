import { useSyncExternalStore } from 'react';
import { googleDriveSessionRuntime } from '../../../lib/googleDriveSessionRuntime';
import { GoogleDriveManualConnectionPanel } from './GoogleDriveManualConnectionPanel';
import type { NoteChromeColors } from '../noteEditorTheme';

const SERVER_SNAPSHOT = Object.freeze({ accountId: null, generation: 0, controller: null });

export function GoogleDriveRuntimeConnectionPanel({ accountId, colors }: { accountId?: string; colors: NoteChromeColors }) {
  const snapshot = useSyncExternalStore(
    googleDriveSessionRuntime.subscribe,
    googleDriveSessionRuntime.getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  if (!accountId || snapshot.accountId !== accountId) return null;
  // This controller is NEVER passed into EmbeddedAttachmentMigrationReviewPanel.
  return <GoogleDriveManualConnectionPanel key={snapshot.generation} colors={colors} controller={snapshot.controller} />;
}
