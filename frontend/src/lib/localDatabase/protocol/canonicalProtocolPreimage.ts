import { sha256Hex } from '../outboxIdentity';
import { encodeCanonicalProtocolValue } from './canonicalProtocolValue';
import { protocolFail, protocolOk, type ProtocolResult } from './protocolResult';

export const PROTOCOL_PREIMAGE_VERSION = 1 as const;

export const PROTOCOL_PREIMAGE_DOMAINS = Object.freeze([
  'absinthe.writer_identity.v1',
  'absinthe.writer_session.v1',
  'absinthe.source_transaction_reference.v1',
  'absinthe.source_authority.v1',
  'absinthe.operation.v1',
  'absinthe.admission.v1',
  'absinthe.immutable_outbox_intent.v1',
  'absinthe.terminal_state.v1',
] as const);

export type ProtocolPreimageDomain = typeof PROTOCOL_PREIMAGE_DOMAINS[number];

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const registeredDomains = new Set<string>(PROTOCOL_PREIMAGE_DOMAINS);

export function buildCanonicalProtocolPreimage(
  domain: ProtocolPreimageDomain,
  recordVersion: number,
  payload: unknown,
): ProtocolResult<Uint8Array> {
  if (!registeredDomains.has(domain)) return protocolFail('INVALID_PREIMAGE_DOMAIN', 'build_preimage', 'domain');
  if (!Number.isSafeInteger(recordVersion) || recordVersion <= 0) {
    return protocolFail('INVALID_INTEGER', 'build_preimage', 'recordVersion');
  }
  const payloadBytes = encodeCanonicalProtocolValue(payload);
  if (!payloadBytes.ok) return payloadBytes;
  const domainBytes = encoder.encode(domain);
  const frame = [
    'absinthe-protocol-preimage-v1\n',
    `D:${domainBytes.byteLength}:${domain}\n`,
    `V:${recordVersion}\n`,
    `P:${payloadBytes.value.byteLength}:`,
    decoder.decode(payloadBytes.value),
  ].join('');
  return protocolOk(encoder.encode(frame));
}

export function digestCanonicalProtocolRecord(
  domain: ProtocolPreimageDomain,
  recordVersion: number,
  payload: unknown,
): ProtocolResult<string> {
  const preimage = buildCanonicalProtocolPreimage(domain, recordVersion, payload);
  return preimage.ok
    ? protocolOk(sha256Hex(decoder.decode(preimage.value)))
    : preimage;
}
