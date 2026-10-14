import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';

const lifetimeBrand: unique symbol = Symbol('HealthWorkoutDateLifetime');
const issuedLifetimes = new WeakSet<object>();

export type HealthWorkoutDateLifetime = Readonly<{ readonly [lifetimeBrand]: true }>;

export type HealthWorkoutOperationScope = Readonly<{
  accountOperation: HealthAccountGenerationToken;
  dateKey: string;
  dateLifetime: HealthWorkoutDateLifetime;
}>;

export type CommittedWorkoutAuthority = HealthWorkoutOperationScope;

function validContext(account: HealthAccountGenerationToken, dateKey: string): boolean {
  return !!account && typeof account.accountId === 'string' && account.accountId.trim().length > 0
    && Number.isSafeInteger(account.generation) && account.generation >= 0
    && typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    && Number.isFinite(Date.parse(`${dateKey}T00:00:00Z`))
    && new Date(`${dateKey}T00:00:00Z`).toISOString().slice(0, 10) === dateKey;
}

function validScope(scope: HealthWorkoutOperationScope | null): scope is HealthWorkoutOperationScope {
  return !!scope && validContext(scope.accountOperation, scope.dateKey)
    && !!scope.dateLifetime && issuedLifetimes.has(scope.dateLifetime);
}

function sameAccount(a: HealthAccountGenerationToken, b: HealthAccountGenerationToken): boolean {
  return a.accountId === b.accountId && a.generation === b.generation;
}

/** Called only by the committed layout owner in production, never by render/capture. */
export function createHealthWorkoutOperationAuthority(
  accountOperation: HealthAccountGenerationToken,
  dateKey: string,
): CommittedWorkoutAuthority | null {
  if (!validContext(accountOperation, dateKey)) return null;
  const dateLifetime = Object.freeze({ [lifetimeBrand]: true as const });
  issuedLifetimes.add(dateLifetime);
  return Object.freeze({ accountOperation: Object.freeze({ ...accountOperation }), dateKey, dateLifetime });
}

export function captureHealthWorkoutOperationScope(
  renderBound: CommittedWorkoutAuthority | null,
  renderAccount: HealthAccountGenerationToken,
  renderDateKey: string,
  current: CommittedWorkoutAuthority | null,
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,
): HealthWorkoutOperationScope | null {
  if (!validContext(renderAccount, renderDateKey) || !validScope(renderBound)
    || !sameAccount(renderBound.accountOperation, renderAccount) || renderBound.dateKey !== renderDateKey
    || !isCurrentHealthWorkoutOperationScope(renderBound, current, isCurrentAccountOperation)) return null;
  return Object.freeze({
    accountOperation: Object.freeze({ ...renderAccount }),
    dateKey: renderDateKey,
    dateLifetime: renderBound.dateLifetime,
  });
}

export function isCurrentHealthWorkoutOperationScope(
  scope: HealthWorkoutOperationScope,
  current: CommittedWorkoutAuthority | null,
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,
): boolean {
  return validScope(scope) && validScope(current)
    && scope.dateLifetime === current.dateLifetime && scope.dateKey === current.dateKey
    && sameAccount(scope.accountOperation, current.accountOperation)
    && isCurrentAccountOperation(scope.accountOperation);
}
