import type { PrevWorkoutPayload } from './prevWorkoutFetch';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';
import { observeOwnerFailure, type OwnerFailureDisposition, type PreviousOwnerData, type WorkoutOwnerEvidence } from './healthWorkoutOwnerAdapters';

export type PreviousState = 'CURRENT' | 'NO_MATCH' | 'REFRESHING' | 'UNAVAILABLE' | 'STALE_OR_SUPPRESSED';
export type PreviousEvidence = Readonly<{
  blockId: string;
  state: PreviousState;
  payload?: PrevWorkoutPayload;
}>;
export type PreviousScope = Readonly<{
  accountId: string;
  beforeDate: string;
  authority: 'local' | 'unsupported';
  /** Established parent eligibility only; never a child publication revision. */
  parentIdentity: string | null;
  rejected: boolean;
}>;
export type LegacyImpact = 'unknown' | readonly Readonly<{ blockId: string; date: string }>[];
export type PreviousLoader = (ids: readonly string[], scope: PreviousScope) => Promise<Record<string, PrevWorkoutPayload>>;
type Flight = { evidence: PreviousEvidence; promise: Promise<PreviousEvidence>; resolve: (value: PreviousEvidence) => void };

/** In-memory proof owner. Successful omission proves per-query NO_MATCH, not whole-source empty. */
export class LegacyPreviousCurrentness {
  private scope: PreviousScope | null = null;
  private lifetime = {};
  private entries = new Map<string, PreviousEvidence>();
  private failures = new Map<string, OwnerFailureDisposition>();
  private flights = new Map<string, Flight>();
  private queued = new Set<string>();
  private dependencies = new Set<string>();
  private mutations = new Map<object, { accountId: string; impact: LegacyImpact }>();
  private scheduled = false;
  private version = 0;
  private publication: object = Object.freeze({});
  private listeners = new Set<() => void>();
  constructor(private readonly load: PreviousLoader) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.version;
  isRejected = () => !!this.scope?.rejected;
  captureOperation(): () => boolean {
    const lifetime = this.lifetime;
    return () => this.lifetime === lifetime && !!this.scope && !this.scope.rejected;
  }
  private publish() {
    // Tag the existing publication; this adds no lifecycle, subscription or read.
    this.publication = Object.freeze({});
    this.version++; for (const listener of this.listeners) listener();
  }
  captureOwnerEvidence(): WorkoutOwnerEvidence<'D', PreviousOwnerData> | null {
    const scope = this.scope, lifetime = this.lifetime, publication = this.publication;
    if (!scope) return null;
    const consumedBlockIds = Object.freeze([...this.dependencies]);
    return Object.freeze({ owner: 'D', lifetime, publication,
      // Aggregate current-flight tag only, never a finite retry/execution permit.
      request: this.flights.size ? publication : null, inFlight: this.flights.size > 0,
      isCurrent: () => this.scope === scope && this.lifetime === lifetime && this.publication === publication,
      data: Object.freeze({ scope: Object.freeze({ ...scope }), rejected: scope.rejected,
        consumedBlockIds, entries: Object.freeze(consumedBlockIds.map(id => this.evidence(id))),
        failures: Object.freeze(consumedBlockIds.flatMap(id => this.failures.has(id) ? [this.failures.get(id)!] : [])) }),
    });
  }
  matches(scope: PreviousScope): boolean {
    const current = this.scope;
    return !!current && current.accountId === scope.accountId && current.beforeDate === scope.beforeDate
      && current.authority === scope.authority && current.rejected === scope.rejected
      && (!scope.parentIdentity || current.parentIdentity === scope.parentIdentity);
  }
  configure(scope: PreviousScope) {
    if (this.matches(scope)) return;
    const sameQuery = this.scope?.accountId === scope.accountId && this.scope?.beforeDate === scope.beforeDate
      && this.scope?.authority === scope.authority;
    const parentIdentity = scope.parentIdentity ?? (sameQuery ? this.scope?.parentIdentity ?? null : null);
    this.close();
    this.scope = { ...scope, parentIdentity };
    this.publish();
  }
  close() {
    this.lifetime = {};
    for (const [id, flight] of this.flights) flight.resolve({ blockId: id, state: 'STALE_OR_SUPPRESSED' });
    this.flights.clear(); this.queued.clear(); this.entries.clear(); this.dependencies.clear();
    this.failures.clear();
    this.scope = null;
    // Active writes are retained across query transitions: returning A must not
    // read before an A write settles. The signal subscriber supplies their account.
    this.publish();
  }
  evidence(id: string): PreviousEvidence {
    return this.entries.get(id) ?? { blockId: id, state: 'STALE_OR_SUPPRESSED' };
  }
  qualified(value: PreviousEvidence): boolean {
    return !this.scope?.rejected && this.entries.get(value.blockId) === value
      && (value.state === 'CURRENT' || value.state === 'NO_MATCH');
  }
  payloads(): Record<string, PrevWorkoutPayload> {
    return Object.fromEntries([...this.entries].flatMap(([id, entry]) => this.qualified(entry) && entry.payload ? [[id, entry.payload]] : []));
  }
  private affected(id: string, impact: LegacyImpact): boolean {
    return impact === 'unknown' || impact.some(row => row.blockId === id && row.date < (this.scope?.beforeDate ?? ''));
  }
  private blocked(id: string): boolean { return [...this.mutations.values()].some(change =>
    change.accountId === this.scope?.accountId && this.affected(id, change.impact)); }
  private revoke(ids: readonly string[]) {
    for (const id of ids) {
      this.entries.set(id, { blockId: id, state: 'STALE_OR_SUPPRESSED' });
      this.failures.delete(id);
      this.flights.get(id)?.resolve(this.evidence(id));
      this.flights.delete(id); this.queued.delete(id);
    }
    this.publish();
  }
  invalidate(impact: LegacyImpact = 'unknown', refresh = true) {
    const ids = [...this.dependencies].filter(id => this.affected(id, impact));
    this.revoke(ids);
    if (refresh) void this.ensure(ids);
  }
  beginMutation(token: object, impact: LegacyImpact, accountId = this.scope?.accountId ?? '') {
    this.mutations.set(token, { accountId, impact });
    this.invalidate(impact, false);
  }
  endMutation(token: object) {
    const change = this.mutations.get(token);
    if (!change) return;
    this.mutations.delete(token);
    // A failed/aborted attempt also needs a fresh verified read; never revive the old proof.
    if (change.accountId === this.scope?.accountId) this.invalidate(change.impact);
  }
  ensure = async (ids: readonly string[]): Promise<PreviousEvidence[]> => {
    if (!this.scope || !this.scope.accountId || this.scope.rejected || this.scope.authority !== 'local') {
      return ids.map(blockId => ({ blockId, state: 'STALE_OR_SUPPRESSED' }));
    }
    let changed = false;
    const results = ids.filter(id => id && id !== '__session__').map(id => {
      this.dependencies.add(id);
      const existing = this.evidence(id);
      if (this.qualified(existing) || existing.state === 'UNAVAILABLE' || this.blocked(id)) return Promise.resolve(existing);
      const flight = this.flights.get(id);
      if (flight) return flight.promise;
      let resolve!: Flight['resolve'];
      const promise = new Promise<PreviousEvidence>(done => { resolve = done; });
      const evidence: PreviousEvidence = { blockId: id, state: 'REFRESHING' };
      this.failures.delete(id);
      this.entries.set(id, evidence); this.flights.set(id, { evidence, promise, resolve }); this.queued.add(id);
      changed = true;
      return promise;
    });
    if (this.queued.size && !this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => { this.scheduled = false; void this.flush(); });
    }
    if (changed) this.publish();
    return Promise.all(results);
  };
  private async flush() {
    const scope = this.scope, lifetime = this.lifetime;
    const batch = [...this.queued].map(id => [id, this.flights.get(id)!] as const);
    this.queued.clear();
    if (!scope || !batch.length) return;
    let result: Record<string, PrevWorkoutPayload> | null = null;
    let failure: OwnerFailureDisposition | null = null;
    try { result = await this.load(batch.map(([id]) => id), scope); } catch (error) {
      failure = observeOwnerFailure(error);
      if (error instanceof CompositeWorkoutReadIsolationError && this.lifetime === lifetime
        && batch.some(([id, flight]) => this.flights.get(id) === flight)) {
        this.scope = { ...scope, rejected: true };
        this.revoke([...this.dependencies]);
      }
      // Ordinary failure is never absence. Typed rejection suppresses the whole
      // owner, including other previously qualified blocks, with no auto-repair.
    }
    for (const [id, flight] of batch) {
      if (this.lifetime !== lifetime || this.flights.get(id) !== flight || this.blocked(id) || this.scope?.rejected) continue;
      const value: PreviousEvidence = result === null ? { blockId: id, state: 'UNAVAILABLE' }
        : result[id] ? { blockId: id, state: 'CURRENT', payload: result[id] }
          : { blockId: id, state: 'NO_MATCH' };
      if (failure) this.failures.set(id, failure);
      else this.failures.delete(id);
      this.entries.set(id, value); this.flights.delete(id); flight.resolve(value);
    }
    this.publish();
  }
}
