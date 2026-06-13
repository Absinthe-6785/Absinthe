/**
 * NoteGraphView.tsx — 노트 간 연결 관계를 Force-Directed 그래프로 시각화
 *
 * v2 고도화 항목:
 * - 줌/팬: SVG viewBox transform + 휠 줌 + 중간버튼/빈공간 드래그 팬
 * - 고립 노드 필터: 링크 없는 노드 토글 숨김
 * - 폴더별 노드 색상: folderId 기반 색상 팔레트 (최대 12색)
 * - 노드 내 검색: 검색창 + 매칭 노드 강조 + 비매칭 노드 흐리기
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { buildGlobalGraphData, knowledgeIndexService } from './features/knowledge';
import type { GlobalGraphRelationshipFilter, GraphRelationshipType } from './features/knowledge';
import type { NoteBase as Note } from './noteUtils';
import {
  graphRepulsionStrength,
  graphSimulationAlphaFloor,
  shouldShowGraphNodeLabel,
} from './graphScalePolicy';

// ── 타입 ─────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  title: string;
  folderId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  links: number;
  starred?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  relationshipType: GraphRelationshipType;
}

interface Transform { x: number; y: number; k: number; }

export interface NoteFolderForGraph {
  id: string;
  name: string;
}

export interface NoteGraphViewProps {
  notes: Note[];
  folders?: NoteFolderForGraph[];  // 폴더 이름 표시용 (없으면 '폴더 N' fallback)
  activeNoteId: string | null;
  onSelect: (id: string) => void;
  dark: boolean;
}

// ── 폴더 색상 팔레트 (라이트/다크 공용 — opacity로 조절) ───────────
const FOLDER_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#E11D48', // rose
];

function getFolderColor(folderId: string | null, folderIds: string[]): string | null {
  if (!folderId) return null;
  const idx = folderIds.indexOf(folderId);
  if (idx < 0) return null;
  return FOLDER_PALETTE[idx % FOLDER_PALETTE.length];
}

// ── 줌 상수 ──────────────────────────────────────────────────────────
const MIN_K = 0.2;
const MAX_K = 4.0;
const ZOOM_STEP = 0.12;

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export function NoteGraphView({ notes, folders = [], activeNoteId, onSelect, dark }: NoteGraphViewProps) {
  const svgRef   = useRef<SVGSVGElement>(null);
  const frameRef = useRef<number>(0);

  const [size, setSize]         = useState({ w: 600, h: 400 });
  const [hovered, setHovered]   = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);  // node drag
  const [panning, setPanning]   = useState(false);                // canvas pan
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [showIsolated, setShowIsolated] = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState<GlobalGraphRelationshipFilter>('all');

  const dragOffset = useRef({ dx: 0, dy: 0 });
  const panStart   = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });

  // nodes/edges를 ref로 관리 — 애니메이션 루프에서 직접 변경
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [tick, setTick] = useState(0);

  // ── 컨테이너 크기 감지 ────────────────────────────────────────────
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

  const safeNotes = Array.isArray(notes) ? notes : [];
  const visible = useMemo(() => safeNotes.filter(n => !n.deletedAt), [safeNotes]);
  // updatedAt 포함 — body/제목 변경 시에도 그래프 재계산
  const visibleKey = visible.map(n => `${n.id}:${n.updatedAt}`).join(',');

  // 폴더 ID 목록 (색상 인덱스용 — 안정 순서)
  const folderIds = useMemo(() => {
    const ids = [...new Set(visible.map(n => n.folderId).filter(Boolean) as string[])].sort();
    return ids;
  }, [visible]);

  const noteById = useMemo(
    () => new Map(visible.map(note => [note.id, note])),
    [visible],
  );

  const graphData = useMemo(
    () => buildGlobalGraphData({
      service: knowledgeIndexService,
      options: { relationshipFilter },
    }),
    [visibleKey, relationshipFilter],
  );

  // ── 그래프 초기화 ─────────────────────────────────────────────────
  useEffect(() => {
    const edgeSet = new Set<string>();
    const edgeList: GraphEdge[] = [];

    graphData.edges.forEach(edge => {
      const key = [edge.sourceId, edge.targetId, edge.relationshipType].join('|');
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      edgeList.push({
        from: edge.sourceId,
        to: edge.targetId,
        relationshipType: edge.relationshipType,
      });
    });
    edgesRef.current = edgeList;

    const degreeById = new Map(graphData.nodes.map(node => [node.noteId, node.degree ?? 0]));
    const existing = Object.fromEntries(nodesRef.current.map(n => [n.id, n]));
    const cx = size.w / 2, cy = size.h / 2;

    nodesRef.current = graphData.nodes.map(node => {
      const note = noteById.get(node.noteId);
      const prior = existing[node.noteId];
      return prior ?? {
        id: node.noteId,
        title: node.title,
        folderId: note?.folderId ?? null,
        x: cx + (Math.random() - 0.5) * 300,
        y: cy + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
        links: 0,
      };
    });

    nodesRef.current.forEach(nd => {
      const note = noteById.get(nd.id);
      nd.links = degreeById.get(nd.id) ?? 0;
      nd.title = note?.title ?? nd.title;
      nd.starred = note?.starred ?? false;
      nd.folderId = note?.folderId ?? null;
    });
  }, [graphData, noteById, size.w, size.h]);

  // ── Force-directed 루프 ───────────────────────────────────────────
  useEffect(() => {
    let alpha = 1.0;
    const nodeCount = nodesRef.current.length;
    const REPEL = graphRepulsionStrength(nodeCount);
    const alphaFloor = graphSimulationAlphaFloor(nodeCount);
    const ATTRACT = 0.05, CENTER = 0.008, DAMPING = 0.85, LINK_DIST = 130;

    const step = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (ns.length === 0 || alpha < alphaFloor) { setTick(t => t + 1); return; }

      alpha *= 0.97;

      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y;
          const dist2 = dx * dx + dy * dy + 1;
          const force = REPEL / dist2;
          const d = Math.sqrt(dist2);
          const fx = force * dx / d, fy = force * dy / d;
          ns[i].vx -= fx; ns[i].vy -= fy;
          ns[j].vx += fx; ns[j].vy += fy;
        }
      }

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

      const cx = size.w / 2, cy = size.h / 2;
      ns.forEach(n => {
        n.vx += (cx - n.x) * CENTER;
        n.vy += (cy - n.y) * CENTER;
      });

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
  }, [visibleKey, size.w, size.h, dragging, relationshipFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SVG 좌표 변환 헬퍼 (클라이언트 → 그래프 공간) ──────────────
  const clientToGraph = useCallback((cx: number, cy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { gx: cx, gy: cy };
    const svgX = cx - rect.left;
    const svgY = cy - rect.top;
    return {
      gx: (svgX - transform.x) / transform.k,
      gy: (svgY - transform.y) / transform.k,
    };
  }, [transform]);

  // ── 노드 드래그 ───────────────────────────────────────────────────
  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const nd = nodesRef.current.find(n => n.id === id);
    if (!nd) return;
    const { gx, gy } = clientToGraph(e.clientX, e.clientY);
    dragOffset.current = { dx: gx - nd.x, dy: gy - nd.y };
    setDragging(id);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const nd = nodesRef.current.find(n => n.id === dragging);
      if (!nd) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;
      nd.x = (svgX - transform.x) / transform.k - dragOffset.current.dx;
      nd.y = (svgY - transform.y) / transform.k - dragOffset.current.dy;
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
  }, [dragging, transform]);

  // ── 캔버스 팬 ─────────────────────────────────────────────────────
  const onSvgMouseDown = (e: React.MouseEvent) => {
    // 빈 배경 클릭이거나 중간 버튼
    if (e.button === 1 || e.button === 0) {
      setPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y };
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStart.current.mx;
      const dy = e.clientY - panStart.current.my;
      setTransform(t => ({ ...t, x: panStart.current.tx + dx, y: panStart.current.ty + dy }));
    };
    const onUp = () => setPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  // ── 휠 줌 (passive:false 필수 — React synthetic onWheel은 Chrome에서 무시됨) ──
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 줌 리셋 ───────────────────────────────────────────────────────
  const resetZoom = () => setTransform({ x: 0, y: 0, k: 1 });

  // ── 검색 매칭 ─────────────────────────────────────────────────────
  const searchLower = searchQuery.trim().toLowerCase();
  const matchedIds = useMemo(() => {
    if (!searchLower) return null;
    return new Set(
      nodesRef.current
        .filter(n => n.title.toLowerCase().includes(searchLower))
        .map(n => n.id)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLower, tick]);

  // ── 색상 팔레트 ────────────────────────────────────────────────────
  const colors = useMemo(() => ({
    bg:       dark ? '#0E0E10' : '#F5F0E8',
    edge:     dark ? '#52525B' : '#A8A29E',
    node:     dark ? '#1B1B1F' : '#FAF7F2',
    nodeB:    dark ? '#2E2E33' : '#E7E0D5',
    txt:      dark ? '#F4F4F5' : '#1C1917',
    act:      '#8B5CF6',
    hovBg:    dark ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.10)',
    toolbar:  dark ? '#1B1B1FEE' : '#FAF7F2EE',
    toolbarB: dark ? '#2E2E33' : '#E7E0D5',
    toolTxt:  dark ? '#A1A1AA' : '#78716C',
    searchBg: dark ? '#252529' : '#FAF7F2',
    searchB:  dark ? '#3F3F46' : '#E7E0D5',
    searchTxt:dark ? '#F4F4F5' : '#1C1917',
    dimEdge:  dark ? '#3F3F46' : '#D6D0C4',
    dimNode:  dark ? '#16161A' : '#EDE8DF',
    dimTxt:   dark ? '#71717A' : '#A8A29E',
  }), [dark]);

  // ── 렌더 데이터 준비 ──────────────────────────────────────────────
  const ns = nodesRef.current;
  const es = edgesRef.current;
  const renderMap = new Map(ns.map(n => [n.id, n]));

  // 고립 노드 필터 적용
  const visibleNodes = showIsolated ? ns : ns.filter(n => n.links > 0);
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = es.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));

  const isolatedCount = ns.filter(n => n.links === 0).length;
  const graphNodeCount = ns.length;

  const focusId = hovered ?? activeNoteId;
  const focusNeighborhood = useMemo(() => {
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    visibleEdges.forEach(edge => {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    });
    return ids;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, tick, visibleEdges.length]);

  const hoveredNode = hovered ? renderMap.get(hovered) : null;

  const transformStr = `translate(${transform.x}, ${transform.y}) scale(${transform.k})`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: colors.bg, overflow: 'hidden' }}>
      {/* ── 툴바 ────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
        pointerEvents: 'none',
      }}>
        {/* 검색 */}
        <div style={{ pointerEvents: 'all', flex: '0 0 auto' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{
              position: 'absolute', left: 7, fontSize: 11,
              color: colors.toolTxt, pointerEvents: 'none',
            }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="노드 검색…"
              style={{
                height: 28, paddingLeft: 24, paddingRight: 8,
                fontSize: 11, borderRadius: 6,
                border: `1px solid ${colors.searchB}`,
                background: colors.searchBg,
                color: colors.searchTxt,
                outline: 'none', width: 140,
                backdropFilter: 'blur(8px)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 6,
                  background: 'none', border: 'none',
                  color: colors.toolTxt, cursor: 'pointer',
                  fontSize: 12, padding: 0, lineHeight: 1,
                }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Relationship filter */}
        <select
          value={relationshipFilter}
          onChange={e => setRelationshipFilter(e.target.value as GlobalGraphRelationshipFilter)}
          style={{
            pointerEvents: 'all',
            height: 28,
            padding: '0 8px',
            fontSize: 11,
            borderRadius: 6,
            border: `1px solid ${colors.searchB}`,
            background: colors.searchBg,
            color: colors.searchTxt,
            outline: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          <option value="all">All links</option>
          <option value="backlinks">Backlinks</option>
          <option value="mentions">Mentions</option>
          <option value="relations">Relations</option>
        </select>

        {/* 고립 노드 토글 */}
        {isolatedCount > 0 && (
          <button
            onClick={() => setShowIsolated(v => !v)}
            title={showIsolated ? '고립 노드 숨기기' : '고립 노드 표시'}
            style={{
              pointerEvents: 'all',
              height: 28, padding: '0 10px',
              borderRadius: 6, fontSize: 11,
              border: `1px solid ${colors.toolbarB}`,
              background: showIsolated ? colors.toolbar : (dark ? '#374151' : '#E5E7EB'),
              color: colors.toolTxt, cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 10 }}>{showIsolated ? '◉' : '○'}</span>
            고립 {isolatedCount}
          </button>
        )}

        {/* 스페이서 */}
        <div style={{ flex: 1 }} />

        {/* 줌 컨트롤 */}
        <div style={{
          pointerEvents: 'all',
          display: 'flex', alignItems: 'center', gap: 2,
          background: colors.toolbar,
          border: `1px solid ${colors.toolbarB}`,
          borderRadius: 6, padding: '0 2px',
          backdropFilter: 'blur(8px)',
          height: 28,
        }}>
          <button onClick={() => setTransform(t => {
            const newK = Math.min(MAX_K, t.k * (1 + ZOOM_STEP));
            const mx = size.w / 2, my = size.h / 2;
            const scale = newK / t.k;
            return { k: newK, x: mx - scale * (mx - t.x), y: my - scale * (my - t.y) };
          })} style={zoomBtnStyle(colors.toolTxt)}>＋</button>
          <button onClick={resetZoom} style={{ ...zoomBtnStyle(colors.toolTxt), fontSize: 9, minWidth: 36 }}>
            {Math.round(transform.k * 100)}%
          </button>
          <button onClick={() => setTransform(t => {
            const newK = Math.max(MIN_K, t.k * (1 - ZOOM_STEP));
            const mx = size.w / 2, my = size.h / 2;
            const scale = newK / t.k;
            return { k: newK, x: mx - scale * (mx - t.x), y: my - scale * (my - t.y) };
          })} style={zoomBtnStyle(colors.toolTxt)}>－</button>
        </div>
      </div>

      {/* ── SVG ─────────────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        width="100%" height="100%"
        style={{ display: 'block', cursor: panning ? 'grabbing' : 'grab' }}
        onMouseDown={onSvgMouseDown}
      >
        <defs>
          <marker id="garr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={colors.edge}/>
          </marker>
          <marker id="garr-act" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={colors.act}/>
          </marker>
          <marker id="garr-dim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={colors.dimEdge}/>
          </marker>
        </defs>

        <g transform={transformStr}>
          {/* 엣지 */}
          {visibleEdges.map((e, i) => {
            const a = renderMap.get(e.from), b = renderMap.get(e.to);
            if (!a || !b) return null;
            const isAct  = e.from === activeNoteId || e.to === activeNoteId;
            const isHovEdge = hovered === e.from || hovered === e.to;
            const inFocusCluster = focusNeighborhood === null
              || (focusNeighborhood.has(e.from) && focusNeighborhood.has(e.to));
            const isDim  = matchedIds !== null
              ? !matchedIds.has(e.from) && !matchedIds.has(e.to)
              : !inFocusCluster;
            const isRelation = e.relationshipType === 'relation';
            const strokeColor = isDim
              ? colors.dimEdge
              : isRelation
                ? '#10B981'
                : isAct
                  ? colors.act
                  : colors.edge;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={strokeColor}
                strokeWidth={isAct || isHovEdge ? 2 : isRelation ? 1.75 : 1}
                strokeOpacity={isDim ? 0.12 : isAct || isHovEdge ? 0.95 : 0.45}
                strokeDasharray={isRelation ? '4 3' : undefined}
                markerEnd={isDim ? 'url(#garr-dim)' : isAct ? 'url(#garr-act)' : 'url(#garr)'}
              />
            );
          })}

          {/* 노드 */}
          {visibleNodes.map(node => {
            const isHub   = node.links >= 4;
            const r       = (isHub ? 9 : 7) + Math.min(node.links * 2, isHub ? 14 : 10);
            const isAct   = node.id === activeNoteId;
            const isHov   = node.id === hovered;
            const isMatch = matchedIds !== null && matchedIds.has(node.id);
            const inFocusCluster = focusNeighborhood === null || focusNeighborhood.has(node.id);
            const isDim   = matchedIds !== null
              ? !matchedIds.has(node.id)
              : !inFocusCluster;
            const label   = node.title.length > 16 ? node.title.slice(0, 15) + '…' : node.title;
            const showLabel = shouldShowGraphNodeLabel({
              nodeCount: graphNodeCount,
              isActive: isAct,
              isHovered: isHov,
              isSearchMatch: isMatch,
              isHub,
              inFocusCluster,
              hasSearchFilter: matchedIds !== null,
            });

            // 폴더 색상
            const folderColor = getFolderColor(node.folderId, folderIds);
            const nodeFill = isDim
              ? colors.dimNode
              : isAct
                ? colors.act
                : folderColor
                  ? (dark ? folderColor + '55' : folderColor + '22')
                  : colors.node;
            const nodeStroke = isDim
              ? colors.dimEdge
              : isAct || isHov
                ? colors.act
                : isMatch
                  ? '#10B981'
                  : folderColor ?? colors.nodeB;

            return (
              <g
                key={node.id}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onSelect(node.id); }}
                onMouseDown={e => onNodeMouseDown(e, node.id)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* 호버 글로우 */}
                {isHov && !isDim && (
                  <circle cx={node.x} cy={node.y} r={r + 9} fill={colors.hovBg}/>
                )}
                {isAct && (
                  <circle cx={node.x} cy={node.y} r={r + 6}
                    fill="none" stroke={colors.act} strokeWidth={2} strokeOpacity={0.55}
                  />
                )}
                {isHub && !isDim && (
                  <circle cx={node.x} cy={node.y} r={r + 4}
                    fill="none" stroke={colors.act} strokeWidth={1} strokeOpacity={0.35}
                    strokeDasharray="2 3"
                  />
                )}
                {/* 검색 매치 링 */}
                {isMatch && (
                  <circle cx={node.x} cy={node.y} r={r + 5}
                    fill="none" stroke="#10B981" strokeWidth={1.5} strokeOpacity={0.6}
                    strokeDasharray="3 2"
                  />
                )}
                {/* 노드 본체 */}
                <circle
                  cx={node.x} cy={node.y} r={r}
                  fill={nodeFill}
                  stroke={nodeStroke}
                  strokeWidth={isAct || isHov || isMatch ? 2.5 : 1.5}
                  opacity={isDim ? 0.3 : 1}
                >
                  <title>{node.title.trim() || '제목 없음'}</title>
                </circle>
                {/* 폴더 색상 점 (우측 상단) */}
                {folderColor && !isAct && !isDim && (
                  <circle cx={node.x + r * 0.65} cy={node.y - r * 0.65} r={3}
                    fill={folderColor} opacity={0.9}
                  />
                )}
                {/* 즐겨찾기 별 */}
                {node.starred && !isDim && (
                  <text x={node.x - r * 0.6} y={node.y - r * 0.5}
                    fontSize="9" textAnchor="middle"
                    style={{ pointerEvents: 'none' }}>★</text>
                )}
                {/* 라벨 — hover/active/search only to reduce overlap (K-31) */}
                {showLabel && (
                <text
                  x={node.x} y={node.y + r + 16}
                  textAnchor="middle" fontSize="10"
                  fill={isDim ? colors.dimTxt : isAct ? colors.act : colors.txt}
                  fontWeight={isAct || isMatch ? '700' : '400'}
                  opacity={isDim ? 0.4 : 1}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {label}
                </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── 폴더 범례 ────────────────────────────────────────────── */}
      {folderIds.length > 0 && (
        <div style={{
          position: 'absolute', top: 48, left: 10,
          display: 'flex', flexDirection: 'column', gap: 3,
          background: colors.toolbar,
          border: `1px solid ${colors.toolbarB}`,
          borderRadius: 6, padding: '6px 8px',
          backdropFilter: 'blur(8px)',
          maxWidth: 150,
        }}>
          {folderIds.map((fid, i) => {
            const folderName =
              folders.find(f => f.id === fid)?.name ?? `폴더 ${i + 1}`;
            return (
              <div key={fid} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: FOLDER_PALETTE[i % FOLDER_PALETTE.length],
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10, color: colors.toolTxt,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {folderName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 하단 상태바 ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 10, right: 12,
        fontSize: 10, color: dark ? '#444' : '#9CA3AF',
        pointerEvents: 'none',
      }}>
        {visibleNodes.length} notes · {visibleEdges.length} links
        {!showIsolated && isolatedCount > 0 && ` · ${isolatedCount} hidden`}
        {' · '}<span style={{ opacity: 0.6 }}>scroll=줌 · drag=팬 · hover=제목</span>
      </div>

      {hoveredNode && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          fontSize: 10, color: colors.act, fontWeight: 600,
          pointerEvents: 'none',
          maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          ◉ {hoveredNode.title}
          {hoveredNode.links >= 4 && (
            <span style={{ opacity: 0.7, fontWeight: 500 }}> · hub · {hoveredNode.links}</span>
          )}
        </div>
      )}

      {activeNoteId && !hovered && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          fontSize: 10, color: colors.act, fontWeight: 600,
          pointerEvents: 'none',
          maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          ◉ {renderMap.get(activeNoteId)?.title}
        </div>
      )}

      {/* 검색 결과 없음 */}
      {matchedIds !== null && matchedIds.size === 0 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 12, color: colors.toolTxt,
          pointerEvents: 'none',
          background: colors.toolbar,
          padding: '6px 12px', borderRadius: 8,
          border: `1px solid ${colors.toolbarB}`,
        }}>
          '{searchQuery}' 와 일치하는 노드가 없습니다
        </div>
      )}
    </div>
  );
}

// ── 줌 버튼 스타일 헬퍼 ──────────────────────────────────────────────
function zoomBtnStyle(color: string): React.CSSProperties {
  return {
    background: 'none', border: 'none',
    color, cursor: 'pointer',
    fontSize: 13, padding: '0 6px', height: 26,
    lineHeight: '26px', borderRadius: 4,
    minWidth: 24, textAlign: 'center',
  };
}
