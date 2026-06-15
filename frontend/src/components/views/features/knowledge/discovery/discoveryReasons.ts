import type { TranslationKey } from '../../../../../lib/i18n';
import { suggestionSignalLabel } from '../knowledgeLabels';
import type { Language } from '../../../../../lib/i18n';
import { importanceClassificationLabel } from '../knowledgeLabels';
import type { DiscoveryItem } from './discoveryTypes';

export function formatDiscoveryReasonLines(
  item: DiscoveryItem,
  t: (key: TranslationKey) => string,
  lang: Language,
): string[] {
  const lines: string[] = [];

  if (item.kind === 'forgotten-knowledge' && item.daysSinceActivity != null) {
    lines.push(
      t('k39ReasonForgotten')
        .replace('{days}', String(item.daysSinceActivity))
        .replace('{tier}', item.importanceClass
          ? importanceClassificationLabel(item.importanceClass, lang)
          : ''),
    );
  }

  if (item.kind === 'knowledge-drift' && item.daysSinceActivity != null) {
    lines.push(t('k39ReasonDrift').replace('{days}', String(item.daysSinceActivity)));
  }

  if (item.kind === 'missing-connection' && item.signals?.length) {
    for (const signal of item.signals.slice(0, 4)) {
      lines.push(`• ${suggestionSignalLabel(signal, lang)}`);
    }
  }

  if (item.kind === 'emerging-topic' && item.noteCount != null) {
    lines.push(
      t('k39ReasonEmerging')
        .replace('{count}', String(item.noteCount)),
    );
  }

  if (item.kind === 'weak-hub' && item.noteCount != null) {
    lines.push(t('k39ReasonWeakHub').replace('{count}', String(item.noteCount)));
  }

  if (item.kind === 'isolated-notes') {
    lines.push(t('k70ReasonIsolatedNote'));
  }

  if (item.kind === 'recently-active-area' && item.noteCount != null) {
    lines.push(t('k70ReasonActiveArea').replace('{count}', String(item.noteCount)));
  }

  if (item.kind === 'stale-area' && item.noteCount != null) {
    lines.push(t('k70ReasonStaleArea').replace('{count}', String(item.noteCount)));
  }

  return lines;
}
