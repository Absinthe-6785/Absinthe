import { describe, expect, it } from 'vitest';

import {
  K332_ACTIVATION_PREREQUISITES,
  K332_ARCHITECTURE_ERRORS,
  K332_CONTRACT_VERSION,
  K332_EVIDENCE_KINDS,
  K332_RESPONSIBILITY_MATRIX,
  evaluateK332Architecture,
  type K332ArchitectureEvidenceArtifact,
  type K332ContractBinding,
  type K332DormantRegistration,
  type K332EvaluationInput,
  type K332EvidenceKind,
} from './crossModuleSourceAuthorityK332.testSupport';

const binding: K332ContractBinding = Object.freeze({
  namespaceDigest: 'namespace-digest',
  physicalSourceDigest: 'physical-source-digest',
  generationDigest: 'generation-digest',
  writerSessionDigest: 'writer-session-digest',
});

const registration: K332DormantRegistration = Object.freeze({
  lifecycle: 'dormant',
  evidenceClass: 'architecture_fixture',
  binding,
});

function artifact(
  kind: K332EvidenceKind,
  overrides: Partial<K332ArchitectureEvidenceArtifact> = {},
): K332ArchitectureEvidenceArtifact {
  return Object.freeze({
    kind,
    contractVersion: K332_CONTRACT_VERSION,
    capabilityVersion: 'successor-capability-v1',
    binding,
    ...overrides,
  });
}

function input(
  overrides: Partial<K332EvaluationInput> = {},
): K332EvaluationInput {
  return Object.freeze({
    registration,
    artifacts: Object.freeze(K332_EVIDENCE_KINDS.map(kind => artifact(kind))),
    sourceDigestAtStart: binding.physicalSourceDigest,
    sourceDigestAtEnd: binding.physicalSourceDigest,
    ...overrides,
  });
}

function without(kind: K332EvidenceKind): K332EvaluationInput {
  return input({
    artifacts: Object.freeze(K332_EVIDENCE_KINDS
      .filter(candidate => candidate !== kind)
      .map(candidate => artifact(candidate))),
  });
}

describe('K-332 cross-module source authority and protocol contract', () => {
  it('keeps the complete predecessor/successor responsibility inventory non-overlapping', () => {
    expect(K332_RESPONSIBILITY_MATRIX.map(row => row.task)).toEqual([
      'K-325', 'K-326', 'K-327', 'K-328', 'K-329', 'K-330', 'K-331',
      'K-332', 'K-333', 'K-334', 'later runtime integration',
    ]);

    const k332 = K332_RESPONSIBILITY_MATRIX.find(row => row.task === 'K-332');
    const k333 = K332_RESPONSIBILITY_MATRIX.find(row => row.task === 'K-333');
    const k334 = K332_RESPONSIBILITY_MATRIX.find(row => row.task === 'K-334');
    const runtime = K332_RESPONSIBILITY_MATRIX.find(row => row.task === 'later runtime integration');

    expect(k332?.owns).toEqual([
      'cross-module contract intake',
      'successor handoff',
      'activation dependency graph',
      'atomicity responsibility split',
    ]);
    expect(k333?.owns).toContain('production canonical codecs');
    expect(k334?.owns).toContain('atomic repository transactions');
    expect(runtime?.owns).toContain('eligibility and activation');
    expect(k332?.owns).not.toContain('production canonical codecs');
    expect(k332?.owns).not.toContain('atomic repository transactions');
    expect(k332?.owns).not.toContain('eligibility and activation');
    expect(K332_RESPONSIBILITY_MATRIX
      .filter(row => ['K-325', 'K-326', 'K-328', 'K-330'].includes(row.task))
      .every(row => row.implementationLevel === 'dormant_production_foundation')).toBe(true);
  });

  it('defines explicit, monotonic prerequisites for every activation state', () => {
    expect(Object.keys(K332_ACTIVATION_PREREQUISITES)).toEqual([
      'unregistered', 'dormant', 'architecture_admissible', 'protocol_capable',
      'repository_capable', 'shadow_capable', 'production_eligible', 'activated',
    ]);
    expect(K332_ACTIVATION_PREREQUISITES.protocol_capable)
      .toContain('k333_protocol_capability');
    expect(K332_ACTIVATION_PREREQUISITES.repository_capable)
      .toEqual(expect.arrayContaining(['protocol_capable', 'k334_repository_capability', 'atomicity_evidence']));
    expect(K332_ACTIVATION_PREREQUISITES.production_eligible)
      .toEqual(expect.arrayContaining(['shadow_capable', 'runtime_wiring', 'production_evidence']));
    expect(K332_ACTIVATION_PREREQUISITES.activated)
      .toEqual(['production_eligible', 'future_atomic_activation_commit']);
  });

  it('walks only the permitted architecture sequence and cannot bypass an intermediate state', () => {
    expect(evaluateK332Architecture(input({ registration: null, artifacts: [] })).state)
      .toBe('unregistered');
    expect(evaluateK332Architecture(input({ artifacts: [] })).state).toBe('dormant');
    expect(evaluateK332Architecture(input({ artifacts: [artifact('architecture_contract')] })).state)
      .toBe('architecture_admissible');
    expect(evaluateK332Architecture(input({ artifacts: [
      artifact('architecture_contract'), artifact('protocol_capability'),
    ] })).state).toBe('protocol_capable');
    expect(evaluateK332Architecture(input({ artifacts: [
      artifact('architecture_contract'), artifact('protocol_capability'),
      artifact('repository_capability'), artifact('atomicity_evidence'),
    ] })).state).toBe('repository_capable');
    expect(evaluateK332Architecture(input()).state).toBe('shadow_capable');
  });

  it.each([
    ['architecture_contract', 'ARCHITECTURE_CONTRACT_INCOMPLETE'],
    ['protocol_capability', 'PROTOCOL_CAPABILITY_MISSING'],
    ['repository_capability', 'REPOSITORY_CAPABILITY_MISSING'],
    ['atomicity_evidence', 'ATOMICITY_EVIDENCE_MISSING'],
    ['compatibility_evidence', 'COMPATIBILITY_EVIDENCE_MISSING'],
    ['authority_graph', 'AUTHORITY_GRAPH_INCOMPLETE'],
    ['migration_handoff', 'MIGRATION_HANDOFF_UNRESOLVED'],
    ['bootstrap_restore_authority', 'BOOTSTRAP_RESTORE_INCOMPLETE'],
    ['writer_session', 'WRITER_SESSION_STALE'],
    ['terminal_outbox_authority', 'TERMINAL_OUTBOX_AUTHORITY_MISSING'],
    ['shadow_verification', 'SHADOW_VERIFICATION_MISSING'],
    ['runtime_wiring', 'RUNTIME_WIRING_MISSING'],
  ] as const)('fails closed when %s is absent', (kind, expectedError) => {
    const result = evaluateK332Architecture(without(kind));
    expect(result.blockers).toContain(expectedError);
    expect(result.eligible).toBe(false);
    expect(result.activated).toBe(false);
  });

  it('rejects incomplete binding, incompatible versions, and a changing source', () => {
    const bindingMismatch = evaluateK332Architecture(input({
      artifacts: K332_EVIDENCE_KINDS.map(kind => artifact(kind, kind === 'authority_graph'
        ? { binding: { ...binding, generationDigest: 'different-generation' } }
        : {})),
    }));
    expect(bindingMismatch.blockers).toContain('AUTHORITY_GRAPH_INCOMPLETE');

    const versionMismatch = evaluateK332Architecture(input({
      artifacts: K332_EVIDENCE_KINDS.map(kind => artifact(kind, kind === 'repository_capability'
        ? { capabilityVersion: 'incompatible-successor-version' }
        : {})),
    }));
    expect(versionMismatch.blockers).toContain('VERSION_INCOMPATIBLE');

    const changedSource = evaluateK332Architecture(input({
      sourceDigestAtEnd: 'changed-physical-source-digest',
    }));
    expect(changedSource.blockers).toContain('SOURCE_CHANGED_DURING_EVALUATION');
  });

  it('rejects duplicate evidence instead of selecting a caller-preferred copy', () => {
    const artifacts = K332_EVIDENCE_KINDS.map(kind => artifact(kind));
    artifacts.push(artifact('protocol_capability'));
    const result = evaluateK332Architecture(input({ artifacts }));

    expect(result.state).toBe('architecture_admissible');
    expect(result.blockers).toContain('PROTOCOL_CAPABILITY_MISSING');
    expect(result.eligible).toBe(false);
  });

  it('keeps protocol-only, repository-without-protocol, and runtime-only evidence ineligible', () => {
    const protocolOnly = evaluateK332Architecture(input({ artifacts: [
      artifact('architecture_contract'), artifact('protocol_capability'),
    ] }));
    expect(protocolOnly.state).toBe('protocol_capable');
    expect(protocolOnly.blockers).toContain('REPOSITORY_CAPABILITY_MISSING');

    const repositoryWithoutProtocol = evaluateK332Architecture(input({ artifacts: [
      artifact('architecture_contract'), artifact('repository_capability'),
      artifact('atomicity_evidence'),
    ] }));
    expect(repositoryWithoutProtocol.state).toBe('architecture_admissible');
    expect(repositoryWithoutProtocol.blockers).toContain('PROTOCOL_CAPABILITY_MISSING');

    const runtimeOnly = evaluateK332Architecture(input({ artifacts: [artifact('runtime_wiring')] }));
    expect(runtimeOnly.state).toBe('dormant');
    expect(runtimeOnly.eligible).toBe(false);
  });

  it('treats protocol plus repository plus runtime as insufficient without the complete graph', () => {
    const result = evaluateK332Architecture(input({ artifacts: [
      artifact('architecture_contract'), artifact('protocol_capability'),
      artifact('repository_capability'), artifact('atomicity_evidence'),
      artifact('runtime_wiring'),
    ] }));
    expect(result.state).toBe('repository_capable');
    expect(result.blockers).toEqual(expect.arrayContaining([
      'COMPATIBILITY_EVIDENCE_MISSING',
      'AUTHORITY_GRAPH_INCOMPLETE',
      'MIGRATION_HANDOFF_UNRESOLVED',
      'BOOTSTRAP_RESTORE_INCOMPLETE',
      'WRITER_SESSION_STALE',
      'TERMINAL_OUTBOX_AUTHORITY_MISSING',
      'SHADOW_VERIFICATION_MISSING',
    ]));
    expect(result.eligible).toBe(false);
  });

  it('cannot mistake architecture fixtures or a caller ready flag for production evidence', () => {
    const complete = evaluateK332Architecture(input());
    expect(complete.state).toBe('shadow_capable');
    expect(complete.blockers).toEqual([
      'ARCHITECTURE_FIXTURE_NOT_PRODUCTION_EVIDENCE',
      'PRODUCTION_ACTIVATION_NOT_IMPLEMENTED',
    ]);

    const callerOverride = evaluateK332Architecture({
      ...input(),
      callerReady: true,
      activated: true,
    } as unknown as K332EvaluationInput);
    expect(callerOverride).toEqual(complete);
    expect(callerOverride.eligible).toBe(false);
    expect(callerOverride.activated).toBe(false);
  });

  it('emits and tests every architecture error with no reserved code', () => {
    const emitted = new Set<string>();
    emitted.add(evaluateK332Architecture(input({ registration: null })).blockers[0]);
    for (const kind of K332_EVIDENCE_KINDS) {
      for (const blocker of evaluateK332Architecture(without(kind)).blockers) emitted.add(blocker);
    }
    for (const blocker of evaluateK332Architecture(input({
      artifacts: K332_EVIDENCE_KINDS.map(kind => artifact(kind, kind === 'protocol_capability'
        ? { contractVersion: 'unsupported-k332-contract' }
        : {})),
      sourceDigestAtEnd: 'changed-physical-source-digest',
    })).blockers) emitted.add(blocker);

    expect([...emitted].sort()).toEqual([...K332_ARCHITECTURE_ERRORS].sort());
  });

  it('preserves the current production eligibility verdict', () => {
    const result = evaluateK332Architecture(input());
    expect(result).toMatchObject({
      state: 'shadow_capable',
      eligible: false,
      activated: false,
    });
    expect(result.blockers).toContain('PRODUCTION_ACTIVATION_NOT_IMPLEMENTED');
  });
});
