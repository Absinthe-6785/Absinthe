import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';

export interface HealthWorkoutOperationScope {
  accountOperation: HealthAccountGenerationToken;
  dateKey: string;
}

export function isCurrentHealthWorkoutOperationScope(
  scope: HealthWorkoutOperationScope,
  currentDateKey: string,
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,
): boolean {
  return scope.dateKey === currentDateKey && isCurrentAccountOperation(scope.accountOperation);
}
