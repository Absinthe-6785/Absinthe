import { LocalDatabaseError } from './errors';
import { LOCAL_SCHEMA_VERSION, type LocalDatabaseNamespace } from './types';

const SAFE_COMPONENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SENSITIVE = /(?:https?:\/\/|[?#\\/]|bearer|token|cookie|password|secret|authorization|eyJ)/i;

function validateComponent(value: unknown): value is string {
  return typeof value === 'string' && SAFE_COMPONENT.test(value) && !SENSITIVE.test(value);
}

export function validateNamespace(namespace: LocalDatabaseNamespace): void {
  if (!namespace || typeof namespace !== 'object') throw new LocalDatabaseError('INVALID_NAMESPACE', 'validate_namespace');
  for (const value of [namespace.userId, namespace.projectRef, namespace.deviceId, namespace.generationId] as unknown[]) {
    if (!validateComponent(value)) throw new LocalDatabaseError(
      typeof value === 'string' && value.length > 0 ? 'UNSAFE_NAMESPACE' : 'INVALID_NAMESPACE',
      'validate_namespace',
    );
  }
  if (!Number.isSafeInteger(namespace.schemaVersion) || namespace.schemaVersion !== LOCAL_SCHEMA_VERSION) {
    throw new LocalDatabaseError('UNSUPPORTED_SCHEMA_VERSION', 'validate_namespace');
  }
}

export function validateSafeIdentifier(value: unknown, operation: string): asserts value is string {
  if (!validateComponent(value)) throw new LocalDatabaseError('INVALID_ENTITY', operation);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function namespaceFingerprint(namespace: LocalDatabaseNamespace): Promise<string> {
  validateNamespace(namespace);
  const encoded = JSON.stringify([namespace.userId, namespace.projectRef, namespace.deviceId, namespace.schemaVersion]);
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encoded)));
}

function encodeParts(parts: readonly string[]): string {
  return parts.map(part => `${part.length}:${part}`).join('|');
}

export function idEntityIdentity(id: string): string {
  validateSafeIdentifier(id, 'id_identity');
  return `id|${encodeParts([id])}`;
}

export function ownerDateEntityIdentity(ownerId: string, date: string): string {
  validateSafeIdentifier(ownerId, 'owner_date_identity');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new LocalDatabaseError('INVALID_ENTITY', 'owner_date_identity');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new LocalDatabaseError('INVALID_ENTITY', 'owner_date_identity');
  }
  return `owner-date|${encodeParts([ownerId, date])}`;
}

export function singletonEntityIdentity(ownerId: string, singleton: string): string {
  validateSafeIdentifier(ownerId, 'singleton_identity');
  validateSafeIdentifier(singleton, 'singleton_identity');
  return `singleton|${encodeParts([ownerId, singleton])}`;
}

export function attachmentEntityIdentity(attachmentId: string): string {
  validateSafeIdentifier(attachmentId, 'attachment_identity');
  return `attachment|${encodeParts([attachmentId])}`;
}
