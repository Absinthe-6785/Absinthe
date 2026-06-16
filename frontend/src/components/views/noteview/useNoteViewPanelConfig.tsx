import { useMemo } from 'react';
import {
  Eye, Orbit, AlignLeft, Link, Lightbulb, Zap, Compass, History,
  SlidersHorizontal, Tag, ArrowRightLeft,
} from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';

export function useNoteViewPanelConfig() {
  const { t } = useTranslation();

  const viewModes = useMemo(() => [
    { key: 'reading' as const, icon: <Eye size={12}/>,     label: t('nvReading') },
    { key: 'graph'   as const, icon: <Orbit size={12}/>, label: t('nvGraph') },
  ], [t]);

  const rightPanels = useMemo(() => [
    { key: 'toc'        as const, label: t('nvPanelToc'), icon: <AlignLeft size={12}/> },
    { key: 'links'      as const, label: t('nvPanelLinks'),   icon: <Link size={12}/> },
    { key: 'graph'      as const, label: t('nvGraph'),   icon: <Orbit size={12}/> },
    { key: 'discover'   as const, label: t('k38PanelDiscover'), icon: <Compass size={12}/> },
    { key: 'properties' as const, label: t('nvPanelProperties'),   icon: <SlidersHorizontal size={12}/> },
    { key: 'insights'   as const, label: t('k36PanelInsights'), icon: <Lightbulb size={12}/> },
    { key: 'actions'    as const, label: t('k37PanelActions'), icon: <Zap size={12}/> },
    { key: 'timeline'   as const, label: t('k42PanelTimeline'), hint: t('k43KnowledgeTimelineLabel'), icon: <History size={12}/> },
    { key: 'tags'       as const, label: t('nvPanelTags'), hint: t('k90a2TagsTabHint'), icon: <Tag size={12}/> },
    { key: 'relations'  as const, label: t('nvPanelRelations'), icon: <ArrowRightLeft size={12}/> },
    { key: 'stats'      as const, label: t('nvPanelStats'),   icon: <span style={{ fontSize: 11, fontWeight: 700 }}>#</span> },
  ], [t]);

  return { viewModes, rightPanels };
}
