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

type SnapshotResult = ProtocolResult<CanonicalProtocolValue>;

function snapshotArray(value: object, depth: number, state: ValidationState): SnapshotResult {
  if (Object.getPrototypeOf(value) !== Array.prototype) return fail('NON_CANONICAL_VALUE');
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key === 'symbol')) return fail('NON_CANONICAL_VALUE');
  if (keys.length > PROTOCOL_CANONICAL_LIMITS.maxArrayEntries + 1) return fail('RESOURCE_LIMIT_EXCEEDED');
  const names = keys as string[];
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (!lengthDescriptor || !('value' in lengthDescriptor) || lengthDescriptor.enumerable
    || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
    return fail('NON_CANONICAL_VALUE');
  }
  const length = lengthDescriptor.value;
  if (length > PROTOCOL_CANONICAL_LIMITS.maxArrayEntries) return fail('RESOURCE_LIMIT_EXCEEDED');
  for (const name of names) {
    if (name === 'length') continue;
    if (!ARRAY_INDEX.test(name) || Number(name) >= length) return fail('NON_CANONICAL_VALUE');
  }
  if (names.length !== length + 1) return fail('NON_CANONICAL_VALUE');
  const snapshot: CanonicalProtocolValue[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('NON_CANONICAL_VALUE');
    const entry = snapshotValue(descriptor.value, depth + 1, state);
    if (!entry.ok) return entry;
    snapshot.push(entry.value);
  }
  return protocolOk(Object.freeze(snapshot));
}

function snapshotObject(value: object, depth: number, state: ValidationState): SnapshotResult {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail('NON_CANONICAL_VALUE');
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key === 'symbol')) return fail('NON_CANONICAL_VALUE');
  if (keys.length > PROTOCOL_CANONICAL_LIMITS.maxObjectKeys) return fail('RESOURCE_LIMIT_EXCEEDED');
  const names = keys as string[];
  const snapshot: Record<string, CanonicalProtocolValue> = Object.create(null) as Record<string, CanonicalProtocolValue>;
  for (const name of names) {
    const keyFailure = validateString(name, true);
    if (keyFailure) return keyFailure;
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('NON_CANONICAL_VALUE');
    const entry = snapshotValue(descriptor.value, depth + 1, state);
    if (!entry.ok) return entry;
    snapshot[name] = entry.value;
  }
  return protocolOk(Object.freeze(snapshot));
}

function snapshotValue(value: unknown, depth: number, state: ValidationState): SnapshotResult {
  state.nodes += 1;
  if (state.nodes > PROTOCOL_CANONICAL_LIMITS.maxNodes || depth > PROTOCOL_CANONICAL_LIMITS.maxDepth) {
    return fail('RESOURCE_LIMIT_EXCEEDED');
  }
  if (value === null || typeof value === 'boolean') return protocolOk(value);
  if (typeof value === 'string') {
    const failure = validateString(value, false);
    return failure ?? protocolOk(value);
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && !Object.is(value, -0) ? protocolOk(value) : fail('NON_CANONICAL_VALUE');
  }
  if (typeof value !== 'object') return fail('NON_CANONICAL_VALUE');
  if (state.ancestors.has(value)) return fail('NON_CANONICAL_VALUE');
  state.ancestors.add(value);
  try {
    return Array.isArray(value)
      ? snapshotArray(value, depth, state)
      : snapshotObject(value, depth, state);
  } finally {
    state.ancestors.delete(value);
  }
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
    const snapshot = snapshotValue(value, 0, { nodes: 0, ancestors: new WeakSet() });
    if (!snapshot.ok) return snapshot;
    const bytes = encoder.encode(serialize(snapshot.value));
    return bytes.byteLength > PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes
      ? protocolFail('INPUT_TOO_LARGE', 'canonical_value')
      : protocolOk(bytes);
  } catch {
    return protocolFail('NON_CANONICAL_VALUE', 'canonical_value');
  }
}

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const bufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer')?.get;
const byteOffsetGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteOffset')?.get;
const byteLengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength')?.get;

function copyCanonicalBytes(value: unknown): ProtocolResult<Uint8Array> {
  try {
    if (!(value instanceof Uint8Array) || !bufferGetter || !byteOffsetGetter || !byteLengthGetter) {
      return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
    }
    const buffer = bufferGetter.call(value) as ArrayBufferLike;
    const byteOffset = byteOffsetGetter.call(value) as number;
    const byteLength = byteLengthGetter.call(value) as number;
    if (!(buffer instanceof ArrayBuffer)) return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
    return protocolOk(new Uint8Array(new Uint8Array(buffer, byteOffset, byteLength)));
  } catch {
    return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
  }
}

export function decodeCanonicalProtocolValue(bytes: unknown): ProtocolResult<CanonicalProtocolValue> {
  const copied = copyCanonicalBytes(bytes);
  if (!copied.ok) return copied;
  const input = copied.value;
  if (input.byteLength > PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes) return protocolFail('INPUT_TOO_LARGE', 'canonical_value');
  if (input.byteLength >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
    return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(input)) as unknown;
  } catch {
    return protocolFail('INVALID_ENCODED_INPUT', 'canonical_value');
  }
  const snapshot = snapshotValue(parsed, 0, { nodes: 0, ancestors: new WeakSet() });
  if (!snapshot.ok) return snapshot;
  const encoded = encoder.encode(serialize(snapshot.value));
  if (encoded.byteLength > PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes) {
    return protocolFail('INPUT_TOO_LARGE', 'canonical_value');
  }
  if (!equalBytes(encoded, input)) return protocolFail('NON_CANONICAL_VALUE', 'canonical_value');
  return snapshot;
}

export function canonicalProtocolText(value: unknown): ProtocolResult<string> {
  const encoded = encodeCanonicalProtocolValue(value);
  return encoded.ok ? protocolOk(decoder.decode(encoded.value)) : encoded;
}
