import { CrossContextHandoffError, HANDOFF_LIMITS, type SourceEntry } from './types';

const encoder = new TextEncoder();

export function utf8Bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

export function utf8ByteLength(value: string): number {
  return utf8Bytes(value).byteLength;
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const input = typeof value === 'string' ? utf8Bytes(value) : value;
  return hex(await crypto.subtle.digest('SHA-256', input));
}

function strictArray(value: unknown, length: number | null): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || (length !== null && value.length !== length)) {
    throw new CrossContextHandoffError('SOURCE_MALFORMED', 'validate_source_records');
  }
  try { structuredClone(value); } catch {
    throw new CrossContextHandoffError('SOURCE_MALFORMED', 'validate_source_records');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const expected = [...Array(value.length).keys()].map(String).concat('length').sort();
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== 'string')
    || (actual as string[]).sort().some((key, index) => key !== expected[index])
    || actual.length !== expected.length) {
    throw new CrossContextHandoffError('SOURCE_MALFORMED', 'validate_source_records');
  }
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      || descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new CrossContextHandoffError('SOURCE_MALFORMED', 'validate_source_records');
    }
    return descriptor.value;
  });
}

export function canonicalizeSourceEntries(input: unknown): readonly SourceEntry[] {
  const values = strictArray(input, null);
  if (values.length > HANDOFF_LIMITS.sourceRecordCount) {
    throw new CrossContextHandoffError('SOURCE_RESOURCE_BOUND_EXCEEDED', 'source_record_count');
  }
  const result: SourceEntry[] = [];
  const seen = new Set<string>();
  let aggregateBytes = 0;
  for (const value of values) {
    const pair = strictArray(value, 2);
    if (typeof pair[0] !== 'string' || typeof pair[1] !== 'string' || pair[0].length === 0
      || pair[0].trim() !== pair[0] || pair[1].trim() !== pair[1]) {
      throw new CrossContextHandoffError('SOURCE_MALFORMED', 'source_record_shape');
    }
    const id = pair[0];
    const recordValue = pair[1];
    if (utf8ByteLength(id) > HANDOFF_LIMITS.sourceRecordIdBytes
      || utf8ByteLength(recordValue) > HANDOFF_LIMITS.sourceRecordValueBytes) {
      throw new CrossContextHandoffError('SOURCE_RESOURCE_BOUND_EXCEEDED', 'source_record_field');
    }
    const tupleBytes = utf8ByteLength(JSON.stringify([id, recordValue]));
    if (tupleBytes > HANDOFF_LIMITS.sourceRecordBytes) {
      throw new CrossContextHandoffError('SOURCE_RESOURCE_BOUND_EXCEEDED', 'source_record');
    }
    aggregateBytes += tupleBytes;
    if (!Number.isSafeInteger(aggregateBytes) || aggregateBytes > HANDOFF_LIMITS.aggregateSourceTupleBytes) {
      throw new CrossContextHandoffError('SOURCE_RESOURCE_BOUND_EXCEEDED', 'source_aggregate');
    }
    if (seen.has(id)) throw new CrossContextHandoffError('SOURCE_MALFORMED', 'duplicate_source_id');
    seen.add(id);
    result.push(Object.freeze([`${id}`, `${recordValue}`] as const));
  }
  result.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return Object.freeze(result);
}

export function canonicalSourceEntryBytes(entries: readonly SourceEntry[]): string {
  return JSON.stringify(['absinthe_handoff_snapshot_records_v1', entries]);
}

export function assertJsonDepth(bytes: string): void {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of bytes) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') {
      depth += 1;
      if (depth > HANDOFF_LIMITS.jsonDepth) {
        throw new CrossContextHandoffError('RESOURCE_BOUND_EXCEEDED', 'persisted_json_depth');
      }
    } else if (character === '}' || character === ']') depth -= 1;
    if (depth < 0) throw new CrossContextHandoffError('NONCANONICAL_PERSISTED_BYTES', 'persisted_json');
  }
  if (inString || depth !== 0) {
    throw new CrossContextHandoffError('NONCANONICAL_PERSISTED_BYTES', 'persisted_json');
  }
}
