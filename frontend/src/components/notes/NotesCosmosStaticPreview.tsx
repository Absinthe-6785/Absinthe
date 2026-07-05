import type { ReactElement } from 'react';
import {
  notesCosmosStaticPreviewFixture,
  type NotesCosmosPreviewFixture,
  type NotesCosmosPreviewNode,
  type NotesCosmosPreviewRelationship,
} from '../../lib/notesCosmosStaticPreviewMockContract';

type NotesCosmosStaticPreviewProps = {
  fixture?: NotesCosmosPreviewFixture;
  className?: string;
};

function orderedByIds<T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(items.map(item => [item.id, item]));
  return ids.map(id => byId.get(id)).filter((item): item is T => Boolean(item));
}

function nodeLabel(node: NotesCosmosPreviewNode | undefined, fallback: string): string {
  return node?.label ?? fallback;
}

type SignalTier = {
  id: 'primary' | 'secondary' | 'faint';
  label: 'Primary signal' | 'Secondary signal' | 'Faint signal';
  description: string;
  itemClassName: string;
  badgeClassName: string;
};

const SIGNAL_TIERS: Record<SignalTier['id'], SignalTier> = {
  primary: {
    id: 'primary',
    label: 'Primary signal',
    description: 'Current anchor or active writing focus.',
    itemClassName: 'border-slate-300 bg-white shadow-sm ring-1 ring-slate-200',
    badgeClassName: 'border-slate-300 bg-slate-950 text-white',
  },
  secondary: {
    id: 'secondary',
    label: 'Secondary signal',
    description: 'Supporting note, reference, or recent context.',
    itemClassName: 'border-slate-200 bg-white',
    badgeClassName: 'border-slate-200 bg-white text-slate-700',
  },
  faint: {
    id: 'faint',
    label: 'Faint signal',
    description: 'Older archive trace kept visible without competing.',
    itemClassName: 'border-slate-100 bg-slate-50/80',
    badgeClassName: 'border-slate-200 bg-slate-50 text-slate-600',
  },
};

function signalTierForNode(node: NotesCosmosPreviewNode): SignalTier {
  if (node.kind === 'anchor' || node.status === 'active') {
    return SIGNAL_TIERS.primary;
  }

  if (node.kind === 'archiveTrace' || node.status === 'archived' || node.tone === 'archival') {
    return SIGNAL_TIERS.faint;
  }

  return SIGNAL_TIERS.secondary;
}

function SignalReadout({ nodes }: { nodes: NotesCosmosPreviewNode[] }): ReactElement {
  const primary = nodes.filter(node => signalTierForNode(node).id === 'primary');
  const secondaryCount = nodes.filter(node => signalTierForNode(node).id === 'secondary').length;
  const faintCount = nodes.filter(node => signalTierForNode(node).id === 'faint').length;

  return (
    <section
      className="mt-4 max-w-full min-w-0"
      aria-label="Static signal hierarchy readout"
    >
      <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Signal readout
      </p>
      <div className="mt-2 grid max-w-full grid-cols-1 gap-2 md:grid-cols-3">
        <div className="min-w-0 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Primary signal
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-950">
            {nodeLabel(primary[0], 'No primary anchor')}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            Current focus from the static fixture.
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Secondary signals
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-950">
            {secondaryCount} supporting records
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            Recent and reference context stays nearby.
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Faint signals
          </p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-800">
            {faintCount} archive traces
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-600">
            Older context remains readable and quiet.
          </p>
        </div>
      </div>
    </section>
  );
}

function NodesByCluster({
  fixture,
  nodes,
}: {
  fixture: NotesCosmosPreviewFixture;
  nodes: NotesCosmosPreviewNode[];
}): ReactElement {
  return (
    <section className="space-y-3" aria-labelledby="notes-cosmos-preview-nodes">
      <h3 id="notes-cosmos-preview-nodes" className="text-sm font-semibold text-slate-950">
        Nodes
      </h3>
      <div className="grid max-w-full grid-cols-1 gap-3 lg:grid-cols-3">
        {fixture.clusters.map(cluster => {
          const clusterNodes = nodes.filter(node => node.clusterId === cluster.id);
          return (
            <section
              key={cluster.id}
              className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
              aria-labelledby={`${cluster.id}-heading`}
            >
              <h4
                id={`${cluster.id}-heading`}
                className="break-words text-sm font-semibold text-slate-900"
              >
                {cluster.label}
              </h4>
              <p className="mt-1 break-words text-xs leading-5 text-slate-600">{cluster.summary}</p>
              <ol className="mt-3 space-y-2">
                {clusterNodes.map(node => {
                  const signalTier = signalTierForNode(node);
                  return (
                    <li
                      key={node.id}
                      className={`min-w-0 rounded-md border p-2 ${signalTier.itemClassName}`}
                      data-node-id={node.id}
                      data-node-kind={node.kind}
                      data-node-status={node.status}
                      data-node-tone={node.tone}
                      data-signal-tier={signalTier.id}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <strong className="break-words text-sm text-slate-950">
                          {node.label}
                        </strong>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[11px] ${signalTier.badgeClassName}`}
                        >
                          Signal tier: {signalTier.label}
                        </span>
                        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700">
                          Kind: {node.kind}
                        </span>
                        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700">
                          Status: {node.status}
                        </span>
                        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700">
                          Tone: {node.tone}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-700">
                        {node.summary}
                      </p>
                      <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">
                        {signalTier.description} Cluster: {node.clusterLabel}. Created:{' '}
                        {node.createdAtLabel}. Freshness: {node.updatedAtLabel}.
                      </p>
                      {node.positionHint ? (
                        <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">
                          Static grouping: {node.positionHint.ring} ring, order{' '}
                          {node.positionHint.order}, {node.positionHint.density} density.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function RelationshipsList({
  relationships,
  nodes,
}: {
  relationships: NotesCosmosPreviewRelationship[];
  nodes: NotesCosmosPreviewNode[];
}): ReactElement {
  const nodeById = new Map(nodes.map(node => [node.id, node]));

  return (
    <section className="space-y-3" aria-labelledby="notes-cosmos-preview-relationships">
      <h3 id="notes-cosmos-preview-relationships" className="text-sm font-semibold text-slate-950">
        Relationships
      </h3>
      <ol className="grid max-w-full grid-cols-1 gap-2 md:grid-cols-2">
        {relationships.map(relationship => {
          const source = nodeById.get(relationship.sourceId);
          const target = nodeById.get(relationship.targetId);
          return (
            <li
              key={relationship.id}
              className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
              data-relationship-id={relationship.id}
              data-relationship-kind={relationship.kind}
            >
              <p className="break-words text-sm font-medium text-slate-950">
                {relationship.label}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                From {nodeLabel(source, relationship.sourceId)} to{' '}
                {nodeLabel(target, relationship.targetId)}.
              </p>
              <p className="mt-1 break-words text-[11px] leading-4 text-slate-500">
                Kind: {relationship.kind}. Strength: {relationship.strength}.
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AccessibilityFallback({ fixture }: { fixture: NotesCosmosPreviewFixture }): ReactElement {
  return (
    <section className="space-y-3" aria-labelledby="notes-cosmos-preview-fallback">
      <h3 id="notes-cosmos-preview-fallback" className="text-sm font-semibold text-slate-950">
        Text fallback
      </h3>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h4 className="break-words text-sm font-semibold text-slate-900">
          {fixture.fallback.title}
        </h4>
        <p className="mt-1 break-words text-xs leading-5 text-slate-600">
          {fixture.fallback.description}
        </p>
        <p className="mt-1 break-words text-xs leading-5 text-slate-600">
          {fixture.fallback.mobileNote}
        </p>
      </div>
      <div className="grid max-w-full grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <h4 className="text-sm font-semibold text-slate-900">Node order</h4>
          <ol className="mt-2 space-y-2">
            {fixture.fallback.nodeSummaries.map(summary => (
              <li key={summary.id} className="break-words text-xs leading-5 text-slate-700">
                <strong>{summary.label}</strong>: {summary.summary} Date: {summary.dateLabel}.
              </li>
            ))}
          </ol>
        </section>
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <h4 className="text-sm font-semibold text-slate-900">Relationship order</h4>
          <ol className="mt-2 space-y-2">
            {fixture.fallback.relationshipSummaries.map(summary => (
              <li key={summary.id} className="break-words text-xs leading-5 text-slate-700">
                {summary.label} Source: {summary.sourceId}. Target: {summary.targetId}.
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}

export function NotesCosmosStaticPreview({
  fixture = notesCosmosStaticPreviewFixture,
  className = '',
}: NotesCosmosStaticPreviewProps): ReactElement {
  const orderedNodes = orderedByIds(fixture.nodes, fixture.fallback.nodeOrder);
  const orderedRelationships = orderedByIds(
    fixture.relationships,
    fixture.fallback.relationshipOrder,
  );

  return (
    <article
      className={`notes-cosmos-static-preview w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-900 ${className}`}
      aria-labelledby="notes-cosmos-static-preview-title"
      data-notes-cosmos-static-preview
      data-min-mobile-width={fixture.responsiveAcceptance.minMobileWidthPx}
    >
      <header className="max-w-full min-w-0 border-b border-slate-200 pb-4">
        <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">
          Read-only signal preview
        </p>
        <h2
          id="notes-cosmos-static-preview-title"
          className="mt-1 break-words text-xl font-semibold text-slate-950"
        >
          {fixture.title}
        </h2>
        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-700">
          {fixture.description}
        </p>
        <p className="mt-2 break-words text-xs leading-5 text-slate-600">
          Read-only fixture: {fixture.nodes.length} nodes, {fixture.relationships.length}{' '}
          relationships, {fixture.clusters.length} clusters. Mobile acceptance:{' '}
          {fixture.responsiveAcceptance.minMobileWidthPx}px minimum, no horizontal overflow,
          readable labels, no clipped primary content.
        </p>
        <SignalReadout nodes={orderedNodes} />
      </header>

      <div className="mt-4 space-y-5">
        <NodesByCluster fixture={fixture} nodes={orderedNodes} />
        <RelationshipsList relationships={orderedRelationships} nodes={orderedNodes} />
        <AccessibilityFallback fixture={fixture} />
      </div>
    </article>
  );
}

export default NotesCosmosStaticPreview;
