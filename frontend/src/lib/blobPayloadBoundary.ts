export const RAW_BLOB_DATA_PLACEHOLDER = '[blob-data-omitted:attachment-boundary]';

const RAW_BLOB_DATA_URL_PATTERN =
  String.raw`\bdata:(?:image|audio|video|application\/pdf|application\/octet-stream|application\/zip|application\/x-zip-compressed)[^,\s)"']*,[^\s)"']+`;

export function containsRawBlobData(value: unknown): boolean {
  return typeof value === 'string' && new RegExp(RAW_BLOB_DATA_URL_PATTERN, 'i').test(value);
}

export function stripRawBlobData(value: string): string {
  return value.replace(new RegExp(RAW_BLOB_DATA_URL_PATTERN, 'gi'), RAW_BLOB_DATA_PLACEHOLDER);
}

export function sanitizeStringRecordForSync(
  record: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!record) return undefined;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    sanitized[key] = stripRawBlobData(value);
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeRelationsForSync(
  relations: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!relations) return undefined;
  const sanitized: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(relations)) {
    const safeValues = values.filter(value => !containsRawBlobData(value));
    if (safeValues.length > 0) sanitized[key] = safeValues;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
