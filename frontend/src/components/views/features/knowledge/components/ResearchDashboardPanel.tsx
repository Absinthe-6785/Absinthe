import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ResearchDashboardData, ResearchNoteEntry } from '../research/buildResearchDashboard';
import { useViewportLayout } from '../../../../hooks/useViewportLayout';
import { responsiveMetricGridColumns } from '../../../../lib/responsiveLayout';

export interface ResearchDashboardPanelProps {
  colors: NoteChromeColors;
  data: ResearchDashboardData;
  onNavigateToNote: (noteId: string) => void;
}

function Section({
  c,
  title,
  count,
  items,
  onNavigate,
}: {
  c: NoteChromeColors;
  title: string;
  count?: number;
  items: readonly ResearchNoteEntry[];
  onNavigate: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {count !== undefined && count > 0 && (
          <span style={{ color: c.accent, marginLeft: 4 }}>({count})</span>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>없음</div>
      ) : (
        items.map(item => (
          <button
            key={`${title}-${item.noteId}`}
            type="button"
            onClick={() => onNavigate(item.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '5px 8px',
              marginBottom: 3,
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.noteTitle}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}

function PipelineOverview({ c, data, isMobile }: { c: NoteChromeColors; data: ResearchDashboardData['sourcePipeline']; isMobile: boolean }) {
  const total = data.source + data.literature + data.permanent + data.unclassified;
  const rows = [
    { label: '출처', count: data.source, color: c.accent },
    { label: '문헌', count: data.literature, color: c.text },
    { label: '영구', count: data.permanent, color: c.green },
    { label: '미분류', count: data.unclassified, color: c.textFaint },
  ];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
        출처 파이프라인
        {total > 0 && <span style={{ color: c.accent, marginLeft: 4 }}>({total})</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: responsiveMetricGridColumns(isMobile), gap: 4 }}>
        {rows.map(row => (
          <div
            key={row.label}
            style={{
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '6px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.count}</div>
            <div style={{ fontSize: 9, color: c.textMuted }}>{row.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Informational research dashboard — no AI, no external APIs. */
export function ResearchDashboardPanel({ colors: c, data, onNavigateToNote }: ResearchDashboardPanelProps) {
  const { isMobile } = useViewportLayout();
  return (
    <div className="be-research-dashboard" aria-label="연구 대시보드" style={{ overflowX: 'hidden' }}>
      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 8 }}>
        인용 {data.citationCount}건 · vault 기준
      </div>
      <PipelineOverview c={c} data={data.sourcePipeline} isMobile={isMobile} />
      <Section c={c} title="인용 활동" count={data.citationActivity.length} items={data.citationActivity} onNavigate={onNavigateToNote} />
      <Section c={c} title="승격 활동" count={data.promotionActivity.length} items={data.promotionActivity} onNavigate={onNavigateToNote} />
      <Section c={c} title="최근 출처" items={data.recentSources} onNavigate={onNavigateToNote} />
      <Section c={c} title="읽기 노트" items={data.readingNotes} onNavigate={onNavigateToNote} />
      <Section c={c} title="문헌 노트" items={data.literatureNotes} onNavigate={onNavigateToNote} />
      <Section c={c} title="영구 노트" items={data.permanentNotes} onNavigate={onNavigateToNote} />
    </div>
  );
}
