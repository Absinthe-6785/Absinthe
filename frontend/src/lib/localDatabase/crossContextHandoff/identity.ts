import { sha256Hex } from './canonical';
import {
  CrossContextHandoffError,
  HANDOFF_SCHEMA_VERSION,
  type DerivedPhysicalSourceIdentityV1,
  type LogicalAuthorityScopeV1,
  type PhysicalSourceIdentityV1,
} from './types';

function strictOwnRecord(input: unknown, keys: readonly string[], code: 'MALFORMED_PHYSICAL_SOURCE_IDENTITY' | 'MALFORMED_LOGICAL_SCOPE'): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new CrossContextHandoffError(code, 'validate_identity');
  }
  try {
    // Structured clone rejects Proxy wrappers, including transparent proxies
    // that otherwise forward ordinary descriptor/prototype operations.
    structuredClone(input);
    const prototype = Object.getPrototypeOf(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const actual = Reflect.ownKeys(input);
    if ((prototype !== Object.prototype && prototype !== null) || actual.some(key => typeof key !== 'string')) {
      throw new CrossContextHandoffError(code, 'validate_identity');
    }
    const expected = [...keys].sort();
    const sorted = [...actual as string[]].sort();
    if (sorted.length !== expected.length || sorted.some((key, index) => key !== expected[index])) {
      throw new CrossContextHandoffError(code, 'validate_identity');
    }
    const fresh: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new CrossContextHandoffError(code, 'validate_identity');
      }
      fresh[key] = descriptor.value;
    }
    return fresh;
  } catch (error) {
    if (error instanceof CrossContextHandoffError) throw error;
    throw new CrossContextHandoffError(code, 'validate_identity');
  }
}

function boundedIdentity(value: unknown, code: 'MALFORMED_PHYSICAL_SOURCE_IDENTITY' | 'MALFORMED_LOGICAL_SCOPE'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.trim() !== value) {
    throw new CrossContextHandoffError(code, 'validate_identity');
  }
  return value;
}

export function validatePhysicalSourceIdentity(input: unknown): PhysicalSourceIdentityV1 {
  const value = strictOwnRecord(input, [
    'schemaVersion', 'origin', 'sourceFamily', 'backend', 'databaseName', 'objectStoreName',
    'physicalSourceVersion',
  ], 'MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  const origin = boundedIdentity(value.origin, 'MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  let parsed: URL;
  try { parsed = new URL(origin); } catch {
    throw new CrossContextHandoffError('MALFORMED_PHYSICAL_SOURCE_IDENTITY', 'validate_origin');
  }
  if (value.schemaVersion !== HANDOFF_SCHEMA_VERSION || value.sourceFamily !== 'legacy_notes'
    || value.backend !== 'combined_localstorage_indexeddb' || value.databaseName !== 'absinthe-notes-v1'
    || value.objectStoreName !== 'notes' || value.physicalSourceVersion !== 1
    || !['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin
    || parsed.username !== '' || parsed.password !== '' || parsed.pathname !== '/'
    || parsed.search !== '' || parsed.hash !== '') {
    throw new CrossContextHandoffError('UNSUPPORTED_PHYSICAL_SOURCE', 'validate_physical_source');
  }
  return Object.freeze({
    schemaVersion: 1,
    origin,
    sourceFamily: 'legacy_notes',
    backend: 'combined_localstorage_indexeddb',
    databaseName: 'absinthe-notes-v1',
    objectStoreName: 'notes',
    physicalSourceVersion: 1,
  });
}

export async function derivePhysicalSourceIdentity(input: unknown): Promise<DerivedPhysicalSourceIdentityV1> {
  const identity = validatePhysicalSourceIdentity(input);
  const canonicalBytes = JSON.stringify([
    'absinthe_legacy_physical_source_v1', identity.schemaVersion, identity.origin,
    identity.sourceFamily, identity.backend, identity.databaseName, identity.objectStoreName,
    identity.physicalSourceVersion,
  ]);
  const digest = await sha256Hex(canonicalBytes);
  return Object.freeze({
    identity,
    canonicalBytes,
    digest,
    lockName: `absinthe:legacy-source-handoff:v1:${digest}`,
  });
}

export function validateLogicalScope(input: unknown): LogicalAuthorityScopeV1 {
  const value = strictOwnRecord(input, [
    'schemaVersion', 'userId', 'projectRef', 'namespaceId', 'deviceId',
  ], 'MALFORMED_LOGICAL_SCOPE');
  if (value.schemaVersion !== HANDOFF_SCHEMA_VERSION) {
    throw new CrossContextHandoffError('MALFORMED_LOGICAL_SCOPE', 'validate_logical_scope');
  }
  return Object.freeze({
    schemaVersion: 1,
    userId: boundedIdentity(value.userId, 'MALFORMED_LOGICAL_SCOPE'),
    projectRef: boundedIdentity(value.projectRef, 'MALFORMED_LOGICAL_SCOPE'),
    namespaceId: boundedIdentity(value.namespaceId, 'MALFORMED_LOGICAL_SCOPE'),
    deviceId: boundedIdentity(value.deviceId, 'MALFORMED_LOGICAL_SCOPE'),
  });
}

export async function deriveLogicalScopeDigest(input: unknown): Promise<{ scope: LogicalAuthorityScopeV1; digest: string }> {
  const scope = validateLogicalScope(input);
  const digest = await sha256Hex(JSON.stringify([
    'absinthe_legacy_logical_authority_v1', scope.schemaVersion, scope.userId,
    scope.projectRef, scope.namespaceId, scope.deviceId,
  ]));
  return Object.freeze({ scope, digest });
}
