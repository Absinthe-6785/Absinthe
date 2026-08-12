import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isReturnToUseAttachmentIsolationEnabled,
  RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV,
} from './returnToUseAttachmentIsolation';

describe('Return-to-Use attachment isolation gate', () => {
  const env = import.meta.env as Record<string, unknown>;
  let previous: unknown;

  beforeEach(() => {
    previous = env[RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV];
  });

  afterEach(() => {
    if (previous === undefined) delete env[RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV];
    else env[RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV] = previous;
  });

  it.each([
    ['missing', undefined],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
    ['malformed', 'garbage'],
    ['true', 'true'],
    ['one', '1'],
  ])('enables isolation for %s configuration', (_label, value) => {
    if (value === undefined) delete env[RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV];
    else env[RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV] = value;

    expect(isReturnToUseAttachmentIsolationEnabled()).toBe(true);
  });

  it.each([
    ['string false', 'false'],
    ['string zero', '0'],
  ])('disables isolation only for explicit %s configuration', (_label, value) => {
    env[RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV] = value;

    expect(isReturnToUseAttachmentIsolationEnabled()).toBe(false);
  });
});
