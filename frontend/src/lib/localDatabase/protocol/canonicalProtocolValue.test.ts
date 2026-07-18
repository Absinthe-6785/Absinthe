import { describe, expect, it } from 'vitest';

import {
  canonicalProtocolText,
  decodeCanonicalProtocolValue,
  encodeCanonicalProtocolValue,
  PROTOCOL_CANONICAL_LIMITS,
} from './canonicalProtocolValue';
import {
  buildCanonicalProtocolPreimage,
  digestCanonicalProtocolRecord,
} from './canonicalProtocolPreimage';

const bytes = (value: string) => new TextEncoder().encode(value);

function code(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

describe('K-333A canonical production values', () => {
  it('uses deterministic UTF-8, lexicographic object keys, and preserved array order', () => {
    const encoded = canonicalProtocolText({ z: 2, 10: 'ten', 2: 'two', a: ['é', 1, true, null] });
    expect(encoded).toEqual({ ok: true, value: '{"10":"ten","2":"two","a":["é",1,true,null],"z":2}' });
    expect(canonicalProtocolText({ a: 1, z: 2 })).toEqual(canonicalProtocolText({ z: 2, a: 1 }));
    expect(canonicalProtocolText(['second', 'first'])).toEqual({ ok: true, value: '["second","first"]' });
    expect(canonicalProtocolText({ ['\u{10000}']: 1, ['\ue000']: 2 })).toEqual({
      ok: true, value: '{"":2,"𐀀":1}',
    });
  });

  it.each([
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['negative zero', -0],
    ['non-integer', 1.5],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['bigint', BigInt(1)],
    ['Date', new Date(0)],
    ['Map', new Map()],
    ['Set', new Set()],
    ['function', () => undefined],
    ['symbol', Symbol('value')],
    ['class instance', new (class Sample { value = 1; })()],
    ['toJSON hook', { toJSON: () => ({ value: 1 }) }],
    ['decomposed NFC', 'e\u0301'],
    ['unpaired high surrogate', '\ud800'],
    ['unpaired low surrogate', '\udc00'],
  ])('rejects %s without coercion', (_label, value) => {
    expect(code(encodeCanonicalProtocolValue(value))).toBe('NON_CANONICAL_VALUE');
  });

  it('rejects cycles, accessors, symbols, non-enumerable properties, sparse arrays, and extra array keys', () => {
    const cycle: { self?: unknown } = {}; cycle.self = cycle;
    const accessor = Object.defineProperty({}, 'secret', { enumerable: true, get: () => 'not-run' });
    const hidden = Object.defineProperty({}, 'hidden', { enumerable: false, value: 1 });
    const symbol = { value: 1 }; Object.defineProperty(symbol, Symbol('hidden'), { value: 2 });
    const sparse = new Array(2); sparse[1] = 'present';
    const extra = [1] as number[] & { extra?: number }; extra.extra = 2;
    for (const value of [cycle, accessor, hidden, symbol, sparse, extra]) {
      expect(code(encodeCanonicalProtocolValue(value))).toBe('NON_CANONICAL_VALUE');
    }
  });

  it('accepts shared acyclic values and null-prototype data objects', () => {
    const shared = Object.freeze({ value: 1 });
    expect(encodeCanonicalProtocolValue([shared, shared]).ok).toBe(true);
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, { value: 1 });
    expect(canonicalProtocolText(nullPrototype)).toEqual({ ok: true, value: '{"value":1}' });
  });

  it('enforces depth, node, string, key, array, and encoded-byte ceilings', () => {
    let deep: unknown = null;
    for (let index = 0; index <= PROTOCOL_CANONICAL_LIMITS.maxDepth; index += 1) deep = [deep];
    const manyNodes = Array.from({ length: PROTOCOL_CANONICAL_LIMITS.maxArrayEntries }, () =>
      Array.from({ length: PROTOCOL_CANONICAL_LIMITS.maxArrayEntries }, () => 1));
    const tooManyKeys = Object.fromEntries(Array.from(
      { length: PROTOCOL_CANONICAL_LIMITS.maxObjectKeys + 1 }, (_, index) => [`k${index}`, index],
    ));
    const longString = 'a'.repeat(PROTOCOL_CANONICAL_LIMITS.maxStringBytes + 1);
    const longKey = { ['a'.repeat(PROTOCOL_CANONICAL_LIMITS.maxObjectKeyBytes + 1)]: 1 };
    const longArray = Array.from({ length: PROTOCOL_CANONICAL_LIMITS.maxArrayEntries + 1 }, () => 1);
    for (const value of [deep, manyNodes, tooManyKeys, longString, longKey, longArray]) {
      expect(code(encodeCanonicalProtocolValue(value))).toBe('RESOURCE_LIMIT_EXCEEDED');
    }
    expect(code(decodeCanonicalProtocolValue(new Uint8Array(PROTOCOL_CANONICAL_LIMITS.maxEncodedBytes + 1))))
      .toBe('INPUT_TOO_LARGE');
  });

  it.each([
    ['invalid UTF-8', new Uint8Array([0xc3, 0x28]), 'INVALID_ENCODED_INPUT'],
    ['UTF-8 BOM', new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), 'INVALID_ENCODED_INPUT'],
    ['invalid JSON', bytes('{'), 'INVALID_ENCODED_INPUT'],
    ['valid prefix plus trailing bytes', bytes('{}trailing'), 'INVALID_ENCODED_INPUT'],
    ['whitespace', bytes('{"a": 1}'), 'NON_CANONICAL_VALUE'],
    ['object key order', bytes('{"b":1,"a":2}'), 'NON_CANONICAL_VALUE'],
    ['duplicate key', bytes('{"a":1,"a":2}'), 'NON_CANONICAL_VALUE'],
    ['escaped canonical character', bytes('{"value":"\\u00e9"}'), 'NON_CANONICAL_VALUE'],
  ])('strictly rejects %s', (_label, input, expected) => {
    expect(code(decodeCanonicalProtocolValue(input))).toBe(expected);
  });

  it('round-trips canonical bytes exactly', () => {
    const encoded = encodeCanonicalProtocolValue({ count: 2, values: ['a', 'b'] });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(decodeCanonicalProtocolValue(encoded.value)).toEqual({
      ok: true, value: { count: 2, values: ['a', 'b'] },
    });
  });

  it('rejects deeply nested encoded input after the byte ceiling and before record dispatch', () => {
    const malicious = bytes(`${'['.repeat(100)}null${']'.repeat(100)}`);
    expect(code(decodeCanonicalProtocolValue(malicious))).toBe('RESOURCE_LIMIT_EXCEEDED');
  });
});

describe('K-333A canonical preimages', () => {
  it('frames domain, version, and payload with UTF-8 byte lengths', () => {
    const preimage = buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 1, { value: 'é' });
    expect(preimage.ok).toBe(true);
    if (!preimage.ok) return;
    expect(new TextDecoder().decode(preimage.value)).toBe(
      'absinthe-protocol-preimage-v1\nD:27:absinthe.writer_identity.v1\nV:1\nP:14:{"value":"é"}',
    );
  });

  it('produces a stable digest vector and domain-separated digests', () => {
    const writer = digestCanonicalProtocolRecord('absinthe.writer_identity.v1', 1, { value: 1 });
    const session = digestCanonicalProtocolRecord('absinthe.writer_session.v1', 1, { value: 1 });
    expect(writer).toEqual({ ok: true, value: 'd81ebf6c07fa524d9d03a29a23cf6d0ac2af17b81896c10e2108728c6b3e9675' });
    expect(session.ok).toBe(true);
    if (writer.ok && session.ok) expect(session.value).not.toBe(writer.value);
  });

  it('changes bytes for domain, record version, and payload and cannot concatenate ambiguous fields', () => {
    const base = buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 1, { left: 'ab', right: 'c' });
    const same = buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 1, { right: 'c', left: 'ab' });
    const domain = buildCanonicalProtocolPreimage('absinthe.writer_session.v1', 1, { left: 'ab', right: 'c' });
    const version = buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 2, { left: 'ab', right: 'c' });
    const payload = buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 1, { left: 'a', right: 'bc' });
    expect(base.ok && same.ok && new TextDecoder().decode(base.value))
      .toBe(same.ok && new TextDecoder().decode(same.value));
    for (const different of [domain, version, payload]) {
      expect(base.ok && different.ok && new TextDecoder().decode(base.value))
        .not.toBe(different.ok && new TextDecoder().decode(different.value));
    }
  });

  it('returns the canonicalization failure and no preimage or digest sentinel', () => {
    const preimage = buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 1, { value: Number.NaN });
    const digest = digestCanonicalProtocolRecord('absinthe.writer_identity.v1', 1, { value: Number.NaN });
    expect(preimage).toEqual({ ok: false, error: { code: 'NON_CANONICAL_VALUE', operation: 'canonical_value' } });
    expect(digest).toEqual(preimage);
    expect(preimage).not.toHaveProperty('value');
    expect(digest).not.toHaveProperty('value');
  });

  it('rejects unregistered domains and invalid versions without a digest sentinel', () => {
    expect(code(buildCanonicalProtocolPreimage(
      'absinthe.unregistered.v1' as 'absinthe.writer_identity.v1', 1, {},
    ))).toBe('INVALID_PREIMAGE_DOMAIN');
    expect(code(buildCanonicalProtocolPreimage('absinthe.writer_identity.v1', 0, {}))).toBe('INVALID_INTEGER');
  });
});
