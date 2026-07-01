/**
 * K-220 Notes/Cosmos static preview mock contract.
 *
 * This module is static fixture data only. It does not render UI, read stores,
 * call graph builders, call KnowledgeIndexService, persist layout metadata,
 * or replace NoteGraphView / LocalGraphView.
 */

export const NOTES_COSMOS_PREVIEW_NODE_KINDS = [
  'note',
  'cluster',
  'anchor',
  'signal',
  'archiveTrace',
] as const;

export type NotesCosmosPreviewNodeKind = (typeof NOTES_COSMOS_PREVIEW_NODE_KINDS)[number];

export const NOTES_COSMOS_PREVIEW_RELATIONSHIP_KINDS = [
  'related',
  'supports',
  'contrasts',
  'continues',
  'archives',
] as const;

export type NotesCosmosPreviewRelationshipKind =
  (typeof NOTES_COSMOS_PREVIEW_RELATIONSHIP_KINDS)[number];

export const NOTES_COSMOS_PREVIEW_RELATIONSHIP_STRENGTHS = ['weak', 'medium', 'strong'] as const;

export type NotesCosmosPreviewRelationshipStrength =
  (typeof NOTES_COSMOS_PREVIEW_RELATIONSHIP_STRENGTHS)[number];

export const NOTES_COSMOS_PREVIEW_NODE_TONES = [
  'quiet',
  'active',
  'reference',
  'archival',
] as const;

export type NotesCosmosPreviewNodeTone = (typeof NOTES_COSMOS_PREVIEW_NODE_TONES)[number];

export const NOTES_COSMOS_PREVIEW_NODE_STATUSES = [
  'recent',
  'active',
  'steady',
  'archived',
] as const;

export type NotesCosmosPreviewNodeStatus = (typeof NOTES_COSMOS_PREVIEW_NODE_STATUSES)[number];

export const NOTES_COSMOS_PREVIEW_POSITION_RINGS = ['inner', 'middle', 'outer'] as const;

export type NotesCosmosPreviewPositionRing = (typeof NOTES_COSMOS_PREVIEW_POSITION_RINGS)[number];

export const NOTES_COSMOS_PREVIEW_POSITION_DENSITIES = ['low', 'medium', 'high'] as const;

export type NotesCosmosPreviewPositionDensity =
  (typeof NOTES_COSMOS_PREVIEW_POSITION_DENSITIES)[number];

export type NotesCosmosPreviewPositionHint = {
  /**
   * Fixture-only preview planning metadata.
   *
   * This is not persisted, not a schema field, not derived from LocalGraphView,
   * and not saved layout state. It must not contain coordinates.
   */
  ring: NotesCosmosPreviewPositionRing;
  order: number;
  density: NotesCosmosPreviewPositionDensity;
};

export type NotesCosmosPreviewNode = {
  id: string;
  label: string;
  kind: NotesCosmosPreviewNodeKind;
  summary: string;
  tone: NotesCosmosPreviewNodeTone;
  status: NotesCosmosPreviewNodeStatus;
  clusterId: string;
  clusterLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  positionHint?: NotesCosmosPreviewPositionHint;
};

export type NotesCosmosPreviewRelationship = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  kind: NotesCosmosPreviewRelationshipKind;
  strength: NotesCosmosPreviewRelationshipStrength;
};

export type NotesCosmosPreviewCluster = {
  id: string;
  label: string;
  summary: string;
};

export type NotesCosmosPreviewNodeFallbackSummary = {
  id: string;
  label: string;
  summary: string;
  status: string;
  dateLabel: string;
};

export type NotesCosmosPreviewRelationshipFallbackSummary = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
};

export type NotesCosmosPreviewAccessibilityFallback = {
  title: string;
  description: string;
  mobileNote: string;
  nodeOrder: string[];
  nodeSummaries: NotesCosmosPreviewNodeFallbackSummary[];
  relationshipOrder: string[];
  relationshipSummaries: NotesCosmosPreviewRelationshipFallbackSummary[];
};

export type NotesCosmosPreviewResponsiveAcceptance = {
  minMobileWidthPx: 390;
  noHorizontalOverflow: true;
  readableLabels: true;
  noClippedPrimaryContent: true;
  textFallbackRemainsUsable: true;
};

export type NotesCosmosPreviewFixture = {
  id: string;
  title: string;
  description: string;
  nodes: NotesCosmosPreviewNode[];
  relationships: NotesCosmosPreviewRelationship[];
  clusters: NotesCosmosPreviewCluster[];
  fallback: NotesCosmosPreviewAccessibilityFallback;
  responsiveAcceptance: NotesCosmosPreviewResponsiveAcceptance;
  nonGoals: readonly string[];
};

export const NOTES_COSMOS_PREVIEW_SIZE_BUDGET = {
  minNodes: 8,
  maxNodes: 16,
  minRelationships: 10,
  maxRelationships: 24,
} as const;

export const NOTES_COSMOS_PREVIEW_RESPONSIVE_ACCEPTANCE = {
  minMobileWidthPx: 390,
  noHorizontalOverflow: true,
  readableLabels: true,
  noClippedPrimaryContent: true,
  textFallbackRemainsUsable: true,
} as const satisfies NotesCosmosPreviewResponsiveAcceptance;

const clusters: NotesCosmosPreviewCluster[] = [
  {
    id: 'cluster-writing-rhythm',
    label: 'Writing rhythm',
    summary: 'Current notes that keep the writing flow visible.',
  },
  {
    id: 'cluster-health-context',
    label: 'Health context',
    summary: 'Training reflections and recovery notes that explain recent choices.',
  },
  {
    id: 'cluster-long-memory',
    label: 'Long memory',
    summary: 'Older traces that still provide context without becoming the main path.',
  },
];

export const notesCosmosStaticPreviewFixture = {
  id: 'notes-cosmos-static-preview-fixture-v1',
  title: 'Notes Cosmos Static Preview Fixture',
  description:
    'A static, readable fixture for testing a future Notes/Cosmos preview contract without runtime graph data.',
  clusters,
  nodes: [
    {
      id: 'node-today-note',
      label: "Today's note",
      kind: 'anchor',
      summary: 'The current writing focus and the first text item in fallback order.',
      tone: 'active',
      status: 'active',
      clusterId: 'cluster-writing-rhythm',
      clusterLabel: 'Writing rhythm',
      createdAtLabel: 'Today',
      updatedAtLabel: 'Updated today',
      positionHint: { ring: 'inner', order: 1, density: 'medium' },
    },
    {
      id: 'node-week-review',
      label: 'Weekly review',
      kind: 'note',
      summary: 'A quiet review note that summarizes recent choices.',
      tone: 'quiet',
      status: 'recent',
      clusterId: 'cluster-writing-rhythm',
      clusterLabel: 'Writing rhythm',
      createdAtLabel: 'This week',
      updatedAtLabel: 'Updated yesterday',
      positionHint: { ring: 'inner', order: 2, density: 'medium' },
    },
    {
      id: 'node-project-map',
      label: 'Project map',
      kind: 'cluster',
      summary: 'A concept note that groups active writing threads.',
      tone: 'reference',
      status: 'steady',
      clusterId: 'cluster-writing-rhythm',
      clusterLabel: 'Writing rhythm',
      createdAtLabel: 'June 2026',
      updatedAtLabel: 'Updated this week',
      positionHint: { ring: 'middle', order: 3, density: 'medium' },
    },
    {
      id: 'node-training-log',
      label: 'Training log',
      kind: 'note',
      summary: 'A recent note about workout progress and effort.',
      tone: 'active',
      status: 'recent',
      clusterId: 'cluster-health-context',
      clusterLabel: 'Health context',
      createdAtLabel: 'This week',
      updatedAtLabel: 'Updated today',
      positionHint: { ring: 'middle', order: 4, density: 'medium' },
    },
    {
      id: 'node-recovery-plan',
      label: 'Recovery plan',
      kind: 'note',
      summary: 'A supporting note about sleep, food, and recovery rhythm.',
      tone: 'quiet',
      status: 'steady',
      clusterId: 'cluster-health-context',
      clusterLabel: 'Health context',
      createdAtLabel: 'June 2026',
      updatedAtLabel: 'Updated this week',
      positionHint: { ring: 'middle', order: 5, density: 'low' },
    },
    {
      id: 'node-protein-note',
      label: 'Protein note',
      kind: 'signal',
      summary: 'A recent signal about nutrition context, kept literal and readable.',
      tone: 'active',
      status: 'recent',
      clusterId: 'cluster-health-context',
      clusterLabel: 'Health context',
      createdAtLabel: 'This week',
      updatedAtLabel: 'Updated today',
      positionHint: { ring: 'outer', order: 6, density: 'low' },
    },
    {
      id: 'node-archive-thread',
      label: 'Archive thread',
      kind: 'archiveTrace',
      summary: 'An older trace that gives context without replacing Archive.',
      tone: 'archival',
      status: 'archived',
      clusterId: 'cluster-long-memory',
      clusterLabel: 'Long memory',
      createdAtLabel: 'Spring 2026',
      updatedAtLabel: 'Last touched last month',
      positionHint: { ring: 'outer', order: 7, density: 'low' },
    },
    {
      id: 'node-reading-list',
      label: 'Reading list',
      kind: 'note',
      summary: 'A reference note that supports current writing.',
      tone: 'reference',
      status: 'steady',
      clusterId: 'cluster-long-memory',
      clusterLabel: 'Long memory',
      createdAtLabel: 'May 2026',
      updatedAtLabel: 'Updated last week',
      positionHint: { ring: 'outer', order: 8, density: 'medium' },
    },
    {
      id: 'node-design-principles',
      label: 'Design principles',
      kind: 'note',
      summary: 'A stable note that keeps product philosophy visible.',
      tone: 'reference',
      status: 'steady',
      clusterId: 'cluster-writing-rhythm',
      clusterLabel: 'Writing rhythm',
      createdAtLabel: 'April 2026',
      updatedAtLabel: 'Updated last week',
      positionHint: { ring: 'middle', order: 9, density: 'medium' },
    },
    {
      id: 'node-old-program-review',
      label: 'Old program review',
      kind: 'archiveTrace',
      summary: 'A past review that still explains current training choices.',
      tone: 'archival',
      status: 'archived',
      clusterId: 'cluster-long-memory',
      clusterLabel: 'Long memory',
      createdAtLabel: 'March 2026',
      updatedAtLabel: 'Last touched in May',
      positionHint: { ring: 'outer', order: 10, density: 'low' },
    },
  ],
  relationships: [
    {
      id: 'rel-today-week-review',
      sourceId: 'node-today-note',
      targetId: 'node-week-review',
      label: "Today's note continues the weekly review.",
      kind: 'continues',
      strength: 'strong',
    },
    {
      id: 'rel-week-project-map',
      sourceId: 'node-week-review',
      targetId: 'node-project-map',
      label: 'Weekly review supports the project map.',
      kind: 'supports',
      strength: 'medium',
    },
    {
      id: 'rel-project-design-principles',
      sourceId: 'node-project-map',
      targetId: 'node-design-principles',
      label: 'Project map relates to design principles.',
      kind: 'related',
      strength: 'strong',
    },
    {
      id: 'rel-today-training-log',
      sourceId: 'node-today-note',
      targetId: 'node-training-log',
      label: "Today's note references the training log.",
      kind: 'related',
      strength: 'medium',
    },
    {
      id: 'rel-training-recovery',
      sourceId: 'node-training-log',
      targetId: 'node-recovery-plan',
      label: 'Training log is supported by the recovery plan.',
      kind: 'supports',
      strength: 'strong',
    },
    {
      id: 'rel-protein-recovery',
      sourceId: 'node-protein-note',
      targetId: 'node-recovery-plan',
      label: 'Protein note supports the recovery plan.',
      kind: 'supports',
      strength: 'medium',
    },
    {
      id: 'rel-training-old-program',
      sourceId: 'node-training-log',
      targetId: 'node-old-program-review',
      label: 'Training log continues an older program review.',
      kind: 'continues',
      strength: 'medium',
    },
    {
      id: 'rel-old-program-archive',
      sourceId: 'node-old-program-review',
      targetId: 'node-archive-thread',
      label: 'Old program review archives into a longer thread.',
      kind: 'archives',
      strength: 'weak',
    },
    {
      id: 'rel-reading-design',
      sourceId: 'node-reading-list',
      targetId: 'node-design-principles',
      label: 'Reading list supports design principles.',
      kind: 'supports',
      strength: 'medium',
    },
    {
      id: 'rel-archive-reading',
      sourceId: 'node-archive-thread',
      targetId: 'node-reading-list',
      label: 'Archive thread relates to the reading list.',
      kind: 'related',
      strength: 'weak',
    },
    {
      id: 'rel-week-reading',
      sourceId: 'node-week-review',
      targetId: 'node-reading-list',
      label: 'Weekly review contrasts with the reading list.',
      kind: 'contrasts',
      strength: 'weak',
    },
    {
      id: 'rel-project-today',
      sourceId: 'node-project-map',
      targetId: 'node-today-note',
      label: 'Project map keeps today anchored.',
      kind: 'supports',
      strength: 'strong',
    },
  ],
  fallback: {
    title: 'Notes Cosmos static preview',
    description:
      'Text fallback for a static Notes/Cosmos fixture with every node and relationship listed in deterministic order.',
    mobileNote:
      'At 390px width, the text list remains the primary readable representation if visual density becomes too high.',
    nodeOrder: [
      'node-today-note',
      'node-week-review',
      'node-project-map',
      'node-training-log',
      'node-recovery-plan',
      'node-protein-note',
      'node-archive-thread',
      'node-reading-list',
      'node-design-principles',
      'node-old-program-review',
    ],
    nodeSummaries: [
      {
        id: 'node-today-note',
        label: "Today's note",
        summary: 'Anchor: current writing focus. Status active. Updated today.',
        status: 'active',
        dateLabel: 'Today',
      },
      {
        id: 'node-week-review',
        label: 'Weekly review',
        summary: 'Note: summarizes recent choices. Status recent. Updated yesterday.',
        status: 'recent',
        dateLabel: 'This week',
      },
      {
        id: 'node-project-map',
        label: 'Project map',
        summary: 'Cluster: groups active writing threads. Status steady. Updated this week.',
        status: 'steady',
        dateLabel: 'June 2026',
      },
      {
        id: 'node-training-log',
        label: 'Training log',
        summary: 'Note: workout progress and effort. Status recent. Updated today.',
        status: 'recent',
        dateLabel: 'This week',
      },
      {
        id: 'node-recovery-plan',
        label: 'Recovery plan',
        summary: 'Note: sleep, food, and recovery rhythm. Status steady. Updated this week.',
        status: 'steady',
        dateLabel: 'June 2026',
      },
      {
        id: 'node-protein-note',
        label: 'Protein note',
        summary: 'Signal: nutrition context. Status recent. Updated today.',
        status: 'recent',
        dateLabel: 'This week',
      },
      {
        id: 'node-archive-thread',
        label: 'Archive thread',
        summary: 'Archive trace: older context. Status archived. Last touched last month.',
        status: 'archived',
        dateLabel: 'Spring 2026',
      },
      {
        id: 'node-reading-list',
        label: 'Reading list',
        summary: 'Note: reference list for current writing. Status steady. Updated last week.',
        status: 'steady',
        dateLabel: 'May 2026',
      },
      {
        id: 'node-design-principles',
        label: 'Design principles',
        summary: 'Note: product philosophy. Status steady. Updated last week.',
        status: 'steady',
        dateLabel: 'April 2026',
      },
      {
        id: 'node-old-program-review',
        label: 'Old program review',
        summary: 'Archive trace: older training review. Status archived. Last touched in May.',
        status: 'archived',
        dateLabel: 'March 2026',
      },
    ],
    relationshipOrder: [
      'rel-today-week-review',
      'rel-week-project-map',
      'rel-project-design-principles',
      'rel-today-training-log',
      'rel-training-recovery',
      'rel-protein-recovery',
      'rel-training-old-program',
      'rel-old-program-archive',
      'rel-reading-design',
      'rel-archive-reading',
      'rel-week-reading',
      'rel-project-today',
    ],
    relationshipSummaries: [
      {
        id: 'rel-today-week-review',
        sourceId: 'node-today-note',
        targetId: 'node-week-review',
        label: "Today's note continues the weekly review.",
      },
      {
        id: 'rel-week-project-map',
        sourceId: 'node-week-review',
        targetId: 'node-project-map',
        label: 'Weekly review supports the project map.',
      },
      {
        id: 'rel-project-design-principles',
        sourceId: 'node-project-map',
        targetId: 'node-design-principles',
        label: 'Project map relates to design principles.',
      },
      {
        id: 'rel-today-training-log',
        sourceId: 'node-today-note',
        targetId: 'node-training-log',
        label: "Today's note references the training log.",
      },
      {
        id: 'rel-training-recovery',
        sourceId: 'node-training-log',
        targetId: 'node-recovery-plan',
        label: 'Training log is supported by the recovery plan.',
      },
      {
        id: 'rel-protein-recovery',
        sourceId: 'node-protein-note',
        targetId: 'node-recovery-plan',
        label: 'Protein note supports the recovery plan.',
      },
      {
        id: 'rel-training-old-program',
        sourceId: 'node-training-log',
        targetId: 'node-old-program-review',
        label: 'Training log continues an older program review.',
      },
      {
        id: 'rel-old-program-archive',
        sourceId: 'node-old-program-review',
        targetId: 'node-archive-thread',
        label: 'Old program review archives into a longer thread.',
      },
      {
        id: 'rel-reading-design',
        sourceId: 'node-reading-list',
        targetId: 'node-design-principles',
        label: 'Reading list supports design principles.',
      },
      {
        id: 'rel-archive-reading',
        sourceId: 'node-archive-thread',
        targetId: 'node-reading-list',
        label: 'Archive thread relates to the reading list.',
      },
      {
        id: 'rel-week-reading',
        sourceId: 'node-week-review',
        targetId: 'node-reading-list',
        label: 'Weekly review contrasts with the reading list.',
      },
      {
        id: 'rel-project-today',
        sourceId: 'node-project-map',
        targetId: 'node-today-note',
        label: 'Project map keeps today anchored.',
      },
    ],
  },
  responsiveAcceptance: NOTES_COSMOS_PREVIEW_RESPONSIVE_ACCEPTANCE,
  nonGoals: [
    'No runtime UI implementation.',
    'No graph or canvas rendering.',
    'No persisted spatial metadata.',
    'No schema, store, provider, or persistence changes.',
    'No live graph data reads.',
    'No remote data transfer behavior.',
    'No replacement of NoteGraphView or LocalGraphView.',
  ],
} as const satisfies NotesCosmosPreviewFixture;

export type NotesCosmosPreviewFixtureValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateNotesCosmosPreviewFixture(
  fixture: NotesCosmosPreviewFixture,
): NotesCosmosPreviewFixtureValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const relationshipIds = new Set<string>();

  if (
    fixture.nodes.length < NOTES_COSMOS_PREVIEW_SIZE_BUDGET.minNodes ||
    fixture.nodes.length > NOTES_COSMOS_PREVIEW_SIZE_BUDGET.maxNodes
  ) {
    errors.push('node count is outside the preview fixture budget');
  }

  if (
    fixture.relationships.length < NOTES_COSMOS_PREVIEW_SIZE_BUDGET.minRelationships ||
    fixture.relationships.length > NOTES_COSMOS_PREVIEW_SIZE_BUDGET.maxRelationships
  ) {
    errors.push('relationship count is outside the preview fixture budget');
  }

  for (const node of fixture.nodes) {
    if (nodeIds.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    if (!node.label || !node.summary || !node.clusterId || !node.clusterLabel) {
      errors.push(`node is missing readable text fields: ${node.id}`);
    }
  }

  for (const relationship of fixture.relationships) {
    if (relationshipIds.has(relationship.id)) {
      errors.push(`duplicate relationship id: ${relationship.id}`);
    }
    relationshipIds.add(relationship.id);
    if (!nodeIds.has(relationship.sourceId)) {
      errors.push(`relationship source is missing: ${relationship.id}`);
    }
    if (!nodeIds.has(relationship.targetId)) {
      errors.push(`relationship target is missing: ${relationship.id}`);
    }
    if (!relationship.label) {
      errors.push(`relationship is missing label: ${relationship.id}`);
    }
  }

  for (const nodeId of fixture.fallback.nodeOrder) {
    if (!nodeIds.has(nodeId)) errors.push(`fallback node order references missing node: ${nodeId}`);
  }

  for (const relationshipId of fixture.fallback.relationshipOrder) {
    if (!relationshipIds.has(relationshipId)) {
      errors.push(`fallback relationship order references missing relationship: ${relationshipId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
