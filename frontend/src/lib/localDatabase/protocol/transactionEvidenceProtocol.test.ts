import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../outboxIdentity';
import { buildCanonicalProtocolPreimage, digestCanonicalProtocolRecord } from './canonicalProtocolPreimage';
import { encodeCanonicalProtocolValue } from './canonicalProtocolValue';
import type { ProtocolResult } from './protocolResult';
import {
  TRANSACTION_EVIDENCE_COMPATIBILITY,
  TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES,
  createAdmissionRecord,
  createImmutableOutboxIntentRecord,
  createOperationRecord,
  createTerminalStateRecord,
  decodeAdmissionRecord,
  decodeImmutableOutboxIntentRecord,
  decodeOperationRecord,
  decodeTerminalStateRecord,
  decodeTransactionEvidenceRecord,
  decodeTransactionEvidenceRecordBytes,
  deriveExactOperationDigest,
  deriveOperationRegistryRoot,
  deriveOutboxRoot,
  deriveTerminalRoot,
  encodeTransactionEvidenceRecord,
  validateProductionTransactionEvidenceGraph,
  validateTransactionEvidenceCompatibility,
  type AdmissionRecord,
  type ImmutableOutboxIntentRecord,
  type OperationRecord,
  type TerminalStateRecord,
  type TransactionEvidenceRecord,
} from './transactionEvidenceProtocol';
import {
  createSourceAuthorityRecord,
  createSourceTransactionReferenceRecord,
  createWriterIdentityRecord,
  createWriterSessionRecord,
  decodeSourceAuthorityRecord,
  decodeSourceTransactionReferenceRecord,
} from './writerAuthorityProtocol';

const digest = (character: string): string => character.repeat(64);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

type ExpectedCompatibilityEdge = Readonly<{
  predecessor: string;
  successor: string;
  tuple: readonly [string, 1, string, 1];
}>;

const EXPECTED_TRANSACTION_EVIDENCE_EDGES: readonly ExpectedCompatibilityEdge[] = Object.freeze([
  Object.freeze({ predecessor: 'writer', successor: 'operation',
    tuple: Object.freeze(['absinthe_writer_identity', 1, 'absinthe_k330_operation', 1] as const) }),
  Object.freeze({ predecessor: 'session', successor: 'operation',
    tuple: Object.freeze(['absinthe_writer_session', 1, 'absinthe_k330_operation', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'admission',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_k330_admission', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'outbox',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_immutable_outbox_intent', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'terminal',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_terminal_state', 1] as const) }),
  Object.freeze({ predecessor: 'operation', successor: 'reference',
    tuple: Object.freeze(['absinthe_k330_operation', 1, 'absinthe_source_transaction_reference', 1] as const) }),
  Object.freeze({ predecessor: 'admission', successor: 'reference',
    tuple: Object.freeze(['absinthe_k330_admission', 1, 'absinthe_source_transaction_reference', 1] as const) }),
  Object.freeze({ predecessor: 'outbox', successor: 'reference',
    tuple: Object.freeze(['absinthe_immutable_outbox_intent', 1, 'absinthe_source_transaction_reference', 1] as const) }),
  Object.freeze({ predecessor: 'terminal', successor: 'reference',
    tuple: Object.freeze(['absinthe_terminal_state', 1, 'absinthe_source_transaction_reference', 1] as const) }),
] as const);

const expectedCompatibilityTuples = (): readonly (readonly [string, 1, string, 1])[] =>
  EXPECTED_TRANSACTION_EVIDENCE_EDGES.map(edge => edge.tuple);

const selectorPairKey = (edge: Pick<ExpectedCompatibilityEdge, 'predecessor' | 'successor'>): string =>
  `${edge.predecessor}\u0000${edge.successor}`;

const completeEdgeKey = (edge: ExpectedCompatibilityEdge): string => JSON.stringify([
  edge.predecessor, edge.successor, ...edge.tuple,
]);

const sourceDecoderBindings = Object.freeze([
  Object.freeze(['graph', 'decodeExactObject'] as const),
  Object.freeze(['writer', 'decodeWriterIdentityRecord'] as const),
  Object.freeze(['session', 'decodeWriterSessionRecord'] as const),
  Object.freeze(['authority', 'decodeSourceAuthorityRecord'] as const),
  Object.freeze(['reference', 'decodeSourceTransactionReferenceRecord'] as const),
  Object.freeze(['operation', 'decodeOperationRecord'] as const),
  Object.freeze(['admission', 'decodeAdmissionRecord'] as const),
  Object.freeze(['outbox', 'decodeImmutableOutboxIntentRecord'] as const),
  Object.freeze(['terminal', 'decodeTerminalStateRecord'] as const),
] as const);

interface SourceStructureAnalysis {
  readonly issues: readonly string[];
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)
    || ts.isTypeAssertionExpression(current)) current = current.expression;
  return current;
}

function unwrapFrozenExpression(expression: ts.Expression): ts.Expression | undefined {
  const current = unwrapExpression(expression);
  if (!ts.isCallExpression(current) || current.arguments.length !== 1 || !ts.isPropertyAccessExpression(current.expression)) {
    return undefined;
  }
  return ts.isIdentifier(current.expression.expression) && current.expression.expression.text === 'Object'
    && current.expression.name.text === 'freeze'
    ? unwrapExpression(current.arguments[0])
    : undefined;
}

function declarationFromStatement(statement: ts.Statement): ts.VariableDeclaration | undefined {
  return ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1
    ? statement.declarationList.declarations[0]
    : undefined;
}

function identifierText(node: ts.Node | undefined): string | undefined {
  return node !== undefined && ts.isIdentifier(node) ? node.text : undefined;
}

function callName(expression: ts.Expression | undefined): string | undefined {
  const current = expression === undefined ? undefined : unwrapExpression(expression);
  return current !== undefined && ts.isCallExpression(current) ? identifierText(current.expression) : undefined;
}

function isFailureReturn(statement: ts.Statement | undefined, binding: string): boolean {
  if (statement === undefined || !ts.isIfStatement(statement) || statement.elseStatement !== undefined) return false;
  const condition = statement.expression;
  const isNotOk = ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken
    && ts.isPropertyAccessExpression(condition.operand)
    && identifierText(condition.operand.expression) === binding
    && condition.operand.name.text === 'ok';
  const returned = ts.isReturnStatement(statement.thenStatement)
    && identifierText(statement.thenStatement.expression) === binding;
  return isNotOk && returned;
}

function isSelectorDeclaration(statement: ts.Statement | undefined, binding: string, selector: string): boolean {
  const declaration = statement === undefined ? undefined : declarationFromStatement(statement);
  if (declaration === undefined || identifierText(declaration.name) !== binding || declaration.initializer === undefined) return false;
  const initializer = unwrapExpression(declaration.initializer);
  return ts.isElementAccessExpression(initializer)
    && identifierText(initializer.expression) === 'compatibleRecords'
    && ts.isPropertyAccessExpression(initializer.argumentExpression)
    && identifierText(initializer.argumentExpression.expression) === 'edge'
    && initializer.argumentExpression.name.text === selector;
}

function isCompatibilityCallDeclaration(statement: ts.Statement | undefined): boolean {
  const declaration = statement === undefined ? undefined : declarationFromStatement(statement);
  return declaration !== undefined && identifierText(declaration.name) === 'compatible'
    && callName(declaration.initializer) === 'validateTransactionEvidenceCompatibility';
}

function findTopLevelDeclaration(sourceFile: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
  for (const statement of sourceFile.statements) {
    const declaration = declarationFromStatement(statement);
    if (declaration !== undefined && identifierText(declaration.name) === name) return declaration;
  }
  return undefined;
}

function extractSourceEdgeInventory(sourceFile: ts.SourceFile, issues: string[]): readonly ExpectedCompatibilityEdge[] {
  const declaration = findTopLevelDeclaration(sourceFile, 'TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES');
  const array = declaration?.initializer === undefined ? undefined : unwrapFrozenExpression(declaration.initializer);
  if (array === undefined || !ts.isArrayLiteralExpression(array)) {
    issues.push('edge_inventory_missing');
    return [];
  }
  const edges: ExpectedCompatibilityEdge[] = [];
  for (const entry of array.elements) {
    if (!ts.isExpression(entry)) {
      issues.push('edge_inventory_entry_invalid');
      continue;
    }
    const object = unwrapFrozenExpression(entry);
    if (object === undefined || !ts.isObjectLiteralExpression(object)) {
      issues.push('edge_inventory_entry_invalid');
      continue;
    }
    const property = (name: string): ts.Expression | undefined => {
      const assignment = object.properties.find(candidate => ts.isPropertyAssignment(candidate)
        && candidate.name.getText(sourceFile) === name);
      return assignment !== undefined && ts.isPropertyAssignment(assignment) ? assignment.initializer : undefined;
    };
    const predecessor = property('predecessor');
    const successor = property('successor');
    const tuple = property('tuple');
    const tupleArray = tuple === undefined ? undefined : unwrapFrozenExpression(tuple);
    if (!ts.isStringLiteral(predecessor) || !ts.isStringLiteral(successor) || tupleArray === undefined
      || !ts.isArrayLiteralExpression(tupleArray) || tupleArray.elements.length !== 4
      || !ts.isStringLiteral(tupleArray.elements[0]) || !ts.isNumericLiteral(tupleArray.elements[1])
      || !ts.isStringLiteral(tupleArray.elements[2]) || !ts.isNumericLiteral(tupleArray.elements[3])) {
      issues.push('edge_inventory_entry_invalid');
      continue;
    }
    edges.push(Object.freeze({
      predecessor: predecessor.text,
      successor: successor.text,
      tuple: Object.freeze([
        tupleArray.elements[0].text,
        Number(tupleArray.elements[1].text) as 1,
        tupleArray.elements[2].text,
        Number(tupleArray.elements[3].text) as 1,
      ] as const),
    }));
  }
  if (JSON.stringify(edges) !== JSON.stringify(EXPECTED_TRANSACTION_EVIDENCE_EDGES)) {
    issues.push('edge_inventory_mismatch');
  }
  return edges;
}

function countCalls(node: ts.Node, expectedName: string): number {
  let count = 0;
  const visit = (current: ts.Node): void => {
    if (ts.isCallExpression(current) && callName(current) === expectedName) count += 1;
    ts.forEachChild(current, visit);
  };
  visit(node);
  return count;
}

function analyzeTransactionEvidenceStructure(source: string): SourceStructureAnalysis {
  const sourceFile = ts.createSourceFile('transactionEvidenceProtocol.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const issues: string[] = [];
  if (sourceFile.parseDiagnostics.length > 0) issues.push('source_parse_error');
  extractSourceEdgeInventory(sourceFile, issues);
  const target = sourceFile.statements.find(statement => ts.isFunctionDeclaration(statement)
    && statement.name?.text === 'validateProductionTransactionEvidenceGraph');
  if (target === undefined || !ts.isFunctionDeclaration(target) || target.body === undefined) {
    return { issues: Object.freeze([...issues, 'target_function_missing']) };
  }
  const statements = [...target.body.statements];
  const loopIndex = statements.findIndex(statement => ts.isForOfStatement(statement));
  const loop = loopIndex < 0 ? undefined : statements[loopIndex];
  if (loop === undefined || !ts.isForOfStatement(loop)
    || identifierText(loop.initializer.kind === ts.SyntaxKind.VariableDeclarationList
      ? loop.initializer.declarations[0]?.name : undefined) !== 'edge'
    || identifierText(unwrapExpression(loop.expression)) !== 'TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES'
    || !ts.isBlock(loop.statement)) {
    return { issues: Object.freeze([...issues, 'compatibility_loop_missing']) };
  }
  for (const [binding, decoder] of sourceDecoderBindings) {
    const declarationIndex = statements.findIndex(statement => {
      const declaration = declarationFromStatement(statement);
      return declaration !== undefined && identifierText(declaration.name) === binding && callName(declaration.initializer) === decoder;
    });
    if (declarationIndex < 0 || declarationIndex >= loopIndex
      || !isFailureReturn(statements[declarationIndex + 1], binding)) {
      issues.push('completed_decode_boundary');
      break;
    }
  }
  const loopStatements = [...loop.statement.statements];
  if (!isSelectorDeclaration(loopStatements[0], 'predecessor', 'predecessor')
    || !isSelectorDeclaration(loopStatements[1], 'successor', 'successor')) {
    issues.push('compatibility_pre_call_structure');
  }
  if (!isCompatibilityCallDeclaration(loopStatements[2])
    || countCalls(loop.statement, 'validateTransactionEvidenceCompatibility') !== 1) {
    issues.push('compatibility_call_count');
  }
  if (!isFailureReturn(loopStatements[3], 'compatible') || loopStatements.length !== 4) {
    issues.push('compatibility_failure_propagation');
  }
  const relationshipIndex = statements.findIndex(statement => {
    const declaration = declarationFromStatement(statement);
    return declaration !== undefined && callName(declaration.initializer) === 'validateRepresentativeAuthorityGraph';
  });
  if (relationshipIndex <= loopIndex || countCalls(loop.statement, 'validateRepresentativeAuthorityGraph') !== 0) {
    issues.push('relationship_after_compatibility');
  }
  return { issues: Object.freeze(issues) };
}

function replaceOnce(source: string, needle: string, replacement: string): string {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Mutation anchor missing: ${needle.slice(0, 48)}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + needle.length)}`;
}

function moveRepresentativeValidationBeforeLoop(source: string): string {
  const start = source.indexOf('  const representative = validateRepresentativeAuthorityGraph({');
  const end = source.indexOf('\n  const op = operation.value;', start);
  const loop = source.indexOf('  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {');
  if (start < 0 || end < 0 || loop < 0) throw new Error('Representative mutation anchor missing');
  const fragment = source.slice(start, end);
  const without = `${source.slice(0, start)}${source.slice(end)}`;
  const targetLoop = without.indexOf('  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {');
  return `${without.slice(0, targetLoop)}${fragment}\n${without.slice(targetLoop)}`;
}

function must<T>(result: ProtocolResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

function errorCode(result: ProtocolResult<unknown>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

function fixtures() {
  const writer = must(createWriterIdentityRecord({
    id: 'writer-v2.window.interactive.0001', namespaceId: 'namespace-1', physicalSourceDigest: digest('1'),
    writerTypeId: 'legacy.notes.store_actions', manifestDigest: digest('2'),
  }));
  const session = must(createWriterSessionRecord({
    id: 'session-1', namespaceId: writer.namespaceId, generationId: 'generation-1',
    physicalSourceDigest: writer.physicalSourceDigest, writerId: writer.id, writerDigest: writer.writerDigest,
    epoch: 7, capabilityDigest: digest('3'),
  }));
  const exactOperationInput = {
    id: 'operation-1', namespace: writer.namespaceId, generation: session.generationId,
    admissionId: 'admission-1',
    writerId: writer.id, writerDigest: writer.writerDigest, sessionId: session.id, sessionDigest: session.sessionDigest,
    mutationKind: 'note_upsert', committedRevision: '42', affectedIdentityDigest: digest('4'),
    canonicalInputDigest: digest('5'), resultDigest: digest('6'), outboxId: 'outbox-1', outboxIntentDigest: digest('7'),
  } as const;
  const exactOperationDigest = must(deriveExactOperationDigest(exactOperationInput));
  const admission = must(createAdmissionRecord({
    id: exactOperationInput.admissionId, operationId: exactOperationInput.id, writerId: writer.id, sessionId: session.id,
    exactOperationDigest, decision: 'admitted',
  }));
  const operation = must(createOperationRecord({
    ...exactOperationInput, admissionDigest: admission.admissionDigest, exactOperationDigest,
  }));
  const outbox = must(createImmutableOutboxIntentRecord({
    id: operation.outboxId, operationId: operation.id, intentDigest: operation.outboxIntentDigest,
    exactOperationDigest,
  }));
  const terminal = must(createTerminalStateRecord({
    id: 'terminal-1', operationId: operation.id, state: 'committed', resultDigest: operation.resultDigest,
    exactOperationDigest,
  }));
  const authority = must(createSourceAuthorityRecord({
    id: 'authority-1', namespaceId: writer.namespaceId, generationId: session.generationId,
    physicalSourceDigest: writer.physicalSourceDigest, sourceRevision: operation.committedRevision,
    operationRegistryRoot: must(deriveOperationRegistryRoot(operation.operationDigest)),
    terminalRoot: must(deriveTerminalRoot(terminal.terminalDigest)),
    outboxRoot: must(deriveOutboxRoot(outbox.outboxDigest)),
    mmrStateId: 'mmr-1', mmrStateDigest: digest('b'), lifecycleHeadId: null, lifecycleHeadDigest: null,
  }));
  const reference = must(createSourceTransactionReferenceRecord({
    id: 'reference-1', namespaceId: writer.namespaceId, generationId: session.generationId,
    physicalSourceDigest: writer.physicalSourceDigest, committedSourceRevision: operation.committedRevision,
    sourceAuthorityId: authority.id, sourceAuthorityDigest: authority.authorityDigest,
    operationId: operation.id, operationDigest: operation.operationDigest,
    admissionId: admission.id, admissionDigest: admission.admissionDigest,
    writerId: writer.id, writerDigest: writer.writerDigest, sessionId: session.id, sessionDigest: session.sessionDigest,
    terminalId: terminal.id, terminalDigest: terminal.terminalDigest,
    outboxId: outbox.id, outboxDigest: outbox.outboxDigest,
    mmrStateId: authority.mmrStateId, mmrStateDigest: authority.mmrStateDigest,
    checkpointId: 'checkpoint-1', checkpointDigest: digest('c'), graphVersion: 1,
  }));
  return { writer, session, admission, operation, outbox, terminal, authority, reference };
}

function inputs(record: TransactionEvidenceRecord): Record<string, unknown> {
  const self = record.kind === 'absinthe_k330_operation' ? 'operationDigest'
    : record.kind === 'absinthe_k330_admission' ? 'admissionDigest'
      : record.kind === 'absinthe_immutable_outbox_intent' ? 'outboxDigest' : 'terminalDigest';
  return Object.fromEntries(Object.entries(record)
    .filter(([field]) => field !== 'kind' && field !== 'version' && field !== self));
}

function createChangedOperation(record: OperationRecord, overrides: Record<string, unknown>): OperationRecord {
  const input = { ...inputs(record), ...overrides };
  const { admissionDigest: _admissionDigest, exactOperationDigest: _exactOperationDigest, ...exactInput } = input;
  return must(createOperationRecord({
    ...input,
    exactOperationDigest: must(deriveExactOperationDigest(exactInput)),
  }));
}

function resealAuthority(graph: ReturnType<typeof fixtures>, overrides: Record<string, unknown>) {
  const { kind: _kind, version: _version, authorityDigest: _authorityDigest, ...input } = graph.authority;
  return must(createSourceAuthorityRecord({ ...input, ...overrides }));
}

function resealReference(graph: ReturnType<typeof fixtures>, overrides: Record<string, unknown>) {
  const { kind: _kind, version: _version, referenceDigest: _referenceDigest, ...input } = graph.reference;
  return must(createSourceTransactionReferenceRecord({ ...input, ...overrides }));
}

function sameIdOperationVariant(
  graph: ReturnType<typeof fixtures>,
  overrides: Record<string, unknown>,
): ReturnType<typeof fixtures> {
  const operationInput = { ...inputs(graph.operation), ...overrides };
  const { admissionDigest: _admissionDigest, exactOperationDigest: _exactOperationDigest, ...exactInput } = operationInput;
  const exactOperationDigest = must(deriveExactOperationDigest(exactInput));
  const admission = must(createAdmissionRecord({
    ...inputs(graph.admission),
    exactOperationDigest,
  }));
  const operation = must(createOperationRecord({
    ...operationInput,
    admissionDigest: admission.admissionDigest,
    exactOperationDigest,
  }));
  const outbox = must(createImmutableOutboxIntentRecord({
    ...inputs(graph.outbox),
    intentDigest: operation.outboxIntentDigest,
    exactOperationDigest,
  }));
  const terminal = must(createTerminalStateRecord({
    ...inputs(graph.terminal),
    resultDigest: operation.resultDigest,
    exactOperationDigest,
  }));
  const authority = resealAuthority(graph, {
    sourceRevision: operation.committedRevision,
    operationRegistryRoot: must(deriveOperationRegistryRoot(operation.operationDigest)),
    terminalRoot: must(deriveTerminalRoot(terminal.terminalDigest)),
    outboxRoot: must(deriveOutboxRoot(outbox.outboxDigest)),
  });
  const reference = resealReference(graph, {
    committedSourceRevision: operation.committedRevision,
    sourceAuthorityDigest: authority.authorityDigest,
    operationDigest: operation.operationDigest,
    admissionDigest: admission.admissionDigest,
    terminalDigest: terminal.terminalDigest,
    outboxDigest: outbox.outboxDigest,
  });
  return { ...graph, operation, admission, outbox, terminal, authority, reference };
}

const creators = {
  absinthe_k330_operation: createOperationRecord,
  absinthe_k330_admission: createAdmissionRecord,
  absinthe_immutable_outbox_intent: createImmutableOutboxIntentRecord,
  absinthe_terminal_state: createTerminalStateRecord,
} as const;

describe('K-333B transaction evidence record codecs', () => {
  it('creates, strictly decodes, freezes, and canonically round trips each selected record', () => {
    const graph = fixtures();
    const records: readonly TransactionEvidenceRecord[] = [graph.operation, graph.admission, graph.outbox, graph.terminal];
    for (const record of records) {
      const decoded = decodeTransactionEvidenceRecord(record);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) continue;
      expect(Object.isFrozen(decoded.value)).toBe(true);
      const bytes = must(encodeTransactionEvidenceRecord(record));
      expect(must(decodeTransactionEvidenceRecordBytes(bytes))).toEqual(record);
      expect(must(encodeCanonicalProtocolValue(record))).toEqual(bytes);
    }
  });

  it('rejects kind, version, missing, unknown, primitive, array, and self-digest corruption exactly', () => {
    const { operation, admission, outbox, terminal } = fixtures();
    const cases = [
      [decodeOperationRecord, operation, 'operationDigest'],
      [decodeAdmissionRecord, admission, 'admissionDigest'],
      [decodeImmutableOutboxIntentRecord, outbox, 'outboxDigest'],
      [decodeTerminalStateRecord, terminal, 'terminalDigest'],
    ] as const;
    for (const [decode, record, self] of cases) {
      expect(errorCode(decode({ ...record, kind: 'wrong' }))).toBe('RECORD_KIND_MISMATCH');
      expect(errorCode(decode({ ...record, version: 2 }))).toBe('UNSUPPORTED_RECORD_VERSION');
      const missing = { ...record } as Record<string, unknown>;
      delete missing.id;
      expect(errorCode(decode(missing))).toBe('MISSING_FIELD');
      expect(errorCode(decode({ ...record, extra: true }))).toBe('UNKNOWN_FIELD');
      expect(errorCode(decode({ ...record, [self]: digest('f') }))).toBe('CANONICAL_DIGEST_MISMATCH');
      for (const hostile of [null, 1, 'record', [], true]) {
        expect(errorCode(decode(hostile))).toBe('INVALID_FIELD_TYPE');
      }
    }
  });

  it('rejects malformed field classes and closed semantic values', () => {
    const { operation, admission, outbox, terminal } = fixtures();
    expect(errorCode(decodeOperationRecord({ ...operation, id: 'Invalid' }))).toBe('INVALID_IDENTIFIER');
    expect(errorCode(decodeOperationRecord({ ...operation, writerDigest: 'bad' }))).toBe('INVALID_DIGEST');
    expect(errorCode(decodeOperationRecord({ ...operation, committedRevision: '042' }))).toBe('INVALID_INTEGER');
    expect(errorCode(decodeOperationRecord({ ...operation, mutationKind: 'note_delete' }))).toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeAdmissionRecord({ ...admission, decision: 'rejected' }))).toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeTerminalStateRecord({ ...terminal, state: 'pending' }))).toBe('INVALID_ENUM_VALUE');
    expect(errorCode(decodeImmutableOutboxIntentRecord({ ...outbox, intentDigest: 'bad' }))).toBe('INVALID_DIGEST');
  });

  it('keeps every creator and decoder total over active, throwing, and revoked proxies', () => {
    const active = new Proxy(Object.create(null) as object, { ownKeys: () => { throw new Error('trap'); } });
    const throwing = new Proxy(Object.create(null) as object, { getPrototypeOf: () => { throw new Error('trap'); } });
    const pair = Proxy.revocable(Object.create(null) as object, {});
    pair.revoke();
    for (const hostile of [active, throwing, pair.proxy]) {
      expect(() => createOperationRecord(hostile)).not.toThrow();
      expect(() => createAdmissionRecord(hostile)).not.toThrow();
      expect(() => createImmutableOutboxIntentRecord(hostile)).not.toThrow();
      expect(() => createTerminalStateRecord(hostile)).not.toThrow();
      expect(() => decodeTransactionEvidenceRecord(hostile)).not.toThrow();
      expect(errorCode(decodeTransactionEvidenceRecord(hostile))).toBe('INVALID_FIELD_TYPE');
      expect(() => validateTransactionEvidenceCompatibility(hostile)).not.toThrow();
      expect(() => validateProductionTransactionEvidenceGraph(hostile)).not.toThrow();
      expect(() => deriveExactOperationDigest(hostile)).not.toThrow();
      expect(() => deriveOperationRegistryRoot(hostile)).not.toThrow();
      expect(() => deriveTerminalRoot(hostile)).not.toThrow();
      expect(() => deriveOutboxRoot(hostile)).not.toThrow();
    }
  });

  it('rejects oversized and noncanonical byte envelopes before record dispatch', () => {
    expect(errorCode(decodeTransactionEvidenceRecordBytes(new Uint8Array(32 * 1024 + 1)))).toBe('INPUT_TOO_LARGE');
    const noncanonical = new TextEncoder().encode('{"version":1,"kind":"absinthe_terminal_state"}');
    expect(errorCode(decodeTransactionEvidenceRecordBytes(noncanonical))).toBe('NON_CANONICAL_VALUE');
  });

  it('commits every mutable non-self field and rejects an old digest on each valid mutation', () => {
    const graph = fixtures();
    const cases = [
      { record: graph.operation, self: 'operationDigest', changes: {
        id: 'operation-2', namespace: 'namespace-2', generation: 'generation-2', admissionId: 'admission-2',
        admissionDigest: digest('d'), writerId: 'writer-other', writerDigest: digest('d'), sessionId: 'session-2',
        sessionDigest: digest('d'), mutationKind: 'note_tombstone', committedRevision: '43',
        affectedIdentityDigest: digest('d'), canonicalInputDigest: digest('d'), resultDigest: digest('d'),
        outboxId: 'outbox-2', outboxIntentDigest: digest('d'),
      } },
      { record: graph.admission, self: 'admissionDigest', changes: {
        id: 'admission-2', operationId: 'operation-2', writerId: 'writer-other', sessionId: 'session-2',
        exactOperationDigest: digest('d'),
      } },
      { record: graph.outbox, self: 'outboxDigest', changes: {
        id: 'outbox-2', operationId: 'operation-2', intentDigest: digest('d'), exactOperationDigest: digest('d'),
      } },
      { record: graph.terminal, self: 'terminalDigest', changes: {
        id: 'terminal-2', operationId: 'operation-2', resultDigest: digest('d'), exactOperationDigest: digest('d'),
      } },
    ] as const;
    for (const entry of cases) {
      const originalDigest = entry.record[entry.self];
      for (const [field, value] of Object.entries(entry.changes)) {
        const created = entry.record.kind === 'absinthe_k330_operation'
          ? { ok: true as const, value: createChangedOperation(entry.record, { [field]: value }) }
          : creators[entry.record.kind]({ ...inputs(entry.record), [field]: value });
        expect(created.ok, `${entry.record.kind}.${field}`).toBe(true);
        if (!created.ok) continue;
        const newDigest = created.value[entry.self as keyof typeof created.value];
        expect(newDigest).not.toBe(originalDigest);
        expect(decodeTransactionEvidenceRecord(created.value).ok).toBe(true);
        expect(errorCode(decodeTransactionEvidenceRecord({ ...created.value, [entry.self]: originalDigest })))
          .toBe('CANONICAL_DIGEST_MISMATCH');
      }
    }
  });

  it('derives and enforces one exact-operation commitment over every authority-critical operation field', () => {
    const { operation } = fixtures();
    const input = inputs(operation);
    const { admissionDigest: _admissionDigest, exactOperationDigest: _exactOperationDigest, ...exactInput } = input;
    expect(must(deriveExactOperationDigest(exactInput))).toBe(operation.exactOperationDigest);
    expect(errorCode(createOperationRecord({ ...input, exactOperationDigest: digest('d') })))
      .toBe('RELATIONSHIP_MISMATCH');
    expect(errorCode(decodeOperationRecord({
      ...operation,
      exactOperationDigest: digest('d'),
    }))).toBe('CANONICAL_DIGEST_MISMATCH');
    for (const [field, value] of Object.entries({
      id: 'operation-other', namespace: 'namespace-other', generation: 'generation-other',
      admissionId: 'admission-other', writerId: 'writer-other', writerDigest: digest('d'), sessionId: 'session-other',
      sessionDigest: digest('d'), mutationKind: 'note_tombstone', committedRevision: '43',
      affectedIdentityDigest: digest('d'), canonicalInputDigest: digest('d'), resultDigest: digest('d'),
      outboxId: 'outbox-other', outboxIntentDigest: digest('d'),
    })) {
      const candidate = { ...exactInput, [field]: value };
      expect(must(deriveExactOperationDigest(candidate)), field).not.toBe(operation.exactOperationDigest);
    }
  });
});

describe('K-333B transaction evidence graph and compatibility', () => {
  it('accepts one exact independently decoded transaction evidence graph', () => {
    expect(validateProductionTransactionEvidenceGraph(fixtures()).ok).toBe(true);
  });

  it('rejects every selected edge after independently valid resealing', () => {
    const graph = fixtures();
    const wrongAdmission = must(createAdmissionRecord({ ...inputs(graph.admission), operationId: 'operation-other' }));
    const wrongOperation = createChangedOperation(graph.operation, { namespace: 'namespace-other' });
    const wrongOutbox = must(createImmutableOutboxIntentRecord({ ...inputs(graph.outbox), operationId: 'operation-other' }));
    const wrongTerminal = must(createTerminalStateRecord({ ...inputs(graph.terminal), resultDigest: digest('d') }));
    for (const invalid of [
      { ...graph, operation: wrongOperation },
      { ...graph, admission: wrongAdmission },
      { ...graph, outbox: wrongOutbox },
      { ...graph, terminal: wrongTerminal },
    ]) {
      expect(errorCode(validateProductionTransactionEvidenceGraph(invalid))).toBe('RELATIONSHIP_MISMATCH');
    }
  });

  it('rejects independently valid namespace, generation, writer, session, and authority-revision replay', () => {
    const graph = fixtures();
    const operationReplays = [
      createChangedOperation(graph.operation, { namespace: 'namespace-other' }),
      createChangedOperation(graph.operation, { generation: 'generation-other' }),
      createChangedOperation(graph.operation, { writerId: 'writer-other' }),
      createChangedOperation(graph.operation, { writerDigest: digest('d') }),
      createChangedOperation(graph.operation, { sessionId: 'session-other' }),
      createChangedOperation(graph.operation, { sessionDigest: digest('d') }),
    ];
    for (const operation of operationReplays) {
      expect(decodeOperationRecord(operation).ok).toBe(true);
      expect(errorCode(validateProductionTransactionEvidenceGraph({ ...graph, operation })))
        .toBe('RELATIONSHIP_MISMATCH');
    }
    const authority = must(createSourceAuthorityRecord({
      id: graph.authority.id, namespaceId: graph.authority.namespaceId, generationId: graph.authority.generationId,
      physicalSourceDigest: graph.authority.physicalSourceDigest, sourceRevision: '43',
      operationRegistryRoot: graph.authority.operationRegistryRoot, terminalRoot: graph.authority.terminalRoot,
      outboxRoot: graph.authority.outboxRoot, mmrStateId: graph.authority.mmrStateId,
      mmrStateDigest: graph.authority.mmrStateDigest, lifecycleHeadId: graph.authority.lifecycleHeadId,
      lifecycleHeadDigest: graph.authority.lifecycleHeadDigest,
    }));
    const reference = must(createSourceTransactionReferenceRecord({
      id: graph.reference.id, namespaceId: graph.reference.namespaceId, generationId: graph.reference.generationId,
      physicalSourceDigest: graph.reference.physicalSourceDigest, committedSourceRevision: '43',
      sourceAuthorityId: authority.id, sourceAuthorityDigest: authority.authorityDigest,
      operationId: graph.reference.operationId, operationDigest: graph.reference.operationDigest,
      admissionId: graph.reference.admissionId, admissionDigest: graph.reference.admissionDigest,
      writerId: graph.reference.writerId, writerDigest: graph.reference.writerDigest,
      sessionId: graph.reference.sessionId, sessionDigest: graph.reference.sessionDigest,
      terminalId: graph.reference.terminalId, terminalDigest: graph.reference.terminalDigest,
      outboxId: graph.reference.outboxId, outboxDigest: graph.reference.outboxDigest,
      mmrStateId: authority.mmrStateId, mmrStateDigest: authority.mmrStateDigest,
      checkpointId: graph.reference.checkpointId, checkpointDigest: graph.reference.checkpointDigest, graphVersion: 1,
    }));
    expect(errorCode(validateProductionTransactionEvidenceGraph({ ...graph, authority, reference })))
      .toBe('RELATIONSHIP_MISMATCH');
  });

  it('rejects valid operation, admission, outbox, and terminal records mixed from another transaction', () => {
    const graph = fixtures();
    const otherOperation = createChangedOperation(graph.operation, { id: 'operation-2' });
    const otherAdmission = must(createAdmissionRecord({ ...inputs(graph.admission), id: 'admission-2' }));
    const otherOutbox = must(createImmutableOutboxIntentRecord({ ...inputs(graph.outbox), id: 'outbox-2' }));
    const otherTerminal = must(createTerminalStateRecord({ ...inputs(graph.terminal), id: 'terminal-2' }));
    for (const invalid of [
      { ...graph, operation: otherOperation }, { ...graph, admission: otherAdmission },
      { ...graph, outbox: otherOutbox }, { ...graph, terminal: otherTerminal },
    ]) expect(errorCode(validateProductionTransactionEvidenceGraph(invalid))).toBe('RELATIONSHIP_MISMATCH');
  });

  it('uses a closed immutable compatibility table and rejects unsupported tuples before graph access', () => {
    expect(Object.isFrozen(TRANSACTION_EVIDENCE_COMPATIBILITY)).toBe(true);
    expect(Object.isFrozen(TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES)).toBe(true);
    expect(Object.isFrozen(EXPECTED_TRANSACTION_EVIDENCE_EDGES)).toBe(true);
    for (const tuple of TRANSACTION_EVIDENCE_COMPATIBILITY) expect(Object.isFrozen(tuple)).toBe(true);
    for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {
      expect(Object.isFrozen(edge)).toBe(true);
      expect(Object.isFrozen(edge.tuple)).toBe(true);
      expect(Object.getOwnPropertyDescriptor(edge, 'predecessor')?.writable).toBe(false);
      expect(Object.getOwnPropertyDescriptor(edge, 'successor')?.writable).toBe(false);
    }
    for (const [predecessorKind, predecessorVersion, successorKind, successorVersion] of TRANSACTION_EVIDENCE_COMPATIBILITY) {
      expect(validateTransactionEvidenceCompatibility({
        predecessorKind, predecessorVersion, successorKind, successorVersion,
      }).ok).toBe(true);
    }
    expect(errorCode(validateTransactionEvidenceCompatibility({
      predecessorKind: 'absinthe_k330_operation', predecessorVersion: 2,
      successorKind: 'absinthe_k330_admission', successorVersion: 1,
    }))).toBe('UNSUPPORTED_RECORD_VERSION');
    expect(errorCode(validateTransactionEvidenceCompatibility({
      predecessorKind: 'absinthe_k330_admission', predecessorVersion: 1,
      successorKind: 'absinthe_k330_operation', successorVersion: 1,
    }))).toBe('RELATIONSHIP_MISMATCH');
    const expectedTuples = expectedCompatibilityTuples();
    const graphEdges = TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES.map(edge => ({
      predecessor: edge.predecessor,
      successor: edge.successor,
      tuple: edge.tuple,
    }));
    expect(graphEdges).toEqual(EXPECTED_TRANSACTION_EVIDENCE_EDGES);
    expect(TRANSACTION_EVIDENCE_COMPATIBILITY).toEqual(expectedTuples);
    expect(graphEdges.map(edge => edge.tuple)).toEqual(expectedTuples);
    expect(graphEdges).toHaveLength(9);
    expect(TRANSACTION_EVIDENCE_COMPATIBILITY).toHaveLength(9);
    expect(new Set(graphEdges.map(completeEdgeKey)).size).toBe(9);
    expect(new Set(graphEdges.map(selectorPairKey)).size).toBe(9);
    expect(new Set(graphEdges.map(edge => JSON.stringify(edge.tuple))).size).toBe(9);
    expect(new Set(TRANSACTION_EVIDENCE_COMPATIBILITY.map(tuple => JSON.stringify(tuple))).size).toBe(9);
  });

  it('semantically guards complete decoding and every public compatibility iteration before relationship use', () => {
    const source = readFileSync(new URL('./transactionEvidenceProtocol.ts', import.meta.url), 'utf8');
    expect(validateProductionTransactionEvidenceGraph(fixtures()).ok).toBe(true);
    const analysis = analyzeTransactionEvidenceStructure(source);
    expect(analysis.issues, analysis.issues.join(', ')).toEqual([]);
  });

  it('rejects selector and loop-structure mutations in bounded source fixtures', () => {
    const source = readFileSync(new URL('./transactionEvidenceProtocol.ts', import.meta.url), 'utf8');
    const variants = [
      ['selector drift', replaceOnce(source,
        "predecessor: 'operation', successor: 'admission',",
        "predecessor: 'operation', successor: 'terminal',"), 'edge_inventory_mismatch'],
      ['pre-call continue', replaceOnce(source,
        '  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {\n',
        "  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {\n    if (edge.successor === 'admission') continue;\n"),
      'compatibility_pre_call_structure'],
      ['pre-call break', replaceOnce(source,
        '  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {\n',
        "  for (const edge of TRANSACTION_EVIDENCE_GRAPH_COMPATIBILITY_EDGES) {\n    if (edge.predecessor === 'writer') break;\n"),
      'compatibility_pre_call_structure'],
      ['decoder result check below loop', replaceOnce(
        replaceOnce(source, '  if (!terminal.ok) return terminal;\n', ''),
        '  const representative = validateRepresentativeAuthorityGraph({',
        '  if (!terminal.ok) return terminal;\n  const representative = validateRepresentativeAuthorityGraph({',
      ), 'completed_decode_boundary'],
      ['ignored compatibility result', replaceOnce(source,
        '    if (!compatible.ok) return compatible;',
        '    void compatible;'), 'compatibility_failure_propagation'],
      ['relationship validation before loop', moveRepresentativeValidationBeforeLoop(source),
        'relationship_after_compatibility'],
    ] as const;
    for (const [name, variant, expectedIssue] of variants) {
      const analysis = analyzeTransactionEvidenceStructure(variant);
      expect(analysis.issues, `${name}: ${analysis.issues.join(', ')}`).toContain(expectedIssue);
    }
  });

  it('rejects same-ID different-operation replay only after every mixed record independently validates', () => {
    const graphA = fixtures();
    const variants = [
      sameIdOperationVariant(graphA, { canonicalInputDigest: digest('d') }),
      sameIdOperationVariant(graphA, { affectedIdentityDigest: digest('d') }),
      sameIdOperationVariant(graphA, { mutationKind: 'note_tombstone' }),
    ];
    expect(validateProductionTransactionEvidenceGraph(graphA).ok).toBe(true);
    for (const graphB of variants) {
      expect(graphB.operation.id).toBe(graphA.operation.id);
      expect(graphB.operation.exactOperationDigest).not.toBe(graphA.operation.exactOperationDigest);
      expect(validateProductionTransactionEvidenceGraph(graphB).ok).toBe(true);
      for (const record of [graphA.admission, graphA.outbox, graphA.terminal]) {
        expect(decodeTransactionEvidenceRecord(record).ok).toBe(true);
      }
      for (const mixed of [
        { ...graphB, admission: graphA.admission },
        { ...graphB, outbox: graphA.outbox },
        { ...graphB, terminal: graphA.terminal },
        { ...graphB, authority: graphA.authority },
        { ...graphB, admission: graphA.admission, outbox: graphA.outbox, terminal: graphA.terminal },
        { ...graphB, admission: graphA.admission, outbox: graphA.outbox, terminal: graphA.terminal,
          authority: graphA.authority },
      ]) {
        expect(errorCode(validateProductionTransactionEvidenceGraph(mixed))).toBe('RELATIONSHIP_MISMATCH');
      }
    }
  });

  it('rejects a fully resealed arbitrary exact-operation commitment', () => {
    const graph = fixtures();
    const forgedExactOperationDigest = digest('d');
    expect(forgedExactOperationDigest).not.toBe(graph.operation.exactOperationDigest);

    const admission = must(createAdmissionRecord({
      ...inputs(graph.admission),
      exactOperationDigest: forgedExactOperationDigest,
    }));
    const { operationDigest: _operationDigest, ...operationPayload } = graph.operation;
    const forgedOperationPayload = Object.freeze({
      ...operationPayload,
      admissionDigest: admission.admissionDigest,
      exactOperationDigest: forgedExactOperationDigest,
    });
    const operationDigest = must(digestCanonicalProtocolRecord(
      'absinthe.operation.v1', 1, forgedOperationPayload,
    ));
    const operation = Object.freeze({ ...forgedOperationPayload, operationDigest }) as OperationRecord;
    const outbox = must(createImmutableOutboxIntentRecord({
      ...inputs(graph.outbox),
      exactOperationDigest: forgedExactOperationDigest,
    }));
    const terminal = must(createTerminalStateRecord({
      ...inputs(graph.terminal),
      exactOperationDigest: forgedExactOperationDigest,
    }));
    const authority = resealAuthority(graph, {
      operationRegistryRoot: must(deriveOperationRegistryRoot(operation.operationDigest)),
      terminalRoot: must(deriveTerminalRoot(terminal.terminalDigest)),
      outboxRoot: must(deriveOutboxRoot(outbox.outboxDigest)),
    });
    const reference = resealReference(graph, {
      sourceAuthorityDigest: authority.authorityDigest,
      operationDigest: operation.operationDigest,
      admissionDigest: admission.admissionDigest,
      terminalDigest: terminal.terminalDigest,
      outboxDigest: outbox.outboxDigest,
    });
    const forgedGraph = { ...graph, operation, admission, outbox, terminal, authority, reference };

    const operationPreimage = must(buildCanonicalProtocolPreimage(
      'absinthe.operation.v1', 1, forgedOperationPayload,
    ));
    expect(sha256Hex(text(operationPreimage))).toBe(operation.operationDigest);
    expect(decodeAdmissionRecord(admission).ok).toBe(true);
    expect(decodeImmutableOutboxIntentRecord(outbox).ok).toBe(true);
    expect(decodeTerminalStateRecord(terminal).ok).toBe(true);
    expect(decodeSourceAuthorityRecord(authority).ok).toBe(true);
    expect(decodeSourceTransactionReferenceRecord(reference).ok).toBe(true);

    // Every dependent record, authority root, and self-digest is current. Only the carried exact-operation
    // commitment is false relative to the unchanged Operation semantic fields.
    expect(errorCode(decodeOperationRecord(operation))).toBe('RELATIONSHIP_MISMATCH');
    expect(errorCode(validateProductionTransactionEvidenceGraph(forgedGraph))).toBe('RELATIONSHIP_MISMATCH');
  });

  it('validates K-331 one-record authority roots and rejects every independently resealed mismatch', () => {
    const graph = fixtures();
    expect(graph.authority.operationRegistryRoot)
      .toBe('28c758f66629ca576d4c3683a8c55b8d3491de4254602ca57fa777849ddf8efb');
    expect(graph.authority.terminalRoot)
      .toBe('a9c33649d3b31333fff525a226e98a159b0a8cd2c686cc889bb6b2dd7ff679da');
    expect(graph.authority.outboxRoot)
      .toBe('2f442a59c7055da422c138383474bba1cdce3daa0a7bbaf9f1fc2baa8676bed4');
    for (const field of ['operationRegistryRoot', 'terminalRoot', 'outboxRoot'] as const) {
      const authority = resealAuthority(graph, { [field]: digest('d') });
      const reference = resealReference(graph, { sourceAuthorityDigest: authority.authorityDigest });
      expect(errorCode(validateProductionTransactionEvidenceGraph({ ...graph, authority, reference })))
        .toBe('RELATIONSHIP_MISMATCH');
    }
    const other = sameIdOperationVariant(graph, { canonicalInputDigest: digest('d') });
    const authority = resealAuthority(graph, {
      operationRegistryRoot: other.authority.operationRegistryRoot,
      terminalRoot: other.authority.terminalRoot,
      outboxRoot: other.authority.outboxRoot,
    });
    const reference = resealReference(graph, { sourceAuthorityDigest: authority.authorityDigest });
    expect(errorCode(validateProductionTransactionEvidenceGraph({ ...graph, authority, reference })))
      .toBe('RELATIONSHIP_MISMATCH');
  });
});

describe('K-333B fixed stable vectors', () => {
  it('keeps an independent exact-operation commitment vector', () => {
    const { operation } = fixtures();
    const input = inputs(operation);
    const { admissionDigest: _admissionDigest, exactOperationDigest: _exactOperationDigest, ...exactInput } = input;
    const payload = { kind: 'absinthe_k330_operation', version: 1, ...exactInput };
    const expectedPayload = '{"admissionId":"admission-1","affectedIdentityDigest":"4444444444444444444444444444444444444444444444444444444444444444","canonicalInputDigest":"5555555555555555555555555555555555555555555555555555555555555555","committedRevision":"42","generation":"generation-1","id":"operation-1","kind":"absinthe_k330_operation","mutationKind":"note_upsert","namespace":"namespace-1","outboxId":"outbox-1","outboxIntentDigest":"7777777777777777777777777777777777777777777777777777777777777777","resultDigest":"6666666666666666666666666666666666666666666666666666666666666666","sessionDigest":"7b117eb86dcf836f23df4154ae7e9089d99363bfc66d276eed41a60c75f026c3","sessionId":"session-1","version":1,"writerDigest":"d213325403db4caf9c6b2ba44329b204fab0294307dc4823fa879dfcd9e867af","writerId":"writer-v2.window.interactive.0001"}';
    expect(text(must(encodeCanonicalProtocolValue(payload)))).toBe(expectedPayload);
    expect(text(must(buildCanonicalProtocolPreimage('absinthe.exact_operation.v1', 1, payload))))
      .toBe(`absinthe-protocol-preimage-v1\nD:27:absinthe.exact_operation.v1\nV:1\nP:${new TextEncoder().encode(expectedPayload).byteLength}:${expectedPayload}`);
    expect(must(deriveExactOperationDigest(exactInput)))
      .toBe('e6e0d13e6a25998096b97c44593d18cbba953a23509379a749e000a93f187712');
  });

  it('keeps independent canonical payload, preimage, and digest literals for every new record', () => {
    const { operation, admission, outbox, terminal } = fixtures();
    const vectors = [
      [operation, 'operationDigest', 'absinthe.operation.v1',
        '{"admissionDigest":"895b7717ac37726a52eb734c3d1e9eb349e7ab8220bab25b12a841ddd7bbe4fc","admissionId":"admission-1","affectedIdentityDigest":"4444444444444444444444444444444444444444444444444444444444444444","canonicalInputDigest":"5555555555555555555555555555555555555555555555555555555555555555","committedRevision":"42","exactOperationDigest":"e6e0d13e6a25998096b97c44593d18cbba953a23509379a749e000a93f187712","generation":"generation-1","id":"operation-1","kind":"absinthe_k330_operation","mutationKind":"note_upsert","namespace":"namespace-1","outboxId":"outbox-1","outboxIntentDigest":"7777777777777777777777777777777777777777777777777777777777777777","resultDigest":"6666666666666666666666666666666666666666666666666666666666666666","sessionDigest":"7b117eb86dcf836f23df4154ae7e9089d99363bfc66d276eed41a60c75f026c3","sessionId":"session-1","version":1,"writerDigest":"d213325403db4caf9c6b2ba44329b204fab0294307dc4823fa879dfcd9e867af","writerId":"writer-v2.window.interactive.0001"}',
        '3b5279fadb26b57787127e67bd5ca3b2142d1f7780acb56afe13dc9e1f95915a'],
      [admission, 'admissionDigest', 'absinthe.admission.v1',
        '{"decision":"admitted","exactOperationDigest":"e6e0d13e6a25998096b97c44593d18cbba953a23509379a749e000a93f187712","id":"admission-1","kind":"absinthe_k330_admission","operationId":"operation-1","sessionId":"session-1","version":1,"writerId":"writer-v2.window.interactive.0001"}',
        '895b7717ac37726a52eb734c3d1e9eb349e7ab8220bab25b12a841ddd7bbe4fc'],
      [outbox, 'outboxDigest', 'absinthe.immutable_outbox_intent.v1',
        '{"exactOperationDigest":"e6e0d13e6a25998096b97c44593d18cbba953a23509379a749e000a93f187712","id":"outbox-1","intentDigest":"7777777777777777777777777777777777777777777777777777777777777777","kind":"absinthe_immutable_outbox_intent","operationId":"operation-1","version":1}',
        '69e1428ba6f3fd26a5725dd5bd7fc3691b5f462899a2a58c7fe9b97d8fc7a54b'],
      [terminal, 'terminalDigest', 'absinthe.terminal_state.v1',
        '{"exactOperationDigest":"e6e0d13e6a25998096b97c44593d18cbba953a23509379a749e000a93f187712","id":"terminal-1","kind":"absinthe_terminal_state","operationId":"operation-1","resultDigest":"6666666666666666666666666666666666666666666666666666666666666666","state":"committed","version":1}',
        '6e7e7123e36ddea8be6d6487f3d257173e5bf501a287eb78a5bc6be4e1ad8926'],
    ] as const;
    for (const [record, self, domain, expectedPayload, expectedDigest] of vectors) {
      const payload = { ...record } as Record<string, unknown>;
      delete payload[self];
      const payloadText = text(must(encodeCanonicalProtocolValue(payload)));
      const preimageText = text(must(buildCanonicalProtocolPreimage(domain, 1, payload)));
      expect(payloadText).toBe(expectedPayload);
      expect(preimageText).toBe(`absinthe-protocol-preimage-v1\nD:${new TextEncoder().encode(domain).byteLength}:${domain}\nV:1\nP:${new TextEncoder().encode(expectedPayload).byteLength}:${expectedPayload}`);
      expect(record[self]).toBe(expectedDigest);
    }
  });
});
