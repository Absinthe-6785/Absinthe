import type { Block } from '../../../blockUtils';
import { validateBlockTree } from './blockTreeValidator';

const MAX_VIOLATIONS_IN_MESSAGE = 5;

/** True in dev and test builds; never in production bundles. */
export function isBlockTreeAssertionEnabled(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env.DEV || import.meta.env.MODE === 'test';
}

export function assertValidBlockTree(blocks: Block[], context: string): void {
  if (!isBlockTreeAssertionEnabled()) return;

  const result = validateBlockTree(blocks);
  if (result.valid) return;

  const errors = result.violations.filter(v => v.severity === 'error');
  const codes = [...new Set(errors.map(v => v.code))];
  const preview = errors
    .slice(0, MAX_VIOLATIONS_IN_MESSAGE)
    .map(v => `- ${v.code}${v.blockId ? ` (${v.blockId})` : ''} at ${v.path}: ${v.message}`)
    .join('\n');
  const overflow = errors.length > MAX_VIOLATIONS_IN_MESSAGE
    ? `\n... and ${errors.length - MAX_VIOLATIONS_IN_MESSAGE} more`
    : '';

  throw new Error(
    `Tree validation failed\nContext: ${context}\nErrors: ${errors.length}\nCodes: ${codes.join(', ')}\n${preview}${overflow}`,
  );
}
