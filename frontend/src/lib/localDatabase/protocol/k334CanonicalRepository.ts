import {
  decodeK334CanonicalRecord,
  encodeK334CanonicalRecord,
  type K334CanonicalRecord,
} from './k334CanonicalProtocol';
import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';
import { decodeIdentifier } from './strictProtocolDecode';

export type K334AppendDisposition = 'appended' | 'idempotent';

export interface K334AppendResult {
  readonly disposition: K334AppendDisposition;
  readonly record: K334CanonicalRecord;
}

interface StoredRecord {
  readonly record: K334CanonicalRecord;
  readonly bytes: Uint8Array;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

/**
 * An isolated, in-memory append/read boundary for canonical K-334 evidence.
 * It has no IndexedDB, authority acceptance, projection, or runtime wiring.
 * A later separately authorized persistence task may adapt this contract.
 */
export class K334CanonicalRepository {
  readonly #records = new Map<string, StoredRecord>();

  append(value: unknown): ProtocolResult<K334AppendResult> {
    const record = decodeK334CanonicalRecord(value);
    if (!record.ok) return record;
    const bytes = encodeK334CanonicalRecord(record.value);
    if (!bytes.ok) return bytes;
    const existing = this.#records.get(record.value.recordId);
    if (existing) {
      return equalBytes(existing.bytes, bytes.value)
        ? protocolOk(Object.freeze({ disposition: 'idempotent', record: existing.record }))
        : protocolFail('CANONICAL_DIGEST_MISMATCH', 'k334_repository_append', 'recordId');
    }
    this.#records.set(record.value.recordId, Object.freeze({ record: record.value, bytes: new Uint8Array(bytes.value) }));
    return protocolOk(Object.freeze({ disposition: 'appended', record: record.value }));
  }

  read(recordId: unknown): ProtocolResult<K334CanonicalRecord | null> {
    const identifier = decodeIdentifier(recordId, 'recordId');
    if (!identifier.ok) return identifier;
    return protocolOk(this.#records.get(identifier.value)?.record ?? null);
  }

  size(): number {
    return this.#records.size;
  }
}

export function createK334CanonicalRepository(): K334CanonicalRepository {
  return new K334CanonicalRepository();
}
