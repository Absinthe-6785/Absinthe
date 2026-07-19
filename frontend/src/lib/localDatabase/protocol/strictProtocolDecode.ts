import { PROTOCOL_CANONICAL_LIMITS } from './canonicalProtocolValue';
import {
  PRODUCTION_PROTOCOL_ERROR_CODES,
  PROTOCOL_ERROR_LABEL_LIMITS,
  protocolFail,
  protocolOk,
  type ProductionProtocolErrorCode,
  type ProtocolResult,
} from './protocolResult';

export type StrictObject = Readonly<Record<string, unknown>>;
export type StrictDecoder<T> = (value: unknown, field: string) => ProtocolResult<T>;

const IDENTIFIER = /^[a-z][a-z0-9_.:-]{2,255}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REVISION = /^(0|[1-9][0-9]{0,15})$/;
const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;
const TRUSTED_SCHEMA_FIELD = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const TRUSTED_ERROR_LABEL = /^[A-Za-z][A-Za-z0-9_.\[\]-]*$/;
const protocolErrorCodes = new Set<string>(PRODUCTION_PROTOCOL_ERROR_CODES);
const textEncoder = new TextEncoder();

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

function decodeCanonicalString(
  value: unknown,
  field: string,
  maxBytes: number,
  operation: string,
): ProtocolResult<string> {
  try {
    if (typeof value !== 'string') return protocolFail('INVALID_FIELD_TYPE', operation, field);
    if (textEncoder.encode(value).byteLength > maxBytes) {
      return protocolFail('RESOURCE_LIMIT_EXCEEDED', operation, field);
    }
    if (!canonicalUnicode(value)) return protocolFail('NON_CANONICAL_VALUE', operation, field);
    return protocolOk(value);
  } catch {
    return protocolFail('INVALID_FIELD_TYPE', operation, field);
  }
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
  if (!validRequestedLimit(maxBytes, PROTOCOL_CANONICAL_LIMITS.maxStringBytes)) {
    return protocolFail('INVALID_INTEGER', 'decode_string', 'maxBytes');
  }
  return decodeCanonicalString(value, field, maxBytes, 'decode_string');
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
  if (typeof expected === 'string') {
    const expectedString = decodeCanonicalString(
      expected, 'expected', PROTOCOL_CANONICAL_LIMITS.maxStringBytes, 'decode_literal',
    );
    if (!expectedString.ok) return expectedString as ProtocolResult<T>;
    if (typeof value === 'string') {
      const inputString = decodeCanonicalString(
        value, field, PROTOCOL_CANONICAL_LIMITS.maxStringBytes, 'decode_literal',
      );
      if (!inputString.ok) return inputString as ProtocolResult<T>;
    }
  } else if (typeof expected === 'number') {
    if (!Number.isSafeInteger(expected) || Object.is(expected, -0)) {
      return protocolFail('NON_CANONICAL_VALUE', 'decode_literal', 'expected');
    }
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || Object.is(value, -0))) {
      return protocolFail('NON_CANONICAL_VALUE', 'decode_literal', field);
    }
  } else {
    return protocolFail('INVALID_FIELD_TYPE', 'decode_literal', 'expected');
  }
  if (value === expected) return protocolOk(expected);
  return mismatch === 'version'
    ? protocolFail('UNSUPPORTED_RECORD_VERSION', 'decode_envelope', field)
    : protocolFail('RECORD_KIND_MISMATCH', 'decode_envelope', field);
}

export function decodeEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): ProtocolResult<T> {
  const allowedValues = snapshotArrayValues(allowed);
  if (!allowedValues.ok) {
    return protocolFail('INVALID_ENUM_VALUE', 'decode_enum', field);
  }
  const detachedAllowed: string[] = [];
  const seen = new Set<string>();
  for (const entry of allowedValues.value) {
    const decoded = decodeCanonicalString(
      entry, 'allowed', PROTOCOL_CANONICAL_LIMITS.maxStringBytes, 'decode_enum_schema',
    );
    if (!decoded.ok) return protocolFail('INVALID_ENUM_VALUE', 'decode_enum', 'allowed');
    if (seen.has(decoded.value)) return protocolFail('DUPLICATE_ENTRY', 'decode_enum', 'allowed');
    seen.add(decoded.value);
    detachedAllowed.push(decoded.value);
  }
  const decodedValue = decodeCanonicalString(
    value, field, PROTOCOL_CANONICAL_LIMITS.maxStringBytes, 'decode_enum',
  );
  if (!decodedValue.ok) return decodedValue;
  return detachedAllowed.includes(decodedValue.value)
    ? protocolOk(value as T) : protocolFail('INVALID_ENUM_VALUE', 'decode_enum', field);
}

function trustedErrorLabel(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length <= maximum && TRUSTED_ERROR_LABEL.test(value);
}

function malformedDecoderResult<T>(): ProtocolResult<T> {
  return protocolFail('INVALID_FIELD_TYPE', 'decode_bounded_array_item', 'decoderResult');
}

function reboxDecoderResult<T>(value: unknown): ProtocolResult<T> {
  const wrapper = decodeExactObject(value, ['ok'], ['value', 'error'], 'decode_array_decoder_result');
  if (!wrapper.ok || typeof wrapper.value.ok !== 'boolean') return malformedDecoderResult();
  const hasValue = Object.prototype.hasOwnProperty.call(wrapper.value, 'value');
  const hasError = Object.prototype.hasOwnProperty.call(wrapper.value, 'error');
  if (wrapper.value.ok) {
    return hasValue && !hasError ? protocolOk(wrapper.value.value as T) : malformedDecoderResult();
  }
  if (!hasError || hasValue) return malformedDecoderResult();
  const error = decodeExactObject(
    wrapper.value.error, ['code', 'operation'], ['field'], 'decode_array_decoder_error',
  );
  if (!error.ok || !protocolErrorCodes.has(error.value.code as string)
    || !trustedErrorLabel(error.value.operation, PROTOCOL_ERROR_LABEL_LIMITS.maxOperationCharacters)
    || (error.value.field !== undefined
      && !trustedErrorLabel(error.value.field, PROTOCOL_ERROR_LABEL_LIMITS.maxFieldCharacters))) {
    return malformedDecoderResult();
  }
  return protocolFail(
    error.value.code as ProductionProtocolErrorCode, 'decode_bounded_array_item', 'item',
  );
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
      let callbackResult: unknown;
      try {
        callbackResult = decoder(snapshot.value[index], `${field}[${index}]`);
      } catch {
        return malformedDecoderResult();
      }
      const decoded = reboxDecoderResult<T>(callbackResult);
      if (!decoded.ok) return decoded;
      if (uniqueBy) {
        let rawIdentity: unknown;
        try {
          rawIdentity = uniqueBy(decoded.value);
        } catch {
          return protocolFail('INVALID_IDENTIFIER', 'decode_array', 'identity');
        }
        const identityResult = decodeCanonicalString(
          rawIdentity, 'identity', PROTOCOL_CANONICAL_LIMITS.maxObjectKeyBytes, 'decode_array_identity',
        );
        if (!identityResult.ok) return protocolFail('INVALID_IDENTIFIER', 'decode_array', 'identity');
        const identity = identityResult.value;
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
