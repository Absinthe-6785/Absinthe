import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { GraphData, GraphNode, GraphRelationshipType, LocalGraphRelationshipFilter } from './graphModels';

const MIN_K = 0.5;
const MAX_K = 3;
const ZOOM_STEP = 0.12;
const NODE_RADIUS = 22;
const CENTER_RADIUS = 28;

interface LayoutNode {
  noteId: string;
  title: string;
  type: 'current' | 'connected';
  hop?: number;
  expanded?: boolean;
  expandable?: boolean;
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
  onExpandNode?: (noteId: string) => void;
  onCollapseNode?: (noteId: string) => void;
}

function computeRadialLayout(
  graphData: GraphData,
  width: number,
  height: number,
): LayoutNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.max(70, Math.min(width, height) * 0.38);

  const groups = new Map<number, GraphNode[]>();
  for (const node of graphData.nodes) {
    const hop = node.hop ?? (node.type === 'current' ? 0 : 1);
    const bucket = groups.get(hop) ?? [];
    bucket.push(node);
    groups.set(hop, bucket);
  }

  const hops = [...groups.keys()].sort((a, b) => a - b);
  const hopCount = hops.length;

  const layout: LayoutNode[] = graphData.nodes.map(node => ({
    noteId: node.noteId,
    title: node.title,
    type: node.type,
    hop: node.hop,
    expanded: node.expanded,
    expandable: node.expandable,
    x: cx,
    y: cy,
  }));

  hops.forEach((hop, hopIndex) => {
    const ringNodes = groups.get(hop) ?? [];
    const radius = hop === 0
      ? 0
      : (maxRadius * hopIndex) / Math.max(hopCount - 1, 1);

    ringNodes.forEach((node, index) => {
      const entry = layout.find(item => item.noteId === node.noteId);
      if (!entry) return;
      if (hop === 0) {
        entry.x = cx;
        entry.y = cy;
        return;
      }
      const angle = ringNodes.length === 1
        ? -Math.PI / 2
        : (index / ringNodes.length) * Math.PI * 2 - Math.PI / 2;
      entry.x = cx + Math.cos(angle) * radius;
      entry.y = cy + Math.sin(angle) * radius;
    });
  });

  return layout;
}

function edgeMatchesFilter(type: GraphRelationshipType, filter: LocalGraphRelationshipFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'backlinks') return type === 'backlink' || type === 'mutual-backlink';
  if (filter === 'mentions') return type === 'mention';
  if (filter === 'relations') return type === 'relation';
  return true;
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
    case 'relation':
      return '#10B981';
    default:
      return muted;
  }
}

function edgeDash(type: GraphRelationshipType): string | undefined {
  return type === 'relation' ? '4 3' : undefined;
}

function truncateTitle(title: string, max = 14): string {
  const trimmed = displayNoteTitle(title);
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export function LocalGraphView({
  colors: c,
  graphData,
  onNavigate,
  onExpandNode,
  onCollapseNode,
}: LocalGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<LocalGraphRelationshipFilter>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
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
    setSelectedNodeId(graphData.centerNoteId);
  }, [graphData.centerNoteId]);

  useEffect(() => {
    if (selectedNodeId && !graphData.nodes.some(n => n.noteId === selectedNodeId)) {
      setSelectedNodeId(graphData.centerNoteId);
    }
  }, [graphData.nodes, graphData.centerNoteId, selectedNodeId]);

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
  const connectedCount = Math.max(0, graphData.nodes.length - 1);
  const scopeLabel = graphData.scope === 'expanded' ? 'Expanded graph' : 'Local graph';
  const visibleEdges = useMemo(
    () => graphData.edges.filter(edge => edgeMatchesFilter(edge.relationshipType, relationshipFilter)),
    [graphData.edges, relationshipFilter],
  );

  const selectedNode = selectedNodeId
    ? graphData.nodes.find(n => n.noteId === selectedNodeId) ?? null
    : null;
  const hoveredNode = hoveredNodeId
    ? graphData.nodes.find(n => n.noteId === hoveredNodeId) ?? null
    : null;
  const selectedEdgeCount = selectedNodeId
    ? visibleEdges.filter(e => e.sourceId === selectedNodeId || e.targetId === selectedNodeId).length
    : 0;

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
          gap: 6,
        }}
      >
        <span style={{ flex: 1 }}>
          {scopeLabel} · {connectedCount} connected
          {graphData.meta?.limitReached && (
            <span style={{ color: c.danger }}> · limit reached</span>
          )}
        </span>
        <select
          value={relationshipFilter}
          onChange={e => setRelationshipFilter(e.target.value as LocalGraphRelationshipFilter)}
          style={{
            background: c.input,
            border: `1px solid ${c.inputBdr}`,
            borderRadius: 4,
            color: c.textMuted,
            fontSize: 9,
            padding: '2px 4px',
          }}
        >
          <option value="all">All</option>
          <option value="backlinks">Backlinks</option>
          <option value="mentions">Mentions</option>
          <option value="relations">Relations</option>
        </select>
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

      {(hoveredNode || selectedNode) && (
        <div
          style={{
            padding: '5px 8px',
            borderBottom: `1px solid ${c.sideBdr}`,
            fontSize: 10,
            color: c.textMuted,
            background: c.cardHov,
            minHeight: 28,
          }}
        >
          {selectedNode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.text, fontWeight: 600 }}>
                {displayNoteTitle(selectedNode.title)}
              </span>
              {selectedNode.type !== 'current' && (
                <button
                  type="button"
                  onClick={() => onNavigate(selectedNode.noteId)}
                  style={{
                    background: c.accent,
                    border: 'none',
                    borderRadius: 4,
                    color: c.sidebar,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 7px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  열기
                </button>
              )}
              <span style={{ fontSize: 9, color: c.textFaint, flexShrink: 0 }}>
                {selectedEdgeCount} 연결
              </span>
            </div>
          )}
          {hoveredNode && hoveredNode.noteId !== selectedNode?.noteId && (
            <div style={{ marginTop: selectedNode ? 3 : 0, color: c.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              미리보기: {displayNoteTitle(hoveredNode.title)}
            </div>
          )}
        </div>
      )}

      {isEmpty ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '24px 8px' }}>
          연결된 노트 없음
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
            {visibleEdges.map(edge => {
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
                  strokeWidth={edge.relationshipType === 'mutual-backlink' ? 2.5 : edge.relationshipType === 'relation' ? 2 : 1.5}
                  strokeOpacity={0.85}
                  strokeDasharray={edgeDash(edge.relationshipType)}
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
              const isSelected = node.noteId === selectedNodeId;
              const isHovered = node.noteId === hoveredNodeId;
              const radius = isCenter ? CENTER_RADIUS : NODE_RADIUS;
              const canExpand = !isCenter && node.expandable && !node.expanded && onExpandNode;
              const canCollapse = !isCenter && node.expanded && onCollapseNode;

              return (
                <g key={node.noteId} transform={`translate(${node.x}, ${node.y})`}>
                  {node.expanded && (
                    <circle
                      r={radius + 5}
                      fill="none"
                      stroke={c.accent}
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      opacity={0.8}
                    />
                  )}

                  {isSelected && !isCenter && (
                    <circle
                      r={radius + 3}
                      fill="none"
                      stroke={c.accent}
                      strokeWidth={2}
                      opacity={0.9}
                    />
                  )}

                  <g
                    style={{ cursor: isCenter ? 'default' : 'pointer' }}
                    onMouseEnter={() => setHoveredNodeId(node.noteId)}
                    onMouseLeave={() => setHoveredNodeId(prev => (prev === node.noteId ? null : prev))}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedNodeId(node.noteId);
                    }}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      if (!isCenter) onNavigate(node.noteId);
                    }}
                  >
                    <circle
                      r={radius}
                      fill={isCenter ? c.accentBg : isHovered ? c.cardAct : c.cardHov}
                      stroke={isCenter ? c.accent : isSelected ? c.accent : c.sideBdr}
                      strokeWidth={isCenter ? 2.5 : isSelected ? 2 : 1.5}
                    />
                    <title>{displayNoteTitle(node.title)}</title>
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

                  {canExpand && (
                    <g
                      transform={`translate(${radius - 2}, ${-radius + 2})`}
                      style={{ cursor: 'pointer' }}
                      onClick={e => {
                        e.stopPropagation();
                        onExpandNode?.(node.noteId);
                      }}
                    >
                      <circle r={7} fill={c.accent} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={c.sidebar}
                        fontSize={10}
                        fontWeight={700}
                        pointerEvents="none"
                      >
                        +
                      </text>
                    </g>
                  )}

                  {canCollapse && (
                    <g
                      transform={`translate(${radius - 2}, ${-radius + 2})`}
                      style={{ cursor: 'pointer' }}
                      onClick={e => {
                        e.stopPropagation();
                        onCollapseNode?.(node.noteId);
                      }}
                    >
                      <circle r={7} fill={c.textMuted} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={c.sidebar}
                        fontSize={10}
                        fontWeight={700}
                        pointerEvents="none"
                      >
                        −
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
