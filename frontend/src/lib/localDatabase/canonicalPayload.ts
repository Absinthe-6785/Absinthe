import { LocalDatabaseError } from './errors';
import { sha256Hex } from './outboxIdentity';

const SECRET_KEY = /^(?:authorization|cookie|password|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token)$/i;
const BEARER_VALUE = /^bearer\s+/i;
const JWT_VALUE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function canonicalValue(value: unknown, ancestors: Set<object>, depth: number): unknown {
  if (depth > 64) throw new LocalDatabaseError('INVALID_ENTITY', 'canonical_payload_depth');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new LocalDatabaseError('INVALID_ENTITY', 'canonical_payload_number');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw new LocalDatabaseError('INVALID_ENTITY', 'canonical_payload_type');
  if (ancestors.has(value)) throw new LocalDatabaseError('INVALID_ENTITY', 'canonical_payload_cycle');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map(item => canonicalValue(item, ancestors, depth + 1));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new LocalDatabaseError('INVALID_ENTITY', 'canonical_payload_object');
    }
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (SECRET_KEY.test(key)) throw new LocalDatabaseError('INVALID_ENTITY', 'persisted_secret_key');
      const item = source[key];
      if (typeof item === 'string' && (BEARER_VALUE.test(item) || JWT_VALUE.test(item))) {
        throw new LocalDatabaseError('INVALID_ENTITY', 'persisted_secret_value');
      }
      result[key] = canonicalValue(item, ancestors, depth + 1);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalPayloadJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value, new Set(), 0));
}

export function hashCanonicalPayload(value: unknown): string {
  return sha256Hex(canonicalPayloadJson(value));
}

/** Returns a detached JSON snapshot suitable for an immutable durable mutation payload. */
export function canonicalPayloadSnapshot<T>(value: T): T {
  return JSON.parse(canonicalPayloadJson(value)) as T;
}
