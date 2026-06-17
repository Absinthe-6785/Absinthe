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
import { TOUCH_TARGET_MIN_PX } from '../../lib/responsiveLayout';
import { toolbarControlHeight as resolveToolbarHeight } from '../../theme/actionTokens';
import { useTranslation } from '../../lib/i18n';
import { logMemAudit } from '../../lib/memAudit';
import { noteMatchesSearch } from '../../lib/math/noteSearch';
import { buildGlobalGraphData, knowledgeIndexService, buildCosmosVaultAnalysis, buildDiscoveryFeed } from './features/knowledge';
import type { DiscoveryFeed } from './features/knowledge/discovery';
import { evaluateKnowledgeImportance, buildImportanceInputForNote } from './features/knowledge/cosmos/intelligence';
import { getNoteGalaxyMap } from './features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import { useNotesStore } from '../../store/useNotesStore';
import type { GlobalGraphRelationshipFilter, GraphRelationshipType } from './features/knowledge';
import type { NoteBase as Note } from './noteUtils';
import {
  applyGalaxyCohesion,
  buildFocusUniverseDepthMap,
  buildGalaxyVisuals,
  buildOrbitPaths,
  computeDisplayPosition,
  computeGalaxyCenters,
  computeUniverseHudStats,
  DEFAULT_FOCUS_DEPTH,
  enrichGraphNodeMeta,
  interGalaxyRepulsionMultiplier,
  isUniverseMode,
  loadGraphViewMode,
  saveGraphViewMode,
  shouldShowEmptyUniverse,
  usePrefersReducedMotion,
  type EdgeSemanticKind,
  type GraphNodeTier,
  type GraphViewMode,
} from './features/knowledge/graph/knowledgeUniverse';
import { resolveCosmosEmptyScenario } from './features/knowledge/cosmos/onboarding';
import { CosmosGraphPreviewPanel } from './features/knowledge/cosmos/CosmosGraphPreviewPanel';
import type { RecentEvolutionSummary } from './features/knowledge/timeline';
import { edgeLegendEntries } from './features/knowledge/graphLabels';
import {
  graphRepulsionStrength,
  graphSimulationAlphaFloor,
  shouldRenderGalaxyLabels,
  shouldRenderGalaxyNebula,
} from './graphScalePolicy';
import {
  countPreservedGraphNodes,
  COSMOS_WARM_REHEAT_ALPHA,
  resolveCosmosSimInitialAlpha,
  type CosmosSimContextSnapshot,
} from './cosmosSimReheat';
import { buildGraphTopologySignatureFromGraphData } from './cosmosGraphSignature';
import {
  isCosmosSimNodeActive,
  resolveCosmosLocalReheatPlan,
  shouldIntegrateCosmosSimPair,
} from './cosmosLocalReheat';
import {
  COSMOS_SIM_SETTLE_RENDER_DIVISOR,
  shouldCommitRenderOnSimFrame,
  shouldSuppressSettleDecorations,
} from './cosmosRenderThrottle';
import {
  CosmosEdgeLayer,
  CosmosGalaxyDecorationLayer,
  CosmosNodeLayer,
  CosmosOrbitPathLayer,
  type CosmosDisplayPosNode,
} from './cosmosGraphLayers';

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
  backlinkCount: number;
  importance: number;
  radius: number;
  tier: GraphNodeTier;
  galaxyId: string;
  galaxyLabel: string;
  isAreaNote: boolean;
  orbitParentId: string | null;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  updatedAt: number | null;
  starred?: boolean;
}

interface GraphEdge {
  from: string;
  to: string;
  relationshipType: GraphRelationshipType;
  weight: number;
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
  onCreateNote?: () => void;
  onLearnLinking?: () => void;
  onHudReviewWeakAreas?: () => void;
  onHudOpenIsolated?: () => void;
  onHudOpenDiscover?: () => void;
  onHudReviewDiscoveries?: () => void;
  onHudOpenTimeline?: () => void;
  recentEvolution?: RecentEvolutionSummary;
  /** Mobile/tablet — larger touch targets and bottom-sheet preview. */
  compactChrome?: boolean;
  /** Reuse memoized vault feed from NoteView instead of rebuilding in HUD (K-89B2B). */
  sharedDiscoveryFeed?: DiscoveryFeed;
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
export function NoteGraphView({ notes, folders = [], activeNoteId, onSelect, dark, onCreateNote, onLearnLinking, onHudReviewWeakAreas, onHudOpenIsolated, onHudOpenDiscover, onHudReviewDiscoveries, compactChrome = false, sharedDiscoveryFeed }: NoteGraphViewProps) {
  const { t, lang } = useTranslation();
  const edgeLegend = useMemo(() => edgeLegendEntries(lang), [lang]);
  const svgRef   = useRef<SVGSVGElement>(null);
  const frameRef = useRef<number>(0);
  const renderTickRef = useRef(0);
  const toolbarControlHeight = resolveToolbarHeight(compactChrome);

  const [size, setSize]         = useState({ w: 600, h: 400 });
  const [hovered, setHovered]   = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);  // node drag (UI + pointer handlers)
  const draggingRef = useRef<string | null>(null);  // K-92B1A — sim loop reads ref; avoids sim restart on drag
  const [panning, setPanning]   = useState(false);                // canvas pan
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [showIsolated, setShowIsolated] = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<GlobalGraphRelationshipFilter>('all');
  const [graphViewMode, setGraphViewMode] = useState<GraphViewMode>(() => loadGraphViewMode());
  const [hoveredEdgeKind, setHoveredEdgeKind] = useState<EdgeSemanticKind | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  const vaultStructureVersion = useNotesStore(s => s.vaultStructureVersion);
  const graphViewModeRef = useRef(graphViewMode);
  const orbitTimeRef = useRef(0);

  const dragOffset = useRef({ dx: 0, dy: 0 });
  const panStart   = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });

  const updateDragging = useCallback((id: string | null) => {
    draggingRef.current = id;
    setDragging(id);
  }, []);

  // nodes/edges를 ref로 관리 — 애니메이션 루프에서 직접 변경
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const preservedNodeCountRef = useRef(0);
  const simContextRef = useRef<CosmosSimContextSnapshot | null>(null);
  const simSettlingRef = useRef(false);
  const [simSettling, setSimSettling] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    graphViewModeRef.current = graphViewMode;
    saveGraphViewMode(graphViewMode);
  }, [graphViewMode]);

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
  const indexContentVersion = useNotesStore(s => s.indexContentVersion);
  const galaxyCacheKey = String(vaultStructureVersion);

  const visible = useMemo(() => safeNotes.filter(n => !n.deletedAt), [vaultStructureVersion, safeNotes.length]);

  // 폴더 ID 목록 (색상 인덱스용 — 안정 순서)
  const folderIds = useMemo(() => {
    const active = useNotesStore.getState().notes.filter(n => !n.deletedAt);
    const ids = [...new Set(active.map(n => n.folderId).filter(Boolean) as string[])].sort();
    return ids;
  }, [vaultStructureVersion]);

  const noteById = useMemo(
    () => new Map(useNotesStore.getState().notes.filter(n => !n.deletedAt).map(note => [note.id, note])),
    [vaultStructureVersion, indexContentVersion],
  );

  const graphData = useMemo(
    () => buildGlobalGraphData({
      service: knowledgeIndexService,
      options: { relationshipFilter },
    }),
    [vaultStructureVersion, indexContentVersion, relationshipFilter],
  );

  const graphTopologySignature = useMemo(
    () => buildGraphTopologySignatureFromGraphData(graphData),
    [graphData],
  );

  useEffect(() => {
    logMemAudit({
      source: 'NoteGraphView.graphData',
      notes: visible.length,
      graphNodes: graphData.nodes.length,
      graphEdges: graphData.edges.length,
      universeMode: graphViewMode === 'universe',
    });
  }, [graphData, visible.length, graphViewMode]);

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
        weight: edge.weight,
      });
    });
    edgesRef.current = edgeList;

    const degreeById = new Map(graphData.nodes.map(node => [node.noteId, node.degree ?? 0]));
    const noteIds = graphData.nodes.map(node => node.noteId);
    const metaById = enrichGraphNodeMeta({
      noteIds,
      notesById: noteById,
      service: knowledgeIndexService,
      edges: edgeList,
      galaxyCacheKey,
    });
    const existing = Object.fromEntries(nodesRef.current.map(n => [n.id, n]));
    const existingIds = new Set(Object.keys(existing));
    const cx = size.w / 2, cy = size.h / 2;

    nodesRef.current = graphData.nodes.map(node => {
      const note = noteById.get(node.noteId);
      const meta = metaById.get(node.noteId);
      const prior = existing[node.noteId];
      const base = prior ?? {
        id: node.noteId,
        title: node.title,
        folderId: note?.folderId ?? null,
        x: cx + (Math.random() - 0.5) * 300,
        y: cy + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
        links: 0,
        backlinkCount: 0,
        importance: 0,
        radius: 8,
        tier: 'moon' as GraphNodeTier,
        galaxyId: 'uncategorized',
        galaxyLabel: 'Uncategorized',
        isAreaNote: false,
        orbitParentId: null,
        orbitRadius: 0,
        orbitAngle: 0,
        orbitSpeed: 0,
        updatedAt: null,
      };
      if (meta) {
        base.backlinkCount = meta.backlinkCount;
        base.importance = meta.importance;
        base.radius = meta.radius;
        base.tier = meta.tier;
        base.galaxyId = meta.galaxy.galaxyId;
        base.galaxyLabel = meta.galaxy.galaxyLabel;
        base.isAreaNote = meta.isAreaNote;
        base.orbitParentId = meta.orbit.parentId;
        base.orbitRadius = meta.orbit.orbitRadius;
        base.orbitAngle = meta.orbit.orbitAngle;
        base.orbitSpeed = meta.orbit.orbitSpeed;
      }
      return base;
    });

    nodesRef.current.forEach(nd => {
      const note = noteById.get(nd.id);
      nd.links = degreeById.get(nd.id) ?? 0;
      nd.title = note?.title ?? nd.title;
      nd.starred = note?.starred ?? false;
      nd.folderId = note?.folderId ?? null;
      nd.updatedAt = note?.updatedAt ?? null;
    });

    preservedNodeCountRef.current = countPreservedGraphNodes(
      existingIds,
      graphData.nodes.map(node => node.noteId),
    );
  }, [graphData, noteById, size.w, size.h]);

  // ── Force-directed 루프 ───────────────────────────────────────────
  useEffect(() => {
    const prevSimContext = simContextRef.current;
    const nextSimContext: CosmosSimContextSnapshot = {
      graphTopologySignature,
      sizeW: size.w,
      sizeH: size.h,
      relationshipFilter,
      graphViewMode,
      reducedMotion,
    };
    let alpha = resolveCosmosSimInitialAlpha({
      preservedNodeCount: preservedNodeCountRef.current,
      totalNodeCount: nodesRef.current.length,
      prev: prevSimContext,
      next: nextSimContext,
    });
    simContextRef.current = nextSimContext;

    const topologyChange = prevSimContext != null
      && prevSimContext.graphTopologySignature !== graphTopologySignature;
    const sizeChange = prevSimContext != null
      && (prevSimContext.sizeW !== size.w || prevSimContext.sizeH !== size.h);

    let localActiveIds: ReadonlySet<string> | null = null;
    if (
      topologyChange
      && !sizeChange
      && alpha === COSMOS_WARM_REHEAT_ALPHA
      && prevSimContext != null
    ) {
      const plan = resolveCosmosLocalReheatPlan({
        prevSignature: prevSimContext.graphTopologySignature,
        nextSignature: graphTopologySignature,
        totalNodeCount: nodesRef.current.length,
        preservedNodeCount: preservedNodeCountRef.current,
      });
      if (plan.mode === 'local_reheat' && plan.activeNodeIds) {
        localActiveIds = plan.activeNodeIds;
      }
    }

    simSettlingRef.current = true;
    setSimSettling(true);

    const nodeCount = nodesRef.current.length;
    const REPEL = graphRepulsionStrength(nodeCount);
    const alphaFloor = graphSimulationAlphaFloor(nodeCount);
    const ATTRACT = 0.05, CENTER = 0.008, DAMPING = 0.85, LINK_DIST = 130;

    const step = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      const universeMode = isUniverseMode(graphViewModeRef.current);
      orbitTimeRef.current = performance.now();

      if (ns.length === 0) return;

      const simActive = alpha >= alphaFloor;

      if (simActive) {
        alpha *= 0.97;

        const galaxyCenters = universeMode
          ? computeGalaxyCenters(ns.map(n => ({ id: n.id, x: n.x, y: n.y, galaxyId: n.galaxyId })))
          : null;

        for (let i = 0; i < ns.length; i++) {
          for (let j = i + 1; j < ns.length; j++) {
            if (!shouldIntegrateCosmosSimPair(ns[i].id, ns[j].id, localActiveIds)) continue;
            const dx = ns[j].x - ns[i].x, dy = ns[j].y - ns[i].y;
            const dist2 = dx * dx + dy * dy + 1;
            const repMul = interGalaxyRepulsionMultiplier(ns[i].galaxyId, ns[j].galaxyId, universeMode);
            const force = (REPEL / dist2) * repMul;
            const d = Math.sqrt(dist2);
            const fx = force * dx / d, fy = force * dy / d;
            ns[i].vx -= fx; ns[i].vy -= fy;
            ns[j].vx += fx; ns[j].vy += fy;
          }
        }

        const nodeMap = new Map(ns.map(n => [n.id, n]));
        es.forEach(e => {
          if (!shouldIntegrateCosmosSimPair(e.from, e.to, localActiveIds)) return;
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
          if (!isCosmosSimNodeActive(n.id, localActiveIds)) return;
          n.vx += (cx - n.x) * CENTER;
          n.vy += (cy - n.y) * CENTER;
          if (universeMode && galaxyCenters) {
            applyGalaxyCohesion(n, galaxyCenters.get(n.galaxyId), true);
          }
        });

        ns.forEach(n => {
          if (n.id === draggingRef.current) return;
          if (!isCosmosSimNodeActive(n.id, localActiveIds)) return;
          n.vx *= DAMPING; n.vy *= DAMPING;
          n.x  += n.vx * alpha;
          n.y  += n.vy * alpha;
          n.x = Math.max(30, Math.min(size.w - 30, n.x));
          n.y = Math.max(30, Math.min(size.h - 30, n.y));
        });
      }

      renderTickRef.current += 1;
      if (simActive) {
        if (shouldCommitRenderOnSimFrame(renderTickRef.current, COSMOS_SIM_SETTLE_RENDER_DIVISOR)) {
          setTick(t => t + 1);
        }
        frameRef.current = requestAnimationFrame(step);
      } else if (simSettlingRef.current) {
        simSettlingRef.current = false;
        setSimSettling(false);
        setTick(t => t + 1);
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameRef.current);
      simSettlingRef.current = false;
      setSimSettling(false);
    };
  }, [graphTopologySignature, size.w, size.h, relationshipFilter, graphViewMode, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

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
    updateDragging(id);
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
    const onUp = () => updateDragging(null);
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
    const noteById = new Map(safeNotes.map(n => [n.id, n]));
    return new Set(
      nodesRef.current
        .filter(n => {
          const note = noteById.get(n.id);
          return note && noteMatchesSearch(note, searchQuery.trim());
        })
        .map(n => n.id),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLower, searchQuery, safeNotes, tick]);

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

  const hasActiveSelection = activeNoteId != null;
  const focusId = hovered ?? activeNoteId;
  const focusDepthMap = useMemo(() => {
    if (!activeNoteId) return null;
    return buildFocusUniverseDepthMap(activeNoteId, visibleEdges, DEFAULT_FOCUS_DEPTH);
  }, [activeNoteId, visibleEdges, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusNeighborhood = useMemo(() => {
    if (focusDepthMap) return new Set(focusDepthMap.keys());
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    visibleEdges.forEach(edge => {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    });
    return ids;
  }, [focusDepthMap, focusId, tick, visibleEdges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const showGalaxyNebula = shouldRenderGalaxyNebula(graphNodeCount, transform.k, isUniverseMode(graphViewMode));
  const showGalaxyLabels = shouldRenderGalaxyLabels(graphNodeCount, transform.k, isUniverseMode(graphViewMode));

  const galaxyVisuals = useMemo(() => {
    if (!showGalaxyNebula) return [];
    const anchorByGalaxy = new Map<string, string | null>();
    for (const node of visibleNodes) {
      if (node.isAreaNote) anchorByGalaxy.set(node.galaxyId, node.id);
    }
    return buildGalaxyVisuals(
      visibleNodes.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        galaxyId: node.galaxyId,
        galaxyLabel: node.galaxyLabel,
        tier: node.tier,
      })),
      anchorByGalaxy,
    );
  }, [showGalaxyNebula, visibleNodes.length, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const orbitPaths = useMemo(() => {
    if (!isUniverseMode(graphViewMode)) return [];
    const positions = new Map(visibleNodes.map(node => [node.id, { x: node.x, y: node.y }]));
    return buildOrbitPaths(visibleNodes, positions);
  }, [graphViewMode, visibleNodes.length, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const hudStats = useMemo(
    () => computeUniverseHudStats(visibleNodes, visibleEdges.length),
    [visibleNodes, visibleEdges.length],
  );

  const [hudVaultAnalysis, setHudVaultAnalysis] = useState<ReturnType<typeof buildCosmosVaultAnalysis> | null>(null);
  const [hudDiscoveryFeedLocal, setHudDiscoveryFeedLocal] = useState<DiscoveryFeed | null>(null);

  useEffect(() => {
    const run = () => {
      setHudVaultAnalysis(
        buildCosmosVaultAnalysis(useNotesStore.getState().notes, knowledgeIndexService),
      );
      if (sharedDiscoveryFeed === undefined) {
        setHudDiscoveryFeedLocal(
          buildDiscoveryFeed(useNotesStore.getState().notes, knowledgeIndexService, { galaxyCacheKey }),
        );
      }
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run);
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 0);
    return () => window.clearTimeout(id);
  }, [vaultStructureVersion, galaxyCacheKey, sharedDiscoveryFeed]);

  const vaultAnalysis = hudVaultAnalysis;
  const discoveryFeed = sharedDiscoveryFeed ?? hudDiscoveryFeedLocal;

  const highlightNodeId = previewNodeId ?? activeNoteId;

  const galaxyMap = useMemo(
    () => getNoteGalaxyMap(useNotesStore.getState().notes, knowledgeIndexService, galaxyCacheKey),
    [vaultStructureVersion],
  );

  const selectedImportance = useMemo(() => {
    if (!highlightNodeId) return null;
    const note = notes.find(n => n.id === highlightNodeId);
    if (!note) return null;
    const input = buildImportanceInputForNote(note, knowledgeIndexService, galaxyMap.get(note.id));
    return evaluateKnowledgeImportance(input);
  }, [highlightNodeId, notes, galaxyMap]);

  const previewNote = previewNodeId ? notes.find(n => n.id === previewNodeId) : null;
  const previewGraphNode = previewNodeId ? renderMap.get(previewNodeId) : null;

  const navigableNodeIds = useMemo(
    () => visibleNodes.map(n => n.id),
    [visibleNodes],
  );

  const focusAdjacentNode = useCallback((direction: 1 | -1) => {
    if (!navigableNodeIds.length) return;
    const current = previewNodeId ?? activeNoteId;
    const currentIdx = current ? navigableNodeIds.indexOf(current) : -1;
    const nextIdx = currentIdx < 0
      ? (direction > 0 ? 0 : navigableNodeIds.length - 1)
      : (currentIdx + direction + navigableNodeIds.length) % navigableNodeIds.length;
    setPreviewNodeId(navigableNodeIds[nextIdx] ?? null);
  }, [navigableNodeIds, previewNodeId, activeNoteId]);

  useEffect(() => {
    if (!previewNodeId) return;
    const node = nodesRef.current.find(n => n.id === previewNodeId);
    if (!node) return;
    setTransform(prev => ({
      ...prev,
      x: size.w / 2 - node.x * prev.k,
      y: size.h / 2 - node.y * prev.k,
    }));
  }, [previewNodeId, size.w, size.h]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && previewNodeId) {
        e.preventDefault();
        onSelect(previewNodeId);
        setPreviewNodeId(null);
        return;
      }
      if (e.key === 'Escape' && previewNodeId) {
        e.preventDefault();
        setPreviewNodeId(null);
        return;
      }
      if (!previewNodeId) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusAdjacentNode(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusAdjacentNode(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewNodeId, focusAdjacentNode, onSelect]);

  const showEmptyUniverse = shouldShowEmptyUniverse({
    nodeCount: visibleNodes.length,
    linkCount: visibleEdges.length,
    hasSearchFilter: matchedIds !== null,
    searchHasMatches: matchedIds === null || matchedIds.size > 0,
  });
  const emptyScenario = resolveCosmosEmptyScenario({
    activeNoteCount: notes.filter(n => !n.deletedAt).length,
    linkCount: visibleEdges.length,
    hasSearchFilter: matchedIds !== null,
    searchHasMatches: matchedIds === null || matchedIds.size > 0,
  });

  const getDisplayPos = useCallback((node: CosmosDisplayPosNode) => {
    const parent = node.orbitParentId
      ? nodesRef.current.find(n => n.id === node.orbitParentId)
      : null;
    return computeDisplayPosition({
      x: node.x,
      y: node.y,
      parentX: parent?.x ?? null,
      parentY: parent?.y ?? null,
      orbitRadius: node.orbitRadius ?? 0,
      orbitAngle: node.orbitAngle ?? 0,
      orbitSpeed: node.orbitSpeed ?? 0,
      timeMs: orbitTimeRef.current,
      reducedMotion,
      enabled: isUniverseMode(graphViewMode),
    });
  }, [graphViewMode, reducedMotion, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const transformStr = `translate(${transform.x}, ${transform.y}) scale(${transform.k})`;
  const suppressSettleDecorations = shouldSuppressSettleDecorations(simSettling);
  const nodeById = renderMap;
  const tierLabels = useMemo(() => ({
    star: t('graphTierStar'),
    planet: t('graphTierPlanet'),
    moon: t('graphTierMoon'),
  }), [t]);
  const resolveFolderColor = useCallback(
    (folderId: string | null) => getFolderColor(folderId, folderIds),
    [folderIds],
  );
  const handleHoverEdgeKind = useCallback((kind: EdgeSemanticKind | null) => {
    setHoveredEdgeKind(kind);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: colors.bg, overflow: 'hidden' }}>
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
      {/* ── 툴바 ────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
        pointerEvents: 'none',
        flexWrap: compactChrome ? 'wrap' : 'nowrap',
      }}>
        {/* 검색 */}
        <div style={{ pointerEvents: 'all', flex: compactChrome ? '1 1 96px' : '0 0 auto', minWidth: compactChrome ? 96 : undefined, maxWidth: compactChrome ? 180 : undefined }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{
              position: 'absolute', left: 7, fontSize: 11,
              color: colors.toolTxt, pointerEvents: 'none',
            }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('graphSearchNodes')}
              style={{
                height: toolbarControlHeight, paddingLeft: 24, paddingRight: 8,
                fontSize: 11, borderRadius: 6,
                border: `1px solid ${colors.searchB}`,
                background: colors.searchBg,
                color: colors.searchTxt,
                outline: 'none',
                width: compactChrome ? '100%' : 140,
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

        {/* Graph mode — Network vs Knowledge Universe */}
        <div style={{
          pointerEvents: 'all',
          display: 'flex',
          borderRadius: 6,
          border: `1px solid ${colors.searchB}`,
          overflow: 'hidden',
          height: toolbarControlHeight,
        }}>
          {(['network', 'universe'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setGraphViewMode(mode)}
              style={{
                height: toolbarControlHeight,
                padding: '0 10px',
                fontSize: 11,
                border: 'none',
                cursor: 'pointer',
                background: graphViewMode === mode ? colors.act : colors.searchBg,
                color: graphViewMode === mode ? '#fff' : colors.searchTxt,
              }}
            >
              {mode === 'network' ? t('graphModeNetwork') : t('graphModeCosmos')}
            </button>
          ))}
        </div>

        {/* Relationship filter */}
        {compactChrome ? (
          <div style={{
            pointerEvents: 'all',
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            maxWidth: '100%',
            flex: '1 1 auto',
          }}>
            {([
              { value: 'all', label: t('graphFilterAll') },
              { value: 'backlinks', label: t('graphFilterBacklinks') },
              { value: 'mentions', label: t('graphFilterMentions') },
              { value: 'relations', label: t('graphFilterRelations') },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRelationshipFilter(value)}
                style={{
                  minHeight: TOUCH_TARGET_MIN_PX,
                  padding: '0 10px',
                  fontSize: 10,
                  borderRadius: 6,
                  border: `1px solid ${colors.searchB}`,
                  background: relationshipFilter === value ? colors.act : colors.searchBg,
                  color: relationshipFilter === value ? '#fff' : colors.searchTxt,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
        <select
          value={relationshipFilter}
          onChange={e => setRelationshipFilter(e.target.value as GlobalGraphRelationshipFilter)}
          style={{
            pointerEvents: 'all',
            height: toolbarControlHeight,
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
          <option value="all">{t('graphFilterAll')}</option>
          <option value="backlinks">{t('graphFilterBacklinks')}</option>
          <option value="mentions">{t('graphFilterMentions')}</option>
          <option value="relations">{t('graphFilterRelations')}</option>
        </select>
        )}

        {/* 고립 노드 토글 */}
        {isolatedCount > 0 && (
          <button
            onClick={() => setShowIsolated(v => !v)}
            title={showIsolated ? t('graphIsolatedHide').replace('{count}', String(isolatedCount)) : t('graphIsolatedShow').replace('{count}', String(isolatedCount))}
            style={{
              pointerEvents: 'all',
              height: toolbarControlHeight, padding: '0 10px',
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
            {t('graphIsolatedLabel')} {isolatedCount}
          </button>
        )}

        {/* 스페이서 */}
        {previewNodeId ? (
          <span style={{ pointerEvents: 'none', fontSize: 9, color: colors.toolTxt, opacity: 0.85, paddingRight: 4 }}>
            {t('cosmosKeyboardNavHint')}
          </span>
        ) : null}
        <div style={{ flex: 1 }} />

        {/* 줌 컨트롤 */}
        <div style={{
          pointerEvents: 'all',
          display: 'flex', alignItems: 'center', gap: 2,
          background: colors.toolbar,
          border: `1px solid ${colors.toolbarB}`,
          borderRadius: 6, padding: '0 2px',
          backdropFilter: 'blur(8px)',
          height: toolbarControlHeight,
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
          <filter id="ku-star-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ku-planet-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ku-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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
          <CosmosGalaxyDecorationLayer
            galaxies={galaxyVisuals}
            showGalaxyLabels={showGalaxyLabels}
            suppressDecorations={suppressSettleDecorations}
            dark={dark}
            colors={colors}
          />

          <CosmosOrbitPathLayer
            paths={orbitPaths}
            suppressDecorations={suppressSettleDecorations}
            colors={colors}
          />

          <CosmosEdgeLayer
            edges={visibleEdges}
            nodeById={nodeById}
            getDisplayPos={getDisplayPos}
            highlightNodeId={highlightNodeId}
            hovered={hovered}
            focusDepthMap={focusDepthMap}
            focusNeighborhood={focusNeighborhood}
            matchedIds={matchedIds}
            hasActiveSelection={hasActiveSelection}
            suppressDecorations={suppressSettleDecorations}
            dark={dark}
            colors={colors}
            onHoverEdgeKind={handleHoverEdgeKind}
          />

          <CosmosNodeLayer
            nodes={visibleNodes}
            graphNodeCount={graphNodeCount}
            transformK={transform.k}
            getFolderColor={resolveFolderColor}
            getDisplayPos={getDisplayPos}
            highlightNodeId={highlightNodeId}
            hovered={hovered}
            matchedIds={matchedIds}
            focusDepthMap={focusDepthMap}
            focusNeighborhood={focusNeighborhood}
            hasActiveSelection={hasActiveSelection}
            suppressDecorations={suppressSettleDecorations}
            compactChrome={compactChrome}
            reducedMotion={reducedMotion}
            dark={dark}
            colors={colors}
            untitledLabel={t('untitledNote')}
            tierLabels={tierLabels}
            onPreview={setPreviewNodeId}
            onSelect={onSelect}
            onNodeMouseDown={onNodeMouseDown}
            onHover={setHovered}
          />
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
              folders.find(f => f.id === fid)?.name ?? t('graphFolderFallback').replace('{n}', String(i + 1));
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

      {/* ── Universe HUD ───────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 48, right: 10,
        fontSize: 10, lineHeight: 1.45,
        color: colors.toolTxt,
        background: colors.toolbar,
        border: `1px solid ${colors.toolbarB}`,
        borderRadius: 8,
        padding: '8px 10px',
        backdropFilter: 'blur(8px)',
        maxWidth: 220,
      }} data-ku-universe-hud aria-label={t('k39CosmosHudAria')}>
        <div style={{ fontWeight: 700, color: colors.txt, marginBottom: 4 }}>
          {t('cosmosUniverseTitle')}
        </div>
        <div>
          {t('cosmosHudSummary')
            .replace('{nodes}', String(hudStats.nodeCount))
            .replace('{links}', String(hudStats.linkCount))
            .replace('{galaxies}', String(hudStats.galaxyCount))}
        </div>
        {vaultAnalysis && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${colors.toolbarB}` }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{t('k36HudAnalysisTitle')}</div>
          <div style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{t('k36HudIsolated').replace('{count}', String(vaultAnalysis.isolatedCount))}</span>
            {vaultAnalysis.isolatedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowIsolated(true);
                  onHudOpenIsolated?.();
                }}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  border: `1px solid ${colors.toolbarB}`,
                  background: colors.toolbar,
                  color: colors.act,
                  cursor: 'pointer',
                }}
              >
                {t('k37HudOpen')}
              </button>
            )}
          </div>
          <div style={{ opacity: 0.85 }}>
            {t('k36HudOpportunities').replace('{count}', String(vaultAnalysis.opportunityCount))}
          </div>
          <div style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{t('k36HudWeakAreas').replace('{count}', String(vaultAnalysis.weakAreaCount))}</span>
            {vaultAnalysis.weakAreaCount > 0 && onHudReviewWeakAreas && (
              <button
                type="button"
                onClick={onHudReviewWeakAreas}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 4,
                  border: `1px solid ${colors.toolbarB}`,
                  background: colors.toolbar,
                  color: colors.act,
                  cursor: 'pointer',
                }}
              >
                {t('k37HudReview')}
              </button>
            )}
          </div>
        </div>
        )}
        {discoveryFeed && discoveryFeed.summary.totalCount > 0 && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${colors.toolbarB}` }}>
            <div style={{ fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{t('k38HudDiscoveryTitle')}</span>
              {onHudOpenDiscover && (
                <button
                  type="button"
                  onClick={onHudOpenDiscover}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: `1px solid ${colors.toolbarB}`,
                    background: colors.toolbar,
                    color: colors.act,
                    cursor: 'pointer',
                  }}
                >
                  {t('k38ActionOpenDiscover')}
                </button>
              )}
            </div>
            <div style={{ opacity: 0.85 }}>{t('k38HudForgotten').replace('{count}', String(discoveryFeed.summary.forgottenCount))}</div>
            <div style={{ opacity: 0.85 }}>{t('k38HudMissingConnections').replace('{count}', String(discoveryFeed.summary.missingConnectionCount))}</div>
            <div style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{t('k38HudWeakHubs').replace('{count}', String(discoveryFeed.summary.weakHubCount))}</span>
              {discoveryFeed.summary.totalCount > 0 && onHudReviewDiscoveries && (
                <button
                  type="button"
                  onClick={onHudReviewDiscoveries}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: `1px solid ${colors.toolbarB}`,
                    background: colors.toolbar,
                    color: colors.act,
                    cursor: 'pointer',
                  }}
                >
                  {t('k37HudReview')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edge hover legend */}
      {hoveredEdgeKind && (
        <div style={{
          position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 10, alignItems: 'center',
          background: colors.toolbar,
          border: `1px solid ${colors.toolbarB}`,
          borderRadius: 8, padding: '6px 10px',
          fontSize: 10, color: colors.toolTxt,
          pointerEvents: 'none',
        }}>
          {edgeLegend.map(entry => (
            <span key={entry.kind} style={{
              opacity: entry.kind === hoveredEdgeKind ? 1 : 0.45,
              fontWeight: entry.kind === hoveredEdgeKind ? 700 : 400,
            }}>
              {entry.sample} {entry.label}
            </span>
          ))}
        </div>
      )}

      {/* Empty universe onboarding */}
      {showEmptyUniverse && emptyScenario && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 5,
        }} data-ku-empty-universe>
          <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden>
            <circle cx="60" cy="40" r="8" fill={colors.act} opacity="0.9" />
            <circle cx="60" cy="40" r="16" fill="none" stroke={colors.act} strokeOpacity="0.35" />
            <circle cx="30" cy="28" r="4" fill={colors.toolTxt} opacity="0.5" />
            <circle cx="88" cy="52" r="3" fill={colors.toolTxt} opacity="0.4" />
            <circle cx="95" cy="22" r="2.5" fill={colors.toolTxt} opacity="0.35" />
            <ellipse cx="60" cy="40" rx="42" ry="28" fill="none" stroke={colors.act} strokeOpacity="0.15" strokeDasharray="4 6" />
          </svg>
          <p style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: colors.txt }}>
            {emptyScenario === 'no-notes' ? t('k41EmptyCosmosWelcome') : t('k41EmptyCosmosUnlinkedTitle')}
          </p>
          <p style={{ marginTop: 4, fontSize: 11, color: colors.toolTxt, maxWidth: 340, textAlign: 'center' }}>
            {emptyScenario === 'no-notes' ? t('k41EmptyCosmosNoNotes') : t('k41EmptyCosmosUnlinkedBody')}
          </p>
          {(onCreateNote || onLearnLinking) && (
            <div style={{ marginTop: 12, pointerEvents: 'all' }}>
              {emptyScenario === 'no-notes' && onCreateNote && (
                <button
                  type="button"
                  onClick={onCreateNote}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: colors.act,
                    color: colors.bg,
                    cursor: 'pointer',
                  }}
                >
                  {t('k41CreateNote')}
                </button>
              )}
              {emptyScenario === 'no-links' && onLearnLinking && (
                <button
                  type="button"
                  onClick={onLearnLinking}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: `1px solid ${colors.act}`,
                    background: 'transparent',
                    color: colors.act,
                    cursor: 'pointer',
                  }}
                >
                  {t('k41LearnLinking')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 하단 상태바 ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 10, right: 12,
        fontSize: 10, color: dark ? '#71717A' : '#6B7280',
        pointerEvents: 'none',
      }}>
        {t('graphStatusNotesLinks')
          .replace('{notes}', String(visibleNodes.length))
          .replace('{links}', String(visibleEdges.length))}
        {graphViewMode === 'universe' ? t('graphStatusCosmos') : t('graphStatusNetwork')}
        {!showIsolated && isolatedCount > 0 && t('graphStatusHidden').replace('{count}', String(isolatedCount))}
        {' · '}<span style={{ opacity: 0.6 }}>{t('graphStatusControls')}</span>
      </div>

      {/* 검색 결과 없음 */}
      {matchedIds !== null && matchedIds.size === 0 && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 12, color: colors.toolTxt,
            pointerEvents: 'all',
            cursor: 'pointer',
            background: colors.toolbar,
            padding: '8px 14px', borderRadius: 8,
            border: `1px solid ${colors.toolbarB}`,
          }}
        >
          {t('graphSearchNoResults').replace('{query}', searchQuery)}
          <span style={{ display: 'block', marginTop: 4, fontSize: 10, color: colors.act }}>
            {t('nvClearQuery')}
          </span>
        </button>
      )}
      <style>{`
        @keyframes ku-star-pulse {
          0%, 100% { stroke-opacity: 0.25; r: inherit; }
          50% { stroke-opacity: 0.55; }
        }
        @keyframes ku-active-pulse {
          0%, 100% { stroke-opacity: 0.2; }
          50% { stroke-opacity: 0.45; }
        }
        .ku-star-pulse {
          animation: ku-star-pulse 4s ease-in-out infinite;
        }
        .ku-active-pulse {
          animation: ku-active-pulse 3s ease-in-out infinite;
        }
        g[role="button"]:focus-visible circle:last-of-type {
          stroke: #8B5CF6;
          stroke-width: 3;
        }
        @media (prefers-reduced-motion: reduce) {
          .ku-star-pulse, .ku-active-pulse { animation: none; }
        }
      `}</style>
    </div>
    {previewNote && previewGraphNode && previewNodeId && (
      <CosmosGraphPreviewPanel
        note={previewNote}
        graphNode={previewGraphNode}
        colors={colors}
        importance={selectedImportance}
        onOpenNote={() => onSelect(previewNodeId)}
        onClose={() => setPreviewNodeId(null)}
        layout={compactChrome ? 'sheet' : 'rail'}
      />
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
