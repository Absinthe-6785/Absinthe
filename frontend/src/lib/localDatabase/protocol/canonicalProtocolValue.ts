import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';

export const PROTOCOL_CANONICAL_LIMITS = Object.freeze({
  maxEncodedBytes: 32 * 1024,
  maxDepth: 32,
  maxNodes: 2_048,
  maxObjectKeys: 128,
  maxArrayEntries: 128,
  maxStringBytes: 4_096,
  maxObjectKeyBytes: 256,
});

export type CanonicalProtocolValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalProtocolValue[]
  | { readonly [key: string]: CanonicalProtocolValue };

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const ARRAY_INDEX = /^(0|[1-9][0-9]*)$/;

type CanonicalFailure = Exclude<ProtocolResult<never>, { ok: true }>;

interface ValidationState {
  nodes: number;
  readonly ancestors: WeakSet<object>;
}

function fail(code: CanonicalFailure['error']['code']): CanonicalFailure {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({ code, operation: 'canonical_value' }),
  });
}

function validUnicode(value: string): boolean {
  if (value.normalize('NFC') !== value) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function validateString(value: string, key: boolean): CanonicalFailure | undefined {
  const byteLength = encoder.encode(value).byteLength;
  if (byteLength > (key ? PROTOCOL_CANONICAL_LIMITS.maxObjectKeyBytes : PROTOCOL_CANONICAL_LIMITS.maxStringBytes)) {
    return fail('RESOURCE_LIMIT_EXCEEDED');
  }
  if (!validUnicode(value)) return fail('NON_CANONICAL_VALUE');
  return undefined;
}

function validateArray(value: readonly unknown[], depth: number, state: ValidationState): CanonicalFailure | undefined {
  if (Object.getPrototypeOf(value) !== Array.prototype) return fail('NON_CANONICAL_VALUE');
  if (value.length > PROTOCOL_CANONICAL_LIMITS.maxArrayEntries) return fail('RESOURCE_LIMIT_EXCEEDED');
  const names = Object.getOwnPropertyNames(value);
  if (names.length > PROTOCOL_CANONICAL_LIMITS.maxArrayEntries + 1) return fail('RESOURCE_LIMIT_EXCEEDED');
  if (Object.getOwnPropertySymbols(value).length > 0) return fail('NON_CANONICAL_VALUE');
  for (const name of names) {
    if (name === 'length') continue;
    if (!ARRAY_INDEX.test(name) || Number(name) >= value.length) return fail('NON_CANONICAL_VALUE');
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('NON_CANONICAL_VALUE');
    const failure = validateValue(descriptor.value, depth + 1, state);
    if (failure) return failure;
  }
  return undefined;
}

function validateObject(value: object, depth: number, state: ValidationState): CanonicalFailure | undefined {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail('NON_CANONICAL_VALUE');
  if (Object.getOwnPropertySymbols(value).length > 0) return fail('NON_CANONICAL_VALUE');
  const names = Object.getOwnPropertyNames(value);
  if (names.length > PROTOCOL_CANONICAL_LIMITS.maxObjectKeys) return fail('RESOURCE_LIMIT_EXCEEDED');
  for (const name of names) {
    const keyFailure = validateString(name, true);
    if (keyFailure) return keyFailure;
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('NON_CANONICAL_VALUE');
    const failure = validateValue(descriptor.value, depth + 1, state);
    if (failure) return failure;
  }
  return undefined;
}

function validateValue(value: unknown, depth: number, state: ValidationState): CanonicalFailure | undefined {
  state.nodes += 1;
  if (state.nodes > PROTOCOL_CANONICAL_LIMITS.maxNodes || depth > PROTOCOL_CANONICAL_LIMITS.maxDepth) {
    return fail('RESOURCE_LIMIT_EXCEEDED');
  }
  if (value === null || typeof value === 'boolean') return undefined;
  if (typeof value === 'string') return validateString(value, false);
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && !Object.is(value, -0) ? undefined : fail('NON_CANONICAL_VALUE');
  }
  if (typeof value !== 'object') return fail('NON_CANONICAL_VALUE');
  if (state.ancestors.has(value)) return fail('NON_CANONICAL_VALUE');
  state.ancestors.add(value);
  const failure = Array.isArray(value)
    ? validateArray(value, depth, state)
    : validateObject(value, depth, state);
  state.ancestors.delete(value);
  return failure;
}

function serialize(value: CanonicalProtocolValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(entry => serialize(entry)).join(',')}]`;
  const object = value as { readonly [key: string]: CanonicalProtocolValue };
  return `{${Object.keys(object).sort(compareUtf8).map(key => `${JSON.stringify(key)}:${serialize(object[key])}`).join(',')}}`;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false;
  return true;
}

function freezeCanonical(value: CanonicalProtocolValue): CanonicalProtocolValue {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const entry of value) freezeCanonical(entry);
  } else {
    for (const entry of Object.values(value)) freezeCanonical(entry);
  }
  return Object.freeze(value);
}

function compareUtf8(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

export function encodeCanonicalProtocolValue(value: unknown): ProtocolResult<Uint8Array> {
  try {
    const failure = validateValue(value, 0, { nodes: 0, ancestors: new WeakSet() });
    if (failure) return failure;
    const bytes = encoder.encode(serialize(value as CanonicalProtocolValue));
    return bytes.byteLength > PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes
      ? protocolFail('INPUT_TOO_LARGE', 'canonical_value')
      : protocolOk(bytes);
  } catch {
    return protocolFail('NON_CANONICAL_VALUE', 'canonical_value');
  }
}

export function decodeCanonicalProtocolValue(bytes: Uint8Array): ProtocolResult<CanonicalProtocolValue> {
  if (!(bytes instanceof Uint8Array)) return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
  if (bytes.byteLength > PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes) return protocolFail('INPUT_TOO_LARGE', 'canonical_value');
  if (bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
  }
  let text: string;
  let parsed: unknown;
  try {
    text = decoder.decode(bytes);
    parsed = JSON.parse(text) as unknown;
  } catch {
    return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
  }
  const encoded = encodeCanonicalProtocolValue(parsed);
  if (!encoded.ok) return encoded;
  if (!equalBytes(encoded.value, bytes)) return protocolFail('NON_CANONICAL_VALUE', 'canonical_value');
  return protocolOk(freezeCanonical(parsed as CanonicalProtocolValue));
}

export function canonicalProtocolText(value: unknown): ProtocolResult<string> {
  const encoded = encodeCanonicalProtocolValue(value);
  return encoded.ok ? protocolOk(decoder.decode(encoded.value)) : encoded;
}
