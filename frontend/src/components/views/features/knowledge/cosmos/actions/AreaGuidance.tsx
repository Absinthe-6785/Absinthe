import { useTranslation } from '../../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import { areaHealthCategoryLabel } from '../../knowledgeLabels';
import type { AreaGuidanceItem, SuggestedAreaAssignment } from './actionEngine';
import { ActionButton, ActionCard } from './actionUi';

const REC_KEYS = {
  'create-hub': 'k37GuideCreateHub',
  'add-milestones': 'k37GuideAddMilestones',
  'connect-isolated': 'k37GuideConnectIsolated',
} as const;

export interface AreaGuidanceProps {
  colors: NoteChromeColors;
  guidance: AreaGuidanceItem | null;
  suggestedArea: SuggestedAreaAssignment | null;
  onAssignArea: (areaLabel: string, areaNoteId?: string) => void;
}

export function AreaGuidance({
  colors: c,
  guidance,
  suggestedArea,
  onAssignArea,
}: AreaGuidanceProps) {
  const { t, lang } = useTranslation();

  if (!guidance && !suggestedArea) return null;

  return (
    <div style={{ paddingBottom: 6 }}>
      {guidance && (
        <div style={{ margin: '0 8px 8px', padding: '8px 10px', borderRadius: 7, border: `1px solid ${c.sideBdr}`, background: c.cardHov }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{guidance.label}</div>
          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3 }}>
            {t('k37AreaHealthLine')
              .replace('{score}', String(guidance.score))
              .replace('{category}', areaHealthCategoryLabel(guidance.category, lang))}
          </div>
          {guidance.recommendations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: c.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>
                {t('k37Recommendations')}
              </div>
              <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, color: c.textMuted, lineHeight: 1.5 }}>
                {guidance.recommendations.map(rec => (
                  <li key={rec}>{t(REC_KEYS[rec])}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {suggestedArea && (
        <ActionCard
          c={c}
          title={t('k37SuggestedArea')}
          description={t('k37SuggestedAreaDetail')
            .replace('{label}', suggestedArea.label)
            .replace('{confidence}', String(suggestedArea.confidence))}
          actions={(
            <ActionButton
              c={c}
              onClick={() => onAssignArea(suggestedArea.label, suggestedArea.areaNoteId)}
            >
              {t('k37ActionAssign')}
            </ActionButton>
          )}
        />
      )}

    </div>
  );
}
