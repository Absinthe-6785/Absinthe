/**
 * K-99 — visual consistency tokens (spacing, radius, typography).
 */
export const K99_VISUAL_TOKENS = {
  spacing: {
    sectionGapPx: 12,
    cardPaddingDesktopPx: 24,
    cardPaddingMobilePx: 16,
    listItemGapPx: 4,
    toolbarGapPx: 6,
  },
  radius: {
    buttonPx: 8,
    cardPx: 12,
    panelPx: 24,
    pillPx: 999,
  },
  typography: {
    sectionLabelPx: 10,
    bodyPx: 13,
    titlePx: 16,
    headingPx: 20,
  },
  layout: {
    noteListWidthDesktopPx: 216,
    workspacePanelRatioDesktop: 0.42,
    contextPanelDefaultPx: 220,
    readingMaxWidthPx: 720,
  },
} as const;

export interface K99VisualConsistencyRow {
  token: string;
  value: string | number;
  surfaces: string;
}

export function auditVisualConsistency(): K99VisualConsistencyRow[] {
  const t = K99_VISUAL_TOKENS;
  return [
    { token: 'spacing.sectionGap', value: t.spacing.sectionGapPx, surfaces: 'panels, settings' },
    { token: 'radius.card', value: t.radius.cardPx, surfaces: 'cards, empty states' },
    { token: 'radius.panel', value: t.radius.panelPx, surfaces: 'settings, schedule detail' },
    { token: 'typography.sectionLabel', value: t.typography.sectionLabelPx, surfaces: 'sidebar, context' },
    { token: 'layout.noteListWidth', value: t.layout.noteListWidthDesktopPx, surfaces: 'NoteView sidebar' },
    { token: 'layout.readingMaxWidth', value: t.layout.readingMaxWidthPx, surfaces: 'editor reading mode' },
  ];
}

export function formatK99VisualConsistencyReport(rows: readonly K99VisualConsistencyRow[]): string {
  const lines = ['K-99 visual consistency report', ''];
  for (const row of rows) {
    lines.push(`  ${row.token}=${row.value} → ${row.surfaces}`);
  }
  return lines.join('\n');
}
