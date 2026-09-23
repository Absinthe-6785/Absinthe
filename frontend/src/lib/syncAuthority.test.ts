import { describe, expect, it } from 'vitest';
import {
  DOMAIN_POLICY_REGISTRY,
  SYNC_DOMAINS,
  aggregateSyncUiState,
  canUseDomainDirectRemotePersistence,
  canUseDomainRemoteTransport,
  deriveAccountSyncAvailability,
  domainPolicy,
  domainUsesLocalWorkingCopy,
} from './syncAuthority';

describe('sync authority contracts', () => {
  const available = deriveAccountSyncAvailability({
    authenticated: true,
    capabilityEnabled: true,
    online: true,
  });

  it('keeps account transport availability distinct from domain persistence policy', () => {
    expect(available).toEqual({ state: 'AVAILABLE', transportAvailable: true });
    expect(domainPolicy('health_workouts').policy).toBe('LOCAL_FIRST');
    expect(domainPolicy('planner_events').policy).toBe('REMOTE_FIRST');
    expect(canUseDomainRemoteTransport('health_workouts', available)).toBe(true);
    expect(canUseDomainRemoteTransport('planner_events', available)).toBe(true);
  });

  it('does not rewrite persistence policy when transport becomes offline', () => {
    const offline = deriveAccountSyncAvailability({
      authenticated: true,
      capabilityEnabled: true,
      online: false,
    });

    expect(offline).toEqual({ state: 'OFFLINE', transportAvailable: false });
    expect(domainPolicy('health_workouts').policy).toBe('LOCAL_FIRST');
    expect(domainPolicy('planner_events').policy).toBe('REMOTE_FIRST');
    expect(domainUsesLocalWorkingCopy('health_workouts')).toBe(true);
    expect(canUseDomainRemoteTransport('health_workouts', offline)).toBe(false);
  });

  it('classifies every represented production domain exactly once', () => {
    expect(Object.keys(DOMAIN_POLICY_REGISTRY).sort()).toEqual([...SYNC_DOMAINS].sort());
    expect(SYNC_DOMAINS.map(domain => domainPolicy(domain).policy)).toEqual([
      'LOCAL_FIRST',
      'LOCAL_FIRST',
      'LOCAL_FIRST',
      'LOCAL_FIRST',
      'LOCAL_FIRST',
      'LOCAL_FIRST',
      'LOCAL_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'REMOTE_FIRST',
      'LOCAL_ONLY',
      'LOCAL_ONLY',
      'LOCAL_ONLY',
      'LOCAL_ONLY',
      'REMOTE_FIRST',
      'DEFERRED',
    ]);
    expect(canUseDomainRemoteTransport('health_routine_presets', available)).toBe(true);
    expect(canUseDomainDirectRemotePersistence('health_routine_presets', available)).toBe(false);
  });

  it('prevents local-only and deferred domains from using account transport', () => {
    expect(canUseDomainRemoteTransport('recipe_drafts', available)).toBe(false);
    expect(canUseDomainRemoteTransport('device_preferences', available)).toBe(false);
    expect(canUseDomainRemoteTransport('attachments', available)).toBe(false);
  });

  it('allows direct persistence only for REMOTE_FIRST domains', () => {
    expect(canUseDomainDirectRemotePersistence('planner_events', available)).toBe(true);
    expect(canUseDomainDirectRemotePersistence('recipes', available)).toBe(true);
    expect(canUseDomainDirectRemotePersistence('health_workouts', available)).toBe(false);
    expect(canUseDomainDirectRemotePersistence('account_reset', available)).toBe(false);
    expect(canUseDomainDirectRemotePersistence('recipe_drafts', available)).toBe(false);
    expect(canUseDomainDirectRemotePersistence('attachments', available)).toBe(false);
  });

  it('aggregates shared UI sync state by deterministic severity', () => {
    expect(aggregateSyncUiState([])).toBe('IDLE');
    expect(aggregateSyncUiState(['SYNCED', 'SYNCING'])).toBe('SYNCING');
    expect(aggregateSyncUiState(['RETRYING', 'OFFLINE', 'SYNCED'])).toBe('OFFLINE');
    expect(aggregateSyncUiState(['ERROR', 'CONFLICT', 'SYNCING'])).toBe('CONFLICT');
    expect(aggregateSyncUiState(['CONFLICT', 'ERROR'])).toBe('CONFLICT');
  });
});
