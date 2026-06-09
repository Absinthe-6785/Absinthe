import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { GraphData, GraphRelationshipType } from './graphModels';

const MIN_K = 0.5;
const MAX_K = 3;
const ZOOM_STEP = 0.12;
const NODE_RADIUS = 22;
const CENTER_RADIUS = 28;

interface LayoutNode {
  noteId: string;
  title: string;
  type: 'current' | 'connected';
  x: number;
  y: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface LocalGraphViewProps {
  colors: NoteChromeColors;
  graphData: GraphData;
  onNavigate: (noteId: string) => void;
}

function computeRadialLayout(
  graphData: GraphData,
  width: number,
  height: number,
): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const connected = graphData.nodes.filter(n => n.type === 'connected');
  const radius = Math.max(70, Math.min(width, height) * 0.32);

  const layout: LayoutNode[] = graphData.nodes.map(node => {
    if (node.type === 'current') {
      return { ...node, x: cx, y: cy };
    }
    return { ...node, x: cx, y: cy };
  });

  connected.forEach((node, index) => {
    const angle = connected.length === 1
      ? -Math.PI / 2
      : (index / connected.length) * Math.PI * 2 - Math.PI / 2;
    const entry = layout.find(n => n.noteId === node.noteId);
    if (!entry) return;
    entry.x = cx + Math.cos(angle) * radius;
    entry.y = cy + Math.sin(angle) * radius;
  });

  return layout;
}

function edgeStroke(type: GraphRelationshipType, accent: string, muted: string): string {
  switch (type) {
    case 'mutual-backlink':
      return accent;
    case 'backlink':
      return accent;
    case 'mention':
      return muted;
    case 'shared-tag':
      return muted;
    default:
      return muted;
  }
}

function truncateTitle(title: string, max = 14): string {
  const trimmed = title.trim() || 'Untitled';
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export function LocalGraphView({ colors: c, graphData, onNavigate }: LocalGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 180, h: 220 });
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ w: width, h: height });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTransform({ x: 0, y: 0, k: 1 });
  }, [graphData.centerNoteId]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      setTransform(t => {
        const newK = Math.max(MIN_K, Math.min(MAX_K, t.k * delta));
        const scale = newK / t.k;
        return { k: newK, x: mx - scale * (mx - t.x), y: my - scale * (my - t.y) };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setTransform(t => ({
        ...t,
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      }));
    };
    const onUp = () => setPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  const layoutNodes = useMemo(
    () => computeRadialLayout(graphData, size.w, size.h),
    [graphData, size.w, size.h],
  );

  const layoutById = useMemo(
    () => new Map(layoutNodes.map(node => [node.noteId, node])),
    [layoutNodes],
  );

  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y };
    e.preventDefault();
  }, [transform.x, transform.y]);

  const isEmpty = graphData.nodes.length <= 1;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
        background: c.sidebar,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          borderBottom: `1px solid ${c.sideBdr}`,
          fontSize: 10,
          color: c.textMuted,
        }}
      >
        <span>Local graph · {Math.max(0, graphData.nodes.length - 1)} connected</span>
        <button
          type="button"
          onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
          style={{
            background: 'none',
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 4,
            color: c.textMuted,
            fontSize: 9,
            padding: '2px 6px',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>

      {isEmpty ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '24px 8px' }}>
          No connected notes yet
        </p>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ flex: 1, cursor: panning ? 'grabbing' : 'grab', display: 'block' }}
          onMouseDown={onSvgMouseDown}
        >
          <rect width={size.w} height={size.h} fill="transparent" />
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
            {graphData.edges.map(edge => {
              const source = layoutById.get(edge.sourceId);
              const target = layoutById.get(edge.targetId);
              if (!source || !target) return null;
              return (
                <line
                  key={`${edge.sourceId}-${edge.targetId}-${edge.relationshipType}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={edgeStroke(edge.relationshipType, c.accent, c.textFaint)}
                  strokeWidth={edge.relationshipType === 'mutual-backlink' ? 2.5 : 1.5}
                  strokeOpacity={0.85}
                  markerEnd="url(#local-graph-arrow)"
                />
              );
            })}

            <defs>
              <marker
                id="local-graph-arrow"
                viewBox="0 0 10 10"
                refX={8}
                refY={5}
                markerWidth={5}
                markerHeight={5}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c.textFaint} />
              </marker>
            </defs>

            {layoutNodes.map(node => {
              const isCenter = node.type === 'current';
              const radius = isCenter ? CENTER_RADIUS : NODE_RADIUS;
              return (
                <g
                  key={node.noteId}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: isCenter ? 'default' : 'pointer' }}
                  onClick={e => {
                    e.stopPropagation();
                    if (!isCenter) onNavigate(node.noteId);
                  }}
                >
                  <circle
                    r={radius}
                    fill={isCenter ? c.accentBg : c.cardHov}
                    stroke={isCenter ? c.accent : c.sideBdr}
                    strokeWidth={isCenter ? 2.5 : 1.5}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isCenter ? c.accent : c.text}
                    fontSize={isCenter ? 10 : 9}
                    fontWeight={isCenter ? 700 : 600}
                    pointerEvents="none"
                  >
                    {truncateTitle(node.title)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
