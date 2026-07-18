export const PRODUCTION_PROTOCOL_ERROR_CODES = Object.freeze([
  'INPUT_TOO_LARGE',
  'RESOURCE_LIMIT_EXCEEDED',
  'INVALID_ENCODED_INPUT',
  'NON_CANONICAL_VALUE',
  'INVALID_PREIMAGE_DOMAIN',
  'RECORD_KIND_MISMATCH',
  'UNSUPPORTED_RECORD_VERSION',
  'MISSING_FIELD',
  'UNKNOWN_FIELD',
  'INVALID_FIELD_TYPE',
  'INVALID_IDENTIFIER',
  'INVALID_DIGEST',
  'INVALID_INTEGER',
  'INVALID_ARRAY',
  'INVALID_ENUM_VALUE',
  'DUPLICATE_ENTRY',
  'CANONICAL_DIGEST_MISMATCH',
  'RELATIONSHIP_MISMATCH',
] as const);

export type ProductionProtocolErrorCode = typeof PRODUCTION_PROTOCOL_ERROR_CODES[number];

export interface ProductionProtocolError {
  readonly code: ProductionProtocolErrorCode;
  readonly operation: string;
  readonly field?: string;
}

export type ProtocolResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProductionProtocolError };

export function protocolOk<T>(value: T): ProtocolResult<T> {
  return Object.freeze({ ok: true, value });
}

export function protocolFail<T = never>(
  code: ProductionProtocolErrorCode,
  operation: string,
  field?: string,
): ProtocolResult<T> {
  const error = Object.freeze(field === undefined ? { code, operation } : { code, operation, field });
  return Object.freeze({ ok: false, error });
}
