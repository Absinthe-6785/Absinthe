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
import { extractLinks } from './noteUtils';
import type { NoteBase as Note } from './noteUtils';

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

interface GraphEdge { from: string; to: string; }

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

  // ── 그래프 초기화 ─────────────────────────────────────────────────
  useEffect(() => {
    const titleToId: Record<string, string> = {};
    visible.forEach(n => { titleToId[n.title] = n.id; });

    const linkCount: Record<string, number> = {};
    const edgeSet   = new Set<string>();
    const edgeList: GraphEdge[] = [];

    visible.forEach(n => {
      extractLinks(n.body).forEach(title => {
        const toId = titleToId[title];
        if (!toId || toId === n.id) return;
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
      id: n.id, title: n.title, folderId: n.folderId ?? null,
      x: cx + (Math.random() - 0.5) * 300,
      y: cy + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0, links: 0,
    });
    nodesRef.current.forEach(nd => {
      const src = visible.find(n => n.id === nd.id);
      nd.links    = linkCount[nd.id] || 0;
      nd.title    = src?.title    ?? nd.title;
      nd.starred  = src?.starred  ?? false;
      nd.folderId = src?.folderId ?? null;
    });
  }, [visibleKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Force-directed 루프 ───────────────────────────────────────────
  useEffect(() => {
    let alpha = 1.0;
    const REPEL = 3200, ATTRACT = 0.05, CENTER = 0.008, DAMPING = 0.85, LINK_DIST = 130;

    const step = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (ns.length === 0 || alpha < 0.005) { setTick(t => t + 1); return; }

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
  }, [visibleKey, size.w, size.h, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

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
    bg:       dark ? '#18181A' : '#F3F4F6',
    edge:     dark ? '#6B7280' : '#9CA3AF',
    node:     dark ? '#2C2C2E' : '#FFFFFF',
    nodeB:    dark ? '#4B5563' : '#E5E7EB',
    txt:      dark ? '#D1D5DB' : '#374151',
    act:      dark ? '#FACC15' : '#2563EB',
    hovBg:    dark ? '#FACC1422' : '#DBEAFE88',
    toolbar:  dark ? '#1F1F21EE' : '#FFFFFFEE',
    toolbarB: dark ? '#374151' : '#E5E7EB',
    toolTxt:  dark ? '#9CA3AF' : '#6B7280',
    searchBg: dark ? '#27272A' : '#FFFFFF',
    searchB:  dark ? '#4B5563' : '#D1D5DB',
    searchTxt:dark ? '#F3F4F6' : '#111827',
    dimEdge:  dark ? '#374151' : '#D1D5DB',
    dimNode:  dark ? '#27272A' : '#F9FAFB',
    dimTxt:   dark ? '#4B5563' : '#9CA3AF',
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
            const isDim  = matchedIds !== null
              && !matchedIds.has(e.from) && !matchedIds.has(e.to);
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isDim ? colors.dimEdge : isAct ? colors.act : colors.edge}
                strokeWidth={isAct ? 1.5 : 1}
                strokeOpacity={isDim ? 0.15 : isAct ? 0.9 : 0.45}
                markerEnd={isDim ? 'url(#garr-dim)' : isAct ? 'url(#garr-act)' : 'url(#garr)'}
              />
            );
          })}

          {/* 노드 */}
          {visibleNodes.map(node => {
            const r      = 7 + Math.min(node.links * 2, 10);
            const isAct  = node.id === activeNoteId;
            const isHov  = node.id === hovered;
            const isMatch = matchedIds !== null && matchedIds.has(node.id);
            const isDim  = matchedIds !== null && !matchedIds.has(node.id);
            const label  = node.title.length > 16 ? node.title.slice(0, 15) + '…' : node.title;

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
                  <circle cx={node.x} cy={node.y} r={r + 7} fill={colors.hovBg}/>
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
                  strokeWidth={isAct || isHov || isMatch ? 2 : 1.5}
                  opacity={isDim ? 0.3 : 1}
                />
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
                {/* 라벨 */}
                <text
                  x={node.x} y={node.y + r + 14}
                  textAnchor="middle" fontSize="10"
                  fill={isDim ? colors.dimTxt : isAct ? colors.act : colors.txt}
                  fontWeight={isAct || isMatch ? '700' : '400'}
                  opacity={isDim ? 0.4 : 1}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {label}
                </text>
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
        {' · '}<span style={{ opacity: 0.6 }}>scroll=줌 · drag=팬</span>
      </div>

      {activeNoteId && (
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
