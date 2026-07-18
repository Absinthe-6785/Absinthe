import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';

export type StrictObject = Readonly<Record<string, unknown>>;
export type StrictDecoder<T> = (value: unknown, field: string) => ProtocolResult<T>;

const IDENTIFIER = /^[a-z][a-z0-9_.:-]{2,255}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REVISION = /^(0|[1-9][0-9]{0,15})$/;

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

export function decodeExactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  operation = 'decode_record',
): ProtocolResult<StrictObject> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return protocolFail('INVALID_FIELD_TYPE', operation);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return protocolFail('INVALID_FIELD_TYPE', operation);
    if (Object.getOwnPropertySymbols(value).length > 0) return protocolFail('INVALID_FIELD_TYPE', operation);
    const names = Object.getOwnPropertyNames(value);
    if (names.length > 128) return protocolFail('RESOURCE_LIMIT_EXCEEDED', operation);
    const allowed = new Set([...required, ...optional]);
    const copy: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of names) {
      if (!allowed.has(key)) return protocolFail('UNKNOWN_FIELD', operation, key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        return protocolFail('INVALID_FIELD_TYPE', operation, key);
      }
      copy[key] = descriptor.value;
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(copy, key)) return protocolFail('MISSING_FIELD', operation, key);
    }
    return protocolOk(Object.freeze(copy));
  } catch {
    return protocolFail('INVALID_FIELD_TYPE', operation);
  }
}

export function decodeBoundedString(value: unknown, field: string, maxBytes = 4_096): ProtocolResult<string> {
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_string', field);
  if (new TextEncoder().encode(value).byteLength > maxBytes) return protocolFail('RESOURCE_LIMIT_EXCEEDED', 'decode_string', field);
  if (!canonicalUnicode(value)) {
    return protocolFail('NON_CANONICAL_VALUE', 'decode_string', field);
  }
  return protocolOk(value);
}

export function decodeIdentifier(value: unknown, field: string): ProtocolResult<string> {
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_identifier', field);
  if (!IDENTIFIER.test(value)) {
    return protocolFail('INVALID_IDENTIFIER', 'decode_identifier', field);
  }
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
  if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', 'decode_enum', field);
  return (allowed as readonly string[]).includes(value)
    ? protocolOk(value as T) : protocolFail('INVALID_ENUM_VALUE', 'decode_enum', field);
}

export function decodeBoundedArray<T>(
  value: unknown,
  field: string,
  decoder: StrictDecoder<T>,
  options: { readonly maxEntries?: number; readonly uniqueBy?: (entry: T) => string } = {},
): ProtocolResult<readonly T[]> {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return protocolFail('INVALID_ARRAY', 'decode_array', field);
    }
    const maxEntries = options.maxEntries ?? 128;
    if (value.length > maxEntries) return protocolFail('RESOURCE_LIMIT_EXCEEDED', 'decode_array', field);
    if (Object.getOwnPropertySymbols(value).length > 0) return protocolFail('INVALID_ARRAY', 'decode_array', field);
    const names = Object.getOwnPropertyNames(value);
    if (names.some(name => name !== 'length' && !/^(0|[1-9][0-9]*)$/.test(name))) {
      return protocolFail('INVALID_ARRAY', 'decode_array', field);
    }
    const result: T[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        return protocolFail('INVALID_ARRAY', 'decode_array', field);
      }
      const decoded = decoder(descriptor.value, `${field}[${index}]`);
      if (!decoded.ok) return decoded;
      if (options.uniqueBy) {
        const identity = options.uniqueBy(decoded.value);
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
