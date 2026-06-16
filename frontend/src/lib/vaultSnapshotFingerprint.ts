/** Stable fingerprint for skip-if-unchanged snapshot writes. */
export function fingerprintString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintJson(value: unknown): string {
  return fingerprintString(JSON.stringify(value));
}

/**
 * Stable vault content identity for snapshot dedupe and validation.
 * Excludes export envelope fields (exportedAt, contentFingerprint, kind, scope).
 */
export function fingerprintPortableVaultContent(parts: {
  notes: unknown;
  folders: unknown;
  extensions: unknown;
}): string {
  return fingerprintJson({
    notes: parts.notes,
    folders: parts.folders,
    extensions: parts.extensions,
  });
}
