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

export const PROTOCOL_ERROR_LABEL_LIMITS = Object.freeze({
  maxOperationCharacters: 48,
  maxFieldCharacters: 96,
});

const errorCodes = new Set<string>(PRODUCTION_PROTOCOL_ERROR_CODES);
const TRUSTED_LABEL = /^[A-Za-z][A-Za-z0-9_.\[\]-]*$/;

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
  const safeCode = errorCodes.has(code) ? code : 'INVALID_FIELD_TYPE';
  const safeOperation = typeof operation === 'string'
    && operation.length <= PROTOCOL_ERROR_LABEL_LIMITS.maxOperationCharacters
    && TRUSTED_LABEL.test(operation)
    ? operation
    : 'protocol_operation';
  const safeField = typeof field === 'string'
    && field.length <= PROTOCOL_ERROR_LABEL_LIMITS.maxFieldCharacters
    && TRUSTED_LABEL.test(field)
    ? field
    : undefined;
  const error = Object.freeze(safeField === undefined
    ? { code: safeCode, operation: safeOperation }
    : { code: safeCode, operation: safeOperation, field: safeField });
  return Object.freeze({ ok: false, error });
}
