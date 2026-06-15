import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useTranslation, resolveIntlLocale } from '@/lib/i18n';
import { TOUCH_TARGET_MIN_PX } from '@/lib/responsiveLayout';
import { extractTags } from '../../../noteUtils';
import type { NoteBase } from '../../../noteUtils';
import { getNoteKind } from '../research/noteClassification';
import { noteKindLabel, importanceClassificationLabel } from '../knowledgeLabels';
import { formatUniverseUpdatedAt } from '../graph/knowledgeUniverse';
import { listTags } from '../tags/noteTags';
import type { KnowledgeImportanceResult } from './intelligence/knowledgeImportance';

export interface CosmosGraphPreviewColors {
  bg: string;
  toolbar: string;
  toolbarB: string;
  txt: string;
  act: string;
  toolTxt: string;
}

export interface CosmosGraphPreviewNodeMeta {
  title: string;
  links: number;
  backlinkCount: number;
  galaxyLabel: string;
}

export type CosmosPreviewLayout = 'rail' | 'sheet';

export interface CosmosGraphPreviewPanelProps {
  note: NoteBase;
  graphNode: CosmosGraphPreviewNodeMeta;
  colors: CosmosGraphPreviewColors;
  importance: KnowledgeImportanceResult | null;
  onOpenNote: () => void;
  onClose?: () => void;
  layout?: CosmosPreviewLayout;
}

function bodySummarySnippet(body: string, maxLen = 120): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/[#*_`~>\[\]()!|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

export function CosmosGraphPreviewPanel({
  note,
  graphNode,
  colors,
  importance,
  onOpenNote,
  onClose,
  layout = 'rail',
}: CosmosGraphPreviewPanelProps) {
  const { t, lang } = useTranslation();
  const intlLocale = resolveIntlLocale(lang);
  const isSheet = layout === 'sheet';

  const title = graphNode.title.trim() || note.title.trim() || t('untitledNote');
  const noteKind = getNoteKind(note);
  const tags = useMemo(() => {
    const fromBody = extractTags(note.body ?? '');
    const pageTags = listTags(note);
    return [...new Set([...fromBody, ...pageTags])];
  }, [note]);

  const createdLabel = note.createdAt
    ? formatUniverseUpdatedAt(note.createdAt, intlLocale)
    : null;
  const summary = bodySummarySnippet(note.body ?? '');

  return (
    <>
      {isSheet && onClose && (
        <div
          role="presentation"
          aria-hidden
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 11,
          }}
        />
      )}
      <aside
        style={{
          ...(isSheet
            ? {
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                flex: 'none',
                width: '100%',
                maxHeight: 'min(55vh, 420px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                borderLeft: 'none',
                borderTop: `1px solid ${colors.toolbarB}`,
                borderRadius: '14px 14px 0 0',
                boxShadow: '0 -10px 28px rgba(0,0,0,0.22)',
              }
            : {
                flex: '0 0 280px',
                width: 280,
                height: '100%',
                borderLeft: `1px solid ${colors.toolbarB}`,
              }),
          background: colors.toolbar,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 12,
        }}
        data-cosmos-graph-preview
        data-cosmos-graph-preview-layout={layout}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: isSheet ? '12px 14px 0' : '14px 12px 0',
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              flex: 1,
              fontSize: isSheet ? 14 : 13,
              fontWeight: 700,
              color: colors.act,
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {title}
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('cosmosPreviewClose')}
              style={{
                flexShrink: 0,
                width: TOUCH_TARGET_MIN_PX,
                height: TOUCH_TARGET_MIN_PX,
                margin: -8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: 8,
                color: colors.toolTxt,
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isSheet ? '10px 16px 16px' : '8px 12px 14px' }}>
          {noteKind && (
            <div style={{ marginTop: 4, fontSize: 10, color: colors.toolTxt }}>
              <span style={{ fontWeight: 600 }}>{t('cosmosPreviewNoteType')}: </span>
              {noteKindLabel(noteKind, lang)}
            </div>
          )}

          {tags.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {tags.slice(0, 8).map(tag => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: `${colors.act}18`,
                    color: colors.act,
                    border: `1px solid ${colors.act}33`,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {createdLabel && (
            <div style={{ marginTop: 8, fontSize: 10, color: colors.toolTxt }}>
              <span style={{ fontWeight: 600 }}>{t('cosmosPreviewCreated')}: </span>
              {createdLabel}
            </div>
          )}

          {summary && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: colors.toolTxt, marginBottom: 4 }}>
                {t('cosmosPreviewSummary')}
              </div>
              <p style={{ margin: 0, fontSize: 10, lineHeight: 1.5, color: colors.txt, opacity: 0.85 }}>
                {summary}
              </p>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 10, color: colors.toolTxt }}>
            {t('cosmosPreviewRelations')
              .replace('{links}', String(graphNode.links))
              .replace('{backlinks}', String(graphNode.backlinkCount))}
          </div>

          <div style={{ marginTop: 4, fontSize: 10, color: colors.toolTxt, opacity: 0.85 }}>
            {t('cosmosHudBacklinksGalaxy')
              .replace('{count}', String(graphNode.backlinkCount))
              .replace('{galaxy}', graphNode.galaxyLabel)}
          </div>

          {importance && (
            <div style={{ marginTop: 6, fontSize: 10, color: colors.toolTxt }}>
              {t('k36HudImportanceTier').replace(
                '{tier}',
                importanceClassificationLabel(importance.classification, lang),
              )}
            </div>
          )}
        </div>

        <div
          style={{
            padding: isSheet ? '12px 14px 16px' : '10px 12px 12px',
            paddingBottom: isSheet ? 'max(16px, env(safe-area-inset-bottom))' : undefined,
            borderTop: `1px solid ${colors.toolbarB}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onOpenNote}
            style={{
              width: '100%',
              fontSize: isSheet ? 12 : 11,
              fontWeight: 700,
              padding: isSheet ? '12px 14px' : '8px 12px',
              minHeight: isSheet ? TOUCH_TARGET_MIN_PX : undefined,
              borderRadius: 6,
              border: 'none',
              background: colors.act,
              color: colors.bg,
              cursor: 'pointer',
            }}
          >
            {t('cosmosPreviewOpenNote')}
          </button>
          <p style={{ margin: 0, fontSize: 9, color: colors.toolTxt, textAlign: 'center', lineHeight: 1.4 }}>
            {isSheet ? t('cosmosPreviewTapOpenHint') : t('cosmosPreviewDoubleClick')}
          </p>
        </div>
      </aside>
    </>
  );
}
