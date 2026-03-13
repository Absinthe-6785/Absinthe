/**
 * NoteGraphView.tsx — 노트 간 연결 관계를 Force-Directed 그래프로 시각화
 *
 * NoteView에서 분리된 독립 컴포넌트.
 * - 노드 드래그, 호버, 클릭 지원
 * - ResizeObserver로 컨테이너 크기 자동 감지
 * - 엣지 탐색: Map 기반 O(1) 조회
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { extractLinks } from './noteUtils';
import type { NoteBase as Note } from './noteUtils';

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  links: number;
  starred?: boolean;
}

interface GraphEdge { from: string; to: string; }

interface NoteGraphViewProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelect: (id: string) => void;
  dark: boolean;
}

export function NoteGraphView({ notes, activeNoteId, onSelect, dark }: NoteGraphViewProps) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const frameRef   = useRef<number>(0);
  const [size, setSize]       = useState({ w: 600, h: 400 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // nodes/edges를 ref로 관리 — 애니메이션 루프에서 직접 변경
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [tick, setTick] = useState(0); // 렌더 트리거

  // 컨테이너 크기 감지
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = useMemo(() => notes.filter(n => !n.deletedAt), [notes]);
  const visibleKey = visible.map(n => n.id).join();

  // 노트가 바뀌면 그래프 재초기화 (기존 위치 보존)
  useEffect(() => {
    const titleToId: Record<string, string> = {};
    visible.forEach(n => { titleToId[n.title] = n.id; });

    const linkCount: Record<string, number> = {};
    const edgeSet = new Set<string>();
    const edgeList: GraphEdge[] = [];

    visible.forEach(n => {
      extractLinks(n.body).forEach(title => {
        const toId = titleToId[title];
        if (!toId) return;
        const key = [n.id, toId].sort().join('|');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edgeList.push({ from: n.id, to: toId });
        }
        linkCount[n.id] = (linkCount[n.id] || 0) + 1;
        linkCount[toId] = (linkCount[toId] || 0) + 1;
      });
    });
    edgesRef.current = edgeList;

    const existing = Object.fromEntries(nodesRef.current.map(n => [n.id, n]));
    const cx = size.w / 2, cy = size.h / 2;
    nodesRef.current = visible.map(n => existing[n.id] ?? {
      id: n.id, title: n.title,
      x: cx + (Math.random() - 0.5) * 300,
      y: cy + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0, links: 0,
    });
    // 카운트 및 제목 최신화
    nodesRef.current.forEach(nd => {
      nd.links = linkCount[nd.id] || 0;
      nd.title = visible.find(n => n.id === nd.id)?.title ?? nd.title;
      nd.starred = visible.find(n => n.id === nd.id)?.starred;
    });
  }, [visibleKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Force-directed 애니메이션 루프
  useEffect(() => {
    let alpha = 1.0;
    const REPEL = 3000, ATTRACT = 0.05, CENTER = 0.008, DAMPING = 0.85, LINK_DIST = 130;

    const step = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (ns.length === 0 || alpha < 0.005) { setTick(t => t + 1); return; }

      alpha *= 0.97;

      // 반발력 (모든 노드 쌍)
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y;
          const dist2 = dx * dx + dy * dy + 1;
          const force = REPEL / dist2;
          const fx = force * dx / Math.sqrt(dist2), fy = force * dy / Math.sqrt(dist2);
          ns[i].vx -= fx; ns[i].vy -= fy;
          ns[j].vx += fx; ns[j].vy += fy;
        }
      }

      // 인력 (엣지) — Map으로 O(1) 조회
      const nodeMap = new Map(ns.map(n => [n.id, n]));
      es.forEach(e => {
        const a = nodeMap.get(e.from), b = nodeMap.get(e.to);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - LINK_DIST) * ATTRACT;
        const fx = force * dx / dist, fy = force * dy / dist;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });

      // 중심 인력
      const cx = size.w / 2, cy = size.h / 2;
      ns.forEach(n => {
        n.vx += (cx - n.x) * CENTER;
        n.vy += (cy - n.y) * CENTER;
      });

      // 적분 (드래그 중인 노드 제외)
      ns.forEach(n => {
        if (n.id === dragging) return;
        n.vx *= DAMPING; n.vy *= DAMPING;
        n.x  += n.vx * alpha;
        n.y  += n.vy * alpha;
        n.x = Math.max(30, Math.min(size.w - 30, n.x));
        n.y = Math.max(30, Math.min(size.h - 30, n.y));
      });

      setTick(t => t + 1);
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [visibleKey, size.w, size.h, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // 드래그 핸들러
  const onMouseDown = (e: React.MouseEvent, id: string) => {
    const nd = nodesRef.current.find(n => n.id === id);
    if (!nd) return;
    dragOffset.current = { dx: e.clientX - nd.x, dy: e.clientY - nd.y };
    setDragging(id);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const nd = nodesRef.current.find(n => n.id === dragging);
      if (!nd) return;
      nd.x = e.clientX - dragOffset.current.dx;
      nd.y = e.clientY - dragOffset.current.dy;
      nd.vx = 0; nd.vy = 0;
      setTick(t => t + 1);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // 색상 — tick 의존 없이 dark만으로 결정
  const colors = useMemo(() => ({
    bg:    dark ? '#18181A' : '#F8F9FA',
    edge:  dark ? '#6B7280' : '#9CA3AF',
    node:  dark ? '#2C2C2E' : '#FFFFFF',
    nodeB: dark ? '#4B5563' : '#E5E7EB',
    txt:   dark ? '#E5E7EB' : '#374151',
    act:   dark ? '#FACC15' : '#2563EB',
    hovBg: dark ? '#FACC1425' : '#DBEAFE',
  }), [dark]);

  const ns = nodesRef.current;
  const es = edgesRef.current;
  // SVG 렌더용 Map (매 tick마다 생성되지만 ns가 ref라 부담 없음)
  const renderMap = new Map(ns.map(n => [n.id, n]));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: colors.bg }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <marker id="garr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={colors.edge}/>
          </marker>
        </defs>

        {/* 엣지 */}
        {es.map((e, i) => {
          const a = renderMap.get(e.from), b = renderMap.get(e.to);
          if (!a || !b) return null;
          const isAct = e.from === activeNoteId || e.to === activeNoteId;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isAct ? colors.act : colors.edge}
              strokeWidth={isAct ? 1.5 : 1}
              strokeOpacity={isAct ? 0.9 : 0.45}
              markerEnd="url(#garr)"
            />
          );
        })}

        {/* 노드 */}
        {ns.map(node => {
          const r     = 7 + Math.min(node.links * 2, 10);
          const isAct = node.id === activeNoteId;
          const isHov = node.id === hovered;
          const label = node.title.length > 16 ? node.title.slice(0, 15) + '…' : node.title;
          return (
            <g key={node.id} style={{ cursor: 'pointer' }}
              onClick={() => onSelect(node.id)}
              onMouseDown={e => onMouseDown(e, node.id)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHov && <circle cx={node.x} cy={node.y} r={r + 6} fill={colors.hovBg}/>}
              <circle cx={node.x} cy={node.y} r={r}
                fill={isAct ? colors.act : colors.node}
                stroke={isAct || isHov ? colors.act : colors.nodeB}
                strokeWidth={1.5}
              />
              {node.starred && (
                <text x={node.x + r - 2} y={node.y - r + 4}
                  fontSize="9" textAnchor="middle"
                  style={{ pointerEvents: 'none' }}>★</text>
              )}
              <text x={node.x} y={node.y + r + 14}
                textAnchor="middle" fontSize="10"
                fill={isAct ? colors.act : colors.txt}
                fontWeight={isAct ? '700' : '400'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: dark ? '#444' : '#9CA3AF' }}>
        {ns.length} notes · {es.length} links · drag nodes to reposition
      </div>

      {activeNoteId && (
        <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 10, color: colors.act, fontWeight: 600 }}>
          {renderMap.get(activeNoteId)?.title}
        </div>
      )}
    </div>
  );
}
