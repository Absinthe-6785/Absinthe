/**
 * K-92B3A — Memoized Cosmos SVG graph layers.
 */
import { memo } from 'react';
import type { GraphRelationshipType } from './features/knowledge';
import {
  edgeStrokeColor,
  focusUniverseEdgeOpacity,
  focusUniverseNodeOpacity,
  focusUniverseNodeOpacityByDepth,
  galaxyColor,
  getEdgeVisualStyle,
  getTierVisualStyle,
  resolveEdgeStrokeOpacity,
  type EdgeSemanticKind,
  type GraphNodeTier,
} from './features/knowledge/graph/knowledgeUniverse';
import { shouldShowGraphNodeLabel } from './graphScalePolicy';

export interface CosmosGraphNodeSnapshot {
  id: string;
  title: string;
  folderId: string | null;
  x: number;
  y: number;
  links: number;
  backlinkCount: number;
  importance: number;
  radius: number;
  tier: GraphNodeTier;
  starred?: boolean;
  orbitParentId?: string | null;
  orbitRadius?: number;
  orbitAngle?: number;
  orbitSpeed?: number;
}

export type CosmosDisplayPosNode = Pick<
  CosmosGraphNodeSnapshot,
  'id' | 'x' | 'y' | 'orbitParentId' | 'orbitRadius' | 'orbitAngle' | 'orbitSpeed'
>;

export interface CosmosGraphEdgeSnapshot {
  from: string;
  to: string;
  relationshipType: GraphRelationshipType;
  weight: number;
}

export interface CosmosGraphColors {
  edge: string;
  node: string;
  nodeB: string;
  act: string;
  hovBg: string;
  dimEdge: string;
  dimNode: string;
  dimTxt: string;
}

export interface CosmosGalaxyVisual {
  galaxyId: string;
  centerX: number;
  centerY: number;
  nebulaRadius: number;
  boundaryRadius: number;
  hue: number;
  displayTitle: string;
  nodeCount: number;
  anchorNodeId: string | null;
}

export interface CosmosOrbitPath {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  tier: GraphNodeTier;
}

interface GalaxyLayerProps {
  galaxies: CosmosGalaxyVisual[];
  showGalaxyLabels: boolean;
  suppressDecorations: boolean;
  dark: boolean;
  colors: CosmosGraphColors;
}

export const CosmosGalaxyDecorationLayer = memo(function CosmosGalaxyDecorationLayer({
  galaxies,
  showGalaxyLabels,
  suppressDecorations,
  dark,
  colors,
}: GalaxyLayerProps) {
  if (suppressDecorations || galaxies.length === 0) return null;

  return (
    <>
      {galaxies.map(galaxy => (
        <g key={galaxy.galaxyId} data-ku-galaxy={galaxy.galaxyId}>
          <circle
            cx={galaxy.centerX}
            cy={galaxy.centerY}
            r={galaxy.nebulaRadius}
            fill={galaxyColor(galaxy.hue, dark ? 0.14 : 0.1, dark)}
            stroke="none"
          />
          <circle
            cx={galaxy.centerX}
            cy={galaxy.centerY}
            r={galaxy.boundaryRadius}
            fill="none"
            stroke={galaxyColor(galaxy.hue, dark ? 0.35 : 0.28, dark)}
            strokeWidth={1}
            strokeDasharray="6 8"
            opacity={0.55}
          />
          {galaxy.anchorNodeId && (
            <g>
              <circle
                cx={galaxy.centerX}
                cy={galaxy.centerY}
                r={6}
                fill={galaxyColor(galaxy.hue, 0.55, dark)}
                stroke={colors.act}
                strokeWidth={1}
              />
              <path
                d={`M ${galaxy.centerX - 10} ${galaxy.centerY} L ${galaxy.centerX + 10} ${galaxy.centerY} M ${galaxy.centerX} ${galaxy.centerY - 10} L ${galaxy.centerX} ${galaxy.centerY + 10}`}
                stroke={galaxyColor(galaxy.hue, 0.7, dark)}
                strokeWidth={0.75}
                opacity={0.6}
              />
            </g>
          )}
          {showGalaxyLabels && (
            <text
              x={galaxy.centerX}
              y={galaxy.centerY - galaxy.boundaryRadius - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={galaxyColor(galaxy.hue, dark ? 0.9 : 0.75, dark)}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {galaxy.nodeCount > 1
                ? `${galaxy.displayTitle} (${galaxy.nodeCount})`
                : galaxy.displayTitle}
            </text>
          )}
        </g>
      ))}
    </>
  );
});

interface OrbitLayerProps {
  paths: CosmosOrbitPath[];
  suppressDecorations: boolean;
  colors: CosmosGraphColors;
}

export const CosmosOrbitPathLayer = memo(function CosmosOrbitPathLayer({
  paths,
  suppressDecorations,
  colors,
}: OrbitLayerProps) {
  if (suppressDecorations || paths.length === 0) return null;

  return (
    <>
      {paths.map(path => (
        <circle
          key={path.id}
          cx={path.cx}
          cy={path.cy}
          r={path.radius}
          fill="none"
          stroke={path.tier === 'moon' ? colors.dimEdge : colors.act}
          strokeWidth={path.tier === 'moon' ? 0.75 : 1}
          strokeOpacity={path.tier === 'moon' ? 0.18 : 0.28}
          strokeDasharray={path.tier === 'moon' ? '2 5' : '4 6'}
        />
      ))}
    </>
  );
});

interface EdgeLayerProps {
  edges: CosmosGraphEdgeSnapshot[];
  nodeById: ReadonlyMap<string, CosmosGraphNodeSnapshot>;
  getDisplayPos: (node: CosmosDisplayPosNode) => { x: number; y: number };
  highlightNodeId: string | null;
  hovered: string | null;
  focusDepthMap: ReadonlyMap<string, number> | null;
  focusNeighborhood: ReadonlySet<string> | null;
  matchedIds: ReadonlySet<string> | null;
  hasActiveSelection: boolean;
  suppressDecorations: boolean;
  dark: boolean;
  colors: CosmosGraphColors;
  onHoverEdgeKind: (kind: EdgeSemanticKind | null) => void;
}

export const CosmosEdgeLayer = memo(function CosmosEdgeLayer({
  edges,
  nodeById,
  getDisplayPos,
  highlightNodeId,
  hovered,
  focusDepthMap,
  focusNeighborhood,
  matchedIds,
  hasActiveSelection,
  suppressDecorations,
  dark,
  colors,
  onHoverEdgeKind,
}: EdgeLayerProps) {
  return (
    <>
      {edges.map((e, i) => {
        const a = nodeById.get(e.from);
        const b = nodeById.get(e.to);
        if (!a || !b) return null;
        const posA = getDisplayPos(a);
        const posB = getDisplayPos(b);
        const isAct = e.from === highlightNodeId || e.to === highlightNodeId;
        const isHovEdge = hovered === e.from || hovered === e.to;
        const depthA = focusDepthMap?.get(e.from);
        const depthB = focusDepthMap?.get(e.to);
        const inFocusCluster = focusNeighborhood === null
          || (focusNeighborhood.has(e.from) && focusNeighborhood.has(e.to));
        const isDim = matchedIds !== null
          ? !matchedIds.has(e.from) && !matchedIds.has(e.to)
          : !inFocusCluster;
        const edgeStyle = getEdgeVisualStyle(e.relationshipType, e.weight);
        const focusOpacity = hasActiveSelection
          ? focusUniverseEdgeOpacity(depthA, depthB, true)
          : 1;
        const strokeOpacity = resolveEdgeStrokeOpacity(edgeStyle, {
          isActive: isAct,
          isHovered: isHovEdge,
          isDim,
          focusOpacity,
        });
        const strokeColor = isDim
          ? colors.dimEdge
          : edgeStrokeColor(edgeStyle.kind, dark, colors.act);
        return (
          <line
            key={`${e.from}|${e.to}|${e.relationshipType}|${i}`}
            x1={posA.x}
            y1={posA.y}
            x2={posB.x}
            y2={posB.y}
            stroke={strokeColor}
            strokeWidth={isAct || isHovEdge ? edgeStyle.strokeWidth + 0.75 : edgeStyle.strokeWidth}
            strokeOpacity={strokeOpacity}
            strokeDasharray={edgeStyle.strokeDasharray}
            filter={!suppressDecorations && edgeStyle.glow && !isDim ? 'url(#ku-edge-glow)' : undefined}
            markerEnd={isDim ? 'url(#garr-dim)' : isAct ? 'url(#garr-act)' : 'url(#garr)'}
            onMouseEnter={() => onHoverEdgeKind(edgeStyle.kind)}
            onMouseLeave={() => onHoverEdgeKind(null)}
            style={{ pointerEvents: 'stroke' }}
          />
        );
      })}
    </>
  );
});

interface NodeLayerProps {
  nodes: CosmosGraphNodeSnapshot[];
  graphNodeCount: number;
  transformK: number;
  getFolderColor: (folderId: string | null) => string | null;
  getDisplayPos: (node: CosmosDisplayPosNode) => { x: number; y: number };
  highlightNodeId: string | null;
  hovered: string | null;
  matchedIds: ReadonlySet<string> | null;
  focusDepthMap: ReadonlyMap<string, number> | null;
  focusNeighborhood: ReadonlySet<string> | null;
  hasActiveSelection: boolean;
  suppressDecorations: boolean;
  compactChrome: boolean;
  reducedMotion: boolean;
  dark: boolean;
  colors: CosmosGraphColors;
  untitledLabel: string;
  tierLabels: { star: string; planet: string; moon: string };
  onPreview: (id: string) => void;
  onSelect: (id: string) => void;
  onNodeMouseDown: (e: React.MouseEvent, id: string) => void;
  onHover: (id: string | null) => void;
}

export const CosmosNodeLayer = memo(function CosmosNodeLayer({
  nodes,
  graphNodeCount,
  transformK,
  getFolderColor,
  getDisplayPos,
  highlightNodeId,
  hovered,
  matchedIds,
  focusDepthMap,
  focusNeighborhood,
  hasActiveSelection,
  suppressDecorations,
  compactChrome,
  reducedMotion,
  dark,
  colors,
  untitledLabel,
  tierLabels,
  onPreview,
  onSelect,
  onNodeMouseDown,
  onHover,
}: NodeLayerProps) {
  return (
    <>
      {nodes.map(node => {
        const pos = getDisplayPos(node);
        const tierVisual = getTierVisualStyle(node.radius, node.tier, dark);
        const r = tierVisual.renderRadius;
        const isAct = node.id === highlightNodeId;
        const isHov = node.id === hovered;
        const isMatch = matchedIds !== null && matchedIds.has(node.id);
        const focusDepth = focusDepthMap?.get(node.id);
        const inFocusCluster = focusNeighborhood === null || focusNeighborhood.has(node.id);
        const isDim = matchedIds !== null
          ? !matchedIds.has(node.id)
          : !inFocusCluster;
        const nodeOpacity = isDim
          ? (hasActiveSelection
            ? focusUniverseNodeOpacity(false, true)
            : focusUniverseNodeOpacity(false, false))
          : (hasActiveSelection
            ? focusUniverseNodeOpacityByDepth(focusDepth, true)
            : tierVisual.bodyOpacity);
        const label = node.title.length > 16 ? node.title.slice(0, 15) + '…' : node.title;
        const showLabel = !suppressDecorations && shouldShowGraphNodeLabel({
          nodeCount: graphNodeCount,
          zoomK: transformK,
          isActive: isAct,
          isHovered: isHov,
          isSearchMatch: isMatch,
          isHub: node.tier === 'star',
          nodeTier: node.tier,
          inFocusCluster,
          focusDepth,
          hasSearchFilter: matchedIds !== null,
        });
        const tierLabel = node.tier === 'star'
          ? tierLabels.star
          : node.tier === 'planet'
            ? tierLabels.planet
            : tierLabels.moon;
        const ariaLabel = `${node.title.trim() || 'Untitled'}, ${tierLabel}, ${node.backlinkCount} backlinks, importance ${Math.round(node.importance)}`;
        const folderColor = getFolderColor(node.folderId);
        const nodeFill = isDim
          ? colors.dimNode
          : isAct
            ? colors.act
            : tierVisual.fillTint
              ? (dark ? tierVisual.fillTint + 'AA' : tierVisual.fillTint)
              : folderColor
                ? (dark ? folderColor + '55' : folderColor + '22')
                : colors.node;
        const nodeStroke = isDim
          ? colors.dimEdge
          : isAct || isHov
            ? colors.act
            : isMatch
              ? '#10B981'
              : tierVisual.simplifiedOutline
                ? (dark ? '#71717A' : '#A8A29E')
                : folderColor ?? colors.nodeB;
        const useStarGlow = !suppressDecorations && tierVisual.glowFilter === 'star';
        const usePlanetGlow = !suppressDecorations && tierVisual.glowFilter === 'planet';

        return (
          <g
            key={node.id}
            style={{ cursor: 'pointer', opacity: nodeOpacity }}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            onClick={e => { e.stopPropagation(); onPreview(node.id); }}
            onDoubleClick={e => { e.stopPropagation(); onSelect(node.id); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPreview(node.id);
              }
            }}
            onMouseDown={e => onNodeMouseDown(e, node.id)}
            onMouseEnter={() => onHover(node.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(node.id)}
            onBlur={() => onHover(null)}
          >
            {!suppressDecorations && tierVisual.showCorona && !isDim && (
              <>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 14}
                  fill="none"
                  stroke={colors.act}
                  strokeWidth={1.5}
                  strokeOpacity={0.2}
                  filter="url(#ku-star-glow)"
                  className={reducedMotion ? undefined : 'ku-star-pulse'}
                />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 8}
                  fill="none"
                  stroke={colors.act}
                  strokeWidth={1}
                  strokeOpacity={0.45}
                  className={reducedMotion ? undefined : 'ku-star-pulse'}
                />
              </>
            )}
            {!suppressDecorations && tierVisual.showOrbitRing && !isDim && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r + 5}
                fill="none"
                stroke={colors.act}
                strokeWidth={1}
                strokeOpacity={0.35}
                strokeDasharray="3 4"
              />
            )}
            {isHov && !isDim && (
              <circle cx={pos.x} cy={pos.y} r={r + 9} fill={colors.hovBg} />
            )}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={Math.max(r + 12, compactChrome ? 22 : 18)}
              fill="transparent"
              stroke="none"
              style={{ pointerEvents: 'all' }}
            />
            {isAct && (
              <>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + (compactChrome ? 12 : 10)}
                  fill="none"
                  stroke={colors.act}
                  strokeWidth={compactChrome ? 2 : 1.5}
                  strokeOpacity={compactChrome ? 0.4 : 0.25}
                  className={reducedMotion ? undefined : 'ku-active-pulse'}
                />
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + (compactChrome ? 8 : 6)}
                  fill="none"
                  stroke={colors.act}
                  strokeWidth={compactChrome ? 2.5 : 2}
                  strokeOpacity={compactChrome ? 0.75 : 0.55}
                />
              </>
            )}
            {isMatch && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r + 5}
                fill="none"
                stroke="#10B981"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                strokeDasharray="3 2"
              />
            )}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={r}
              fill={nodeFill}
              stroke={nodeStroke}
              strokeWidth={isAct || isHov || isMatch ? tierVisual.strokeWidth + 0.5 : tierVisual.strokeWidth}
              filter={useStarGlow
                ? 'url(#ku-star-glow)'
                : usePlanetGlow
                  ? 'url(#ku-planet-glow)'
                  : undefined}
            >
              <title>{node.title.trim() || untitledLabel}</title>
            </circle>
            {!suppressDecorations && folderColor && !isAct && !isDim && node.tier !== 'moon' && (
              <circle
                cx={pos.x + r * 0.65}
                cy={pos.y - r * 0.65}
                r={3}
                fill={folderColor}
                opacity={0.9}
              />
            )}
            {!suppressDecorations && node.starred && !isDim && (
              <text
                x={pos.x - r * 0.6}
                y={pos.y - r * 0.5}
                fontSize="9"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                ★
              </text>
            )}
            {showLabel && (
              <text
                x={pos.x}
                y={pos.y + r + 16}
                textAnchor="middle"
                fontSize={(node.tier === 'star' ? 11 : 10) * (transformK > 1.15 ? 1.12 : 1)}
                fill={isDim ? colors.dimTxt : isAct ? colors.act : dark ? '#E4E4E7' : '#1C1917'}
                fontWeight={isAct || isMatch || node.tier === 'star' ? '700' : '500'}
                opacity={isDim ? 0.55 : isAct ? 1 : 0.92}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
});
