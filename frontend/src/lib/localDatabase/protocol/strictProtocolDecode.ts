import { PROTOCOL_CANONICAL_LIMITS } from './canonicalProtocolValue';
import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';

export type StrictObject = Readonly<Record<string, unknown>>;
export type StrictDecoder<T> = (value: unknown, field: string) => ProtocolResult<T>;

const IDENTIFIER = /^[a-z][a-z0-9_.:-]{2,255}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REVISION = /^(0|[1-9][0-9]{0,15})$/;
const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;
const TRUSTED_SCHEMA_FIELD = /^[A-Za-z][A-Za-z0-9_.-]*$/;

function canonicalUnicode(value: string): boolean {
  if (value.normalize('NFC') !== value) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function snapshotArrayValues(value: unknown): ProtocolResult<readonly unknown[]> {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return protocolFail('INVALID_ARRAY', 'decode_array', 'array');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key === 'symbol')) return protocolFail('INVALID_ARRAY', 'decode_array', 'array');
    const names = keys as string[];
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (!lengthDescriptor || !('value' in lengthDescriptor) || lengthDescriptor.enumerable
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
      return protocolFail('INVALID_ARRAY', 'decode_array', 'array');
    }
    const length = lengthDescriptor.value;
    if (length > PROTOCOL_CANONICAL_LIMITS.maxArrayEntries) {
      return protocolFail('RESOURCE_LIMIT_EXCEEDED', 'decode_array', 'array');
    }
    if (names.length !== length + 1 || names.some(name => name !== 'length'
      && (!ARRAY_INDEX.test(name) || Number(name) >= length))) {
      return protocolFail('INVALID_ARRAY', 'decode_array', 'array');
    }
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        return protocolFail('INVALID_ARRAY', 'decode_array', 'array');
      }
      snapshot.push(descriptor.value);
    }
    return protocolOk(Object.freeze(snapshot));
  } catch {
    return protocolFail('INVALID_ARRAY', 'decode_array', 'array');
  }
}

function snapshotSchemaFields(value: unknown): readonly string[] | undefined {
  const snapshot = snapshotArrayValues(value);
  if (!snapshot.ok) return undefined;
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const field of snapshot.value) {
    if (typeof field !== 'string' || field.length > PROTOCOL_CANONICAL_LIMITS.maxObjectKeyBytes
      || !TRUSTED_SCHEMA_FIELD.test(field) || seen.has(field)) return undefined;
    seen.add(field);
    fields.push(field);
  }
  return Object.freeze(fields);
}

export function decodeExactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  operation = 'decode_record',
): ProtocolResult<StrictObject> {
  try {
    const requiredFields = snapshotSchemaFields(required);
    const optionalFields = snapshotSchemaFields(optional);
    if (!requiredFields || !optionalFields) return protocolFail('INVALID_FIELD_TYPE', operation, 'schema');
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return protocolFail('INVALID_FIELD_TYPE', operation, 'record');
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return protocolFail('INVALID_FIELD_TYPE', operation, 'record');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key === 'symbol')) return protocolFail('INVALID_FIELD_TYPE', operation, 'record');
    if (keys.length > PROTOCOL_CANONICAL_LIMITS.maxObjectKeys) {
      return protocolFail('RESOURCE_LIMIT_EXCEEDED', operation, 'record');
    }
    const names = keys as string[];
    const allowed = new Set([...requiredFields, ...optionalFields]);
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of names) {
      if (!allowed.has(key)) return protocolFail('UNKNOWN_FIELD', operation, 'unknown_field');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        return protocolFail('INVALID_FIELD_TYPE', operation, key);
      }
      copy[key] = descriptor.value;
    }
    for (const key of requiredFields) {
      if (!Object.prototype.hasOwnProperty.call(copy, key)) return protocolFail('MISSING_FIELD', operation, key);
    }
    return protocolOk(Object.freeze(copy));
  } catch {
    return protocolFail('INVALID_FIELD_TYPE', operation, 'record');
  }
}

function validRequestedLimit(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

export function decodeBoundedString(value: unknown, field: string, maxBytes = PROTOCOL_CANONICAL_LIMITS.maxStringBytes): ProtocolResult<string> {
  try {
    if (!validRequestedLimit(maxBytes, PROTOCOL_CANONICAL_LIMITS.maxStringBytes)) {
      return protocolFail('INVALID_INTEGER', 'decode_string', 'maxBytes');
    }
    if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_string', field);
    if (new TextEncoder().encode(value).byteLength > maxBytes) {
      return protocolFail('RESOURCE_LIMIT_EXCEEDED', 'decode_string', field);
    }
    if (!canonicalUnicode(value)) return protocolFail('NON_CANONICAL_VALUE', 'decode_string', field);
    return protocolOk(value);
  } catch {
    return protocolFail('INVALID_FIELD_TYPE', 'decode_string', field);
  }
}

export function decodeIdentifier(value: unknown, field: string): ProtocolResult<string> {
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_identifier', field);
  if (!IDENTIFIER.test(value)) return protocolFail('INVALID_IDENTIFIER', 'decode_identifier', field);
  return protocolOk(value);
}

export function decodeDigest(value: unknown, field: string): ProtocolResult<string> {
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_digest', field);
  return DIGEST.test(value) ? protocolOk(value) : protocolFail('INVALID_DIGEST', 'decode_digest', field);
}

export function decodePositiveSafeInteger(value: unknown, field: string): ProtocolResult<number> {
  if (typeof value !== 'number') return protocolFail('INVALID_FIELD_TYPE', 'decode_integer', field);
  return Number.isSafeInteger(value) && value > 0
    ? protocolOk(value) : protocolFail('INVALID_INTEGER', 'decode_integer', field);
}

export function decodeCanonicalRevision(value: unknown, field: string): ProtocolResult<string> {
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_revision', field);
  return REVISION.test(value) ? protocolOk(value) : protocolFail('INVALID_INTEGER', 'decode_revision', field);
}

export function decodeLiteral<T extends string | number>(
  value: unknown,
  expected: T,
  field: string,
  mismatch: 'kind' | 'version' = 'kind',
): ProtocolResult<T> {
  if (value === expected) return protocolOk(expected);
  return mismatch === 'version'
    ? protocolFail('UNSUPPORTED_RECORD_VERSION', 'decode_envelope', field)
    : protocolFail('RECORD_KIND_MISMATCH', 'decode_envelope', field);
}

export function decodeEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): ProtocolResult<T> {
  const allowedValues = snapshotArrayValues(allowed);
  if (!allowedValues.ok || allowedValues.value.some(entry => typeof entry !== 'string')) {
    return protocolFail('INVALID_ENUM_VALUE', 'decode_enum', field);
  }
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_enum', field);
  return allowedValues.value.includes(value)
    ? protocolOk(value as T) : protocolFail('INVALID_ENUM_VALUE', 'decode_enum', field);
}

export function decodeBoundedArray<T>(
  value: unknown,
  field: string,
  decoder: StrictDecoder<T>,
  options: { readonly maxEntries?: number; readonly uniqueBy?: (entry: T) => string } = {},
): ProtocolResult<readonly T[]> {
  try {
    const decodedOptions = decodeExactObject(options, [], ['maxEntries', 'uniqueBy'], 'decode_array_options');
    if (!decodedOptions.ok) return decodedOptions;
    const requested = decodedOptions.value.maxEntries ?? PROTOCOL_CANONICAL_LIMITS.maxArrayEntries;
    if (!validRequestedLimit(requested, PROTOCOL_CANONICAL_LIMITS.maxArrayEntries)) {
      return protocolFail('INVALID_INTEGER', 'decode_array', 'maxEntries');
    }
    const uniqueBy = decodedOptions.value.uniqueBy;
    if (uniqueBy !== undefined && typeof uniqueBy !== 'function') {
      return protocolFail('INVALID_FIELD_TYPE', 'decode_array', 'uniqueBy');
    }
    if (typeof decoder !== 'function') return protocolFail('INVALID_FIELD_TYPE', 'decode_array', 'decoder');
    const snapshot = snapshotArrayValues(value);
    if (!snapshot.ok) return snapshot;
    if (snapshot.value.length > requested) return protocolFail('RESOURCE_LIMIT_EXCEEDED', 'decode_array', field);
    const result: T[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < snapshot.value.length; index += 1) {
      const decoded = decoder(snapshot.value[index], `${field}[${index}]`);
      if (!decoded.ok) return decoded;
      if (uniqueBy) {
        const identity = uniqueBy(decoded.value);
        if (typeof identity !== 'string' || identity.length > PROTOCOL_CANONICAL_LIMITS.maxObjectKeyBytes) {
          return protocolFail('INVALID_IDENTIFIER', 'decode_array', 'identity');
        }
        if (seen.has(identity)) return protocolFail('DUPLICATE_ENTRY', 'decode_array', field);
        seen.add(identity);
      }
      result.push(decoded.value);
    }
    return protocolOk(Object.freeze(result));
  } catch {
    return protocolFail('INVALID_ARRAY', 'decode_array', field);
  }
}
