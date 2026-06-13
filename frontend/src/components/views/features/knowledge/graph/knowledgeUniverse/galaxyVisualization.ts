export interface GalaxyVisualNode {
  id: string;
  x: number;
  y: number;
  galaxyId: string;
  galaxyLabel: string;
  tier: 'star' | 'planet' | 'moon';
}

export interface GalaxyVisual {
  galaxyId: string;
  label: string;
  displayTitle: string;
  centerX: number;
  centerY: number;
  boundaryRadius: number;
  nebulaRadius: number;
  nodeCount: number;
  starCount: number;
  anchorNodeId: string | null;
  hue: number;
}

const GALAXY_PALETTE = [265, 210, 190, 160, 320, 240, 280, 200];

function galaxyHue(galaxyId: string): number {
  let hash = 0;
  for (let i = 0; i < galaxyId.length; i += 1) {
    hash = (hash * 31 + galaxyId.charCodeAt(i)) % GALAXY_PALETTE.length;
  }
  return GALAXY_PALETTE[hash] ?? 265;
}

function formatGalaxyTitle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return 'Uncategorized Galaxy';
  if (/galaxy$/i.test(trimmed)) return trimmed;
  return `${trimmed} Galaxy`;
}

/** Build nebula + boundary metadata for visible galaxy clusters. */
export function buildGalaxyVisuals(
  nodes: readonly GalaxyVisualNode[],
  anchorByGalaxyId: ReadonlyMap<string, string | null>,
): GalaxyVisual[] {
  const groups = new Map<string, GalaxyVisualNode[]>();
  for (const node of nodes) {
    const bucket = groups.get(node.galaxyId) ?? [];
    bucket.push(node);
    groups.set(node.galaxyId, bucket);
  }

  const visuals: GalaxyVisual[] = [];
  for (const [galaxyId, members] of groups) {
    if (members.length === 0) continue;
    const label = members[0]?.galaxyLabel ?? 'Uncategorized';
    let centerX = 0;
    let centerY = 0;
    let maxDist = 48;
    for (const member of members) {
      centerX += member.x;
      centerY += member.y;
    }
    centerX /= members.length;
    centerY /= members.length;
    for (const member of members) {
      const dx = member.x - centerX;
      const dy = member.y - centerY;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy) + 36);
    }

    const anchorNodeId = anchorByGalaxyId.get(galaxyId) ?? null;
    const anchor = anchorNodeId ? members.find(m => m.id === anchorNodeId) : members.find(m => m.tier === 'star');
    if (anchor) {
      centerX = anchor.x;
      centerY = anchor.y;
    }

    visuals.push({
      galaxyId,
      label,
      displayTitle: formatGalaxyTitle(label),
      centerX,
      centerY,
      boundaryRadius: maxDist + 24,
      nebulaRadius: maxDist + 56,
      nodeCount: members.length,
      starCount: members.filter(m => m.tier === 'star').length,
      anchorNodeId: anchor?.id ?? anchorNodeId,
      hue: galaxyHue(galaxyId),
    });
  }

  return visuals.sort((a, b) => b.nodeCount - a.nodeCount);
}

export function galaxyColor(hue: number, alpha: number, dark: boolean): string {
  const sat = dark ? 42 : 55;
  const light = dark ? 58 : 88;
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}
