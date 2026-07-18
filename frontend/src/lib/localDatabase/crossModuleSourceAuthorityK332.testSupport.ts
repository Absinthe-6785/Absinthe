/**
 * K-332 deterministic architecture evidence only.
 *
 * This module deliberately has no production imports, persistence, codec, browser,
 * network, or runtime activation behavior. K-333 owns production protocol
 * representation and K-334 owns durable repository implementation.
 */

export const K332_CONTRACT_VERSION = 'k332-cross-module-contract-v1' as const;

export type K332ActivationState =
  | 'unregistered'
  | 'dormant'
  | 'architecture_admissible'
  | 'protocol_capable'
  | 'repository_capable'
  | 'shadow_capable'
  | 'production_eligible'
  | 'activated';

export const K332_ARCHITECTURE_ERRORS = Object.freeze([
  'REGISTRATION_MISSING',
  'ARCHITECTURE_CONTRACT_INCOMPLETE',
  'PROTOCOL_CAPABILITY_MISSING',
  'REPOSITORY_CAPABILITY_MISSING',
  'ATOMICITY_EVIDENCE_MISSING',
  'COMPATIBILITY_EVIDENCE_MISSING',
  'AUTHORITY_GRAPH_INCOMPLETE',
  'MIGRATION_HANDOFF_UNRESOLVED',
  'BOOTSTRAP_RESTORE_INCOMPLETE',
  'WRITER_SESSION_STALE',
  'TERMINAL_OUTBOX_AUTHORITY_MISSING',
  'SHADOW_VERIFICATION_MISSING',
  'VERSION_INCOMPATIBLE',
  'SOURCE_CHANGED_DURING_EVALUATION',
  'RUNTIME_WIRING_MISSING',
  'ARCHITECTURE_FIXTURE_NOT_PRODUCTION_EVIDENCE',
  'PRODUCTION_ACTIVATION_NOT_IMPLEMENTED',
] as const);

export type K332ArchitectureError = typeof K332_ARCHITECTURE_ERRORS[number];

export const K332_EVIDENCE_KINDS = Object.freeze([
  'architecture_contract',
  'protocol_capability',
  'repository_capability',
  'atomicity_evidence',
  'compatibility_evidence',
  'authority_graph',
  'migration_handoff',
  'bootstrap_restore_authority',
  'writer_session',
  'terminal_outbox_authority',
  'shadow_verification',
  'runtime_wiring',
] as const);

export type K332EvidenceKind = typeof K332_EVIDENCE_KINDS[number];

export interface K332ContractBinding {
  readonly namespaceDigest: string;
  readonly physicalSourceDigest: string;
  readonly generationDigest: string;
  readonly writerSessionDigest: string;
}

/**
 * An abstract, test-only proof token. It intentionally is not a production
 * envelope or codec and cannot be persisted by this module.
 */
export interface K332ArchitectureEvidenceArtifact {
  readonly kind: K332EvidenceKind;
  readonly contractVersion: string;
  readonly capabilityVersion: string;
  readonly binding: K332ContractBinding;
}

export interface K332DormantRegistration {
  readonly lifecycle: 'dormant';
  readonly evidenceClass: 'architecture_fixture';
  readonly binding: K332ContractBinding;
}

export interface K332EvaluationInput {
  readonly registration: K332DormantRegistration | null;
  readonly artifacts: readonly K332ArchitectureEvidenceArtifact[];
  readonly sourceDigestAtStart: string;
  readonly sourceDigestAtEnd: string;
}

export interface K332EvaluationResult {
  readonly state: K332ActivationState;
  readonly eligible: false;
  readonly activated: false;
  readonly blockers: readonly K332ArchitectureError[];
}

export interface K332ResponsibilityRow {
  readonly task: string;
  readonly owns: readonly string[];
  readonly doesNotOwn: readonly string[];
  readonly implementationLevel:
    | 'dormant_production_foundation'
    | 'architecture_and_test_evidence'
    | 'future';
}

export const K332_RESPONSIBILITY_MATRIX: readonly K332ResponsibilityRow[] = Object.freeze([
  Object.freeze({
    task: 'K-325',
    owns: Object.freeze(['legacy Notes capture', 'verified inactive migration generation', 'source authority and root binding']),
    doesNotOwn: Object.freeze(['generation activation', 'production source transactions']),
    implementationLevel: 'dormant_production_foundation',
  }),
  Object.freeze({
    task: 'K-326',
    owns: Object.freeze(['dormant cutover transaction', 'runtime mode and active-generation atomicity', 'legacy freeze contract']),
    doesNotOwn: Object.freeze(['real-source handoff', 'production writer admission']),
    implementationLevel: 'dormant_production_foundation',
  }),
  Object.freeze({
    task: 'K-327',
    owns: Object.freeze(['cross-context handoff architecture', 'physical-source lock identity', 'immutable snapshot contract']),
    doesNotOwn: Object.freeze(['production handoff adapter', 'writer registry']),
    implementationLevel: 'architecture_and_test_evidence',
  }),
  Object.freeze({
    task: 'K-328',
    owns: Object.freeze(['dormant read-only handoff foundation', 'production-shaped persistence topology', 'browser durability evidence']),
    doesNotOwn: Object.freeze(['production source invocation', 'writer activation']),
    implementationLevel: 'dormant_production_foundation',
  }),
  Object.freeze({
    task: 'K-329',
    owns: Object.freeze(['writer-set proof', 'eligibility preconditions', 'canonical coordination evidence contract']),
    doesNotOwn: Object.freeze(['durable registry', 'production eligibility']),
    implementationLevel: 'architecture_and_test_evidence',
  }),
  Object.freeze({
    task: 'K-330',
    owns: Object.freeze(['dormant durable registry envelope', 'admission reducer', 'coordination CAS repository']),
    doesNotOwn: Object.freeze(['source mutation transaction', 'production callers']),
    implementationLevel: 'dormant_production_foundation',
  }),
  Object.freeze({
    task: 'K-331',
    owns: Object.freeze(['source authority architecture', 'receipt lineage', 'bootstrap, restore, reconciliation, and drain validity requirements']),
    doesNotOwn: Object.freeze(['production protocol codecs', 'source transaction repository', 'runtime instrumentation']),
    implementationLevel: 'architecture_and_test_evidence',
  }),
  Object.freeze({
    task: 'K-332',
    owns: Object.freeze(['cross-module contract intake', 'successor handoff', 'activation dependency graph', 'atomicity responsibility split']),
    doesNotOwn: Object.freeze(['production codecs', 'durable source stores', 'runtime activation']),
    implementationLevel: 'architecture_and_test_evidence',
  }),
  Object.freeze({
    task: 'K-333',
    owns: Object.freeze(['production canonical codecs', 'strict decoders', 'proof formats and verification', 'stable protocol errors and compatibility']),
    doesNotOwn: Object.freeze(['IndexedDB stores', 'runtime writer wiring']),
    implementationLevel: 'future',
  }),
  Object.freeze({
    task: 'K-334',
    owns: Object.freeze(['additive source stores and indexes', 'schema migration', 'atomic repository transactions', 'production lookup repositories']),
    doesNotOwn: Object.freeze(['new protocol semantics', 'runtime writer wiring']),
    implementationLevel: 'future',
  }),
  Object.freeze({
    task: 'later runtime integration',
    owns: Object.freeze(['writer registration and interception', 'coordination client', 'shadow rollout', 'eligibility and activation']),
    doesNotOwn: Object.freeze(['rewriting K-332 contract', 'inventing K-333 or K-334 authority semantics']),
    implementationLevel: 'future',
  }),
]);

export const K332_ACTIVATION_PREREQUISITES: Readonly<Record<K332ActivationState, readonly string[]>> =
  Object.freeze({
    unregistered: Object.freeze([]),
    dormant: Object.freeze(['dormant_registration']),
    architecture_admissible: Object.freeze(['dormant_registration', 'architecture_contract']),
    protocol_capable: Object.freeze([
      'architecture_admissible', 'k333_protocol_capability', 'compatible_contract_versions',
    ]),
    repository_capable: Object.freeze([
      'protocol_capable', 'k334_repository_capability', 'atomicity_evidence',
    ]),
    shadow_capable: Object.freeze([
      'repository_capable', 'authority_graph', 'migration_handoff', 'bootstrap_restore_authority',
      'current_writer_session', 'terminal_outbox_authority', 'shadow_verification',
      'stable_source_observation',
    ]),
    production_eligible: Object.freeze([
      'shadow_capable', 'runtime_wiring', 'production_evidence', 'future_activation_policy',
    ]),
    activated: Object.freeze([
      'production_eligible', 'future_atomic_activation_commit',
    ]),
  });

const REQUIRED_AFTER_REPOSITORY: readonly K332EvidenceKind[] = Object.freeze([
  'atomicity_evidence',
  'compatibility_evidence',
  'authority_graph',
  'migration_handoff',
  'bootstrap_restore_authority',
  'writer_session',
  'terminal_outbox_authority',
  'shadow_verification',
]);

const BLOCKER_FOR_KIND: Readonly<Partial<Record<K332EvidenceKind, K332ArchitectureError>>> =
  Object.freeze({
    architecture_contract: 'ARCHITECTURE_CONTRACT_INCOMPLETE',
    protocol_capability: 'PROTOCOL_CAPABILITY_MISSING',
    repository_capability: 'REPOSITORY_CAPABILITY_MISSING',
    atomicity_evidence: 'ATOMICITY_EVIDENCE_MISSING',
    compatibility_evidence: 'COMPATIBILITY_EVIDENCE_MISSING',
    authority_graph: 'AUTHORITY_GRAPH_INCOMPLETE',
    migration_handoff: 'MIGRATION_HANDOFF_UNRESOLVED',
    bootstrap_restore_authority: 'BOOTSTRAP_RESTORE_INCOMPLETE',
    writer_session: 'WRITER_SESSION_STALE',
    terminal_outbox_authority: 'TERMINAL_OUTBOX_AUTHORITY_MISSING',
    shadow_verification: 'SHADOW_VERIFICATION_MISSING',
    runtime_wiring: 'RUNTIME_WIRING_MISSING',
  });

function sameBinding(left: K332ContractBinding, right: K332ContractBinding): boolean {
  return left.namespaceDigest === right.namespaceDigest
    && left.physicalSourceDigest === right.physicalSourceDigest
    && left.generationDigest === right.generationDigest
    && left.writerSessionDigest === right.writerSessionDigest;
}

function addBlocker(blockers: K332ArchitectureError[], blocker: K332ArchitectureError): void {
  if (!blockers.includes(blocker)) blockers.push(blocker);
}

function artifactMap(
  artifacts: readonly K332ArchitectureEvidenceArtifact[],
): ReadonlyMap<K332EvidenceKind, K332ArchitectureEvidenceArtifact> {
  const result = new Map<K332EvidenceKind, K332ArchitectureEvidenceArtifact>();
  const duplicates = new Set<K332EvidenceKind>();
  for (const artifact of artifacts) {
    if (result.has(artifact.kind) || duplicates.has(artifact.kind)) {
      result.delete(artifact.kind);
      duplicates.add(artifact.kind);
    } else {
      result.set(artifact.kind, artifact);
    }
  }
  return result;
}

/**
 * Evaluates the K-332 activation dependency graph. Its return type makes
 * production eligibility and activation impossible in this task.
 */
export function evaluateK332Architecture(input: K332EvaluationInput): K332EvaluationResult {
  const blockers: K332ArchitectureError[] = [];
  const artifacts = artifactMap(input.artifacts);
  let state: K332ActivationState = 'unregistered';

  if (input.registration === null) {
    addBlocker(blockers, 'REGISTRATION_MISSING');
  } else {
    state = 'dormant';
  }

  for (const kind of K332_EVIDENCE_KINDS) {
    if (!artifacts.has(kind)) {
      const blocker = BLOCKER_FOR_KIND[kind];
      if (blocker !== undefined) addBlocker(blockers, blocker);
    }
  }

  if (input.registration !== null) {
    for (const artifact of input.artifacts) {
      if (!sameBinding(artifact.binding, input.registration.binding)) {
        addBlocker(blockers, 'AUTHORITY_GRAPH_INCOMPLETE');
      }
      if (artifact.contractVersion !== K332_CONTRACT_VERSION) {
        addBlocker(blockers, 'VERSION_INCOMPATIBLE');
      }
    }

    const protocol = artifacts.get('protocol_capability');
    const repository = artifacts.get('repository_capability');
    const compatibility = artifacts.get('compatibility_evidence');
    if (protocol !== undefined && repository !== undefined
      && protocol.capabilityVersion !== repository.capabilityVersion) {
      addBlocker(blockers, 'VERSION_INCOMPATIBLE');
    }
    if (protocol !== undefined && compatibility !== undefined
      && protocol.capabilityVersion !== compatibility.capabilityVersion) {
      addBlocker(blockers, 'VERSION_INCOMPATIBLE');
    }
  }

  if (input.sourceDigestAtStart !== input.sourceDigestAtEnd) {
    addBlocker(blockers, 'SOURCE_CHANGED_DURING_EVALUATION');
  }

  const architecture = artifacts.get('architecture_contract');
  const protocol = artifacts.get('protocol_capability');
  const repository = artifacts.get('repository_capability');

  if (input.registration !== null && architecture !== undefined
    && architecture.contractVersion === K332_CONTRACT_VERSION
    && sameBinding(architecture.binding, input.registration.binding)) {
    state = 'architecture_admissible';
  }

  if (state === 'architecture_admissible' && protocol !== undefined
    && protocol.contractVersion === K332_CONTRACT_VERSION) {
    state = 'protocol_capable';
  }

  if (state === 'protocol_capable' && repository !== undefined
    && protocol !== undefined
    && repository.contractVersion === K332_CONTRACT_VERSION
    && repository.capabilityVersion === protocol.capabilityVersion
    && artifacts.has('atomicity_evidence')) {
    state = 'repository_capable';
  }

  const shadowBlockers = new Set<K332ArchitectureError>([
    'AUTHORITY_GRAPH_INCOMPLETE',
    'MIGRATION_HANDOFF_UNRESOLVED',
    'BOOTSTRAP_RESTORE_INCOMPLETE',
    'WRITER_SESSION_STALE',
    'TERMINAL_OUTBOX_AUTHORITY_MISSING',
    'SHADOW_VERIFICATION_MISSING',
    'VERSION_INCOMPATIBLE',
    'SOURCE_CHANGED_DURING_EVALUATION',
    'ATOMICITY_EVIDENCE_MISSING',
    'COMPATIBILITY_EVIDENCE_MISSING',
  ]);
  if (state === 'repository_capable'
    && REQUIRED_AFTER_REPOSITORY.every(kind => artifacts.has(kind))
    && !blockers.some(blocker => shadowBlockers.has(blocker))) {
    state = 'shadow_capable';
  }

  addBlocker(blockers, 'ARCHITECTURE_FIXTURE_NOT_PRODUCTION_EVIDENCE');
  addBlocker(blockers, 'PRODUCTION_ACTIVATION_NOT_IMPLEMENTED');

  return Object.freeze({
    state,
    eligible: false,
    activated: false,
    blockers: Object.freeze(blockers),
  });
}
