import { ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../lib/i18n';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBreadcrumbSegment } from '../../../lib/noteBreadcrumb';

export interface NoteBreadcrumbBarProps {
  colors: NoteChromeColors;
  segments: readonly NoteBreadcrumbSegment[];
  noteTitle?: string;
}

export function NoteBreadcrumbBar({ colors: c, segments, noteTitle }: NoteBreadcrumbBarProps) {
  const { t } = useTranslation();
  if (segments.length === 0 && !noteTitle) return null;

  const labels = [
    ...segments.map(seg => (seg.type === 'key' ? t(seg.key) : seg.label)),
    ...(noteTitle ? [noteTitle] : []),
  ];

  return (
    <nav
      aria-label={t('nvBreadcrumb')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        padding: '4px 10px 6px',
        borderBottom: `1px solid ${c.sideBdr}`,
        background: c.editor,
        fontSize: 10,
        color: c.textMuted,
        flexShrink: 0,
      }}
      data-note-breadcrumb
    >
      {labels.map((label, i) => (
        <span key={`${label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {i > 0 && <ChevronRight size={10} style={{ flexShrink: 0, opacity: 0.5 }} />}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: i === labels.length - 1 ? 220 : 140,
              fontWeight: i === labels.length - 1 ? 600 : 500,
              color: i === labels.length - 1 ? c.text : c.textMuted,
            }}
          >
            {label}
          </span>
        </span>
      ))}
    </nav>
  );
}
