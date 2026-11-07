import { useCallback, useEffect, useRef, useState } from 'react';
import { writeWorkoutSummaryClipboard } from './workoutSummaryClipboard';
import type { HealthAccountGenerationToken } from '../../../../lib/healthBackfillUiSafety';

export type WorkoutSummaryCopyStatus = 'copied' | 'failed';

export interface WorkoutSummaryCopyContext extends HealthAccountGenerationToken {
  readonly dateKey: string;
  readonly summaryText: string;
}

interface CopyFeedback {
  readonly context: WorkoutSummaryCopyContext;
  readonly operation: number;
  readonly status: WorkoutSummaryCopyStatus;
}

function sameContext(a: WorkoutSummaryCopyContext, b: WorkoutSummaryCopyContext): boolean {
  return a.accountId === b.accountId && a.generation === b.generation
    && a.dateKey === b.dateKey && a.summaryText === b.summaryText;
}

export function useWorkoutSummaryCopy(
  context: WorkoutSummaryCopyContext,
  isCurrentAccountOperation: (token: HealthAccountGenerationToken) => boolean,
) {
  const contextRef = useRef(context);
  contextRef.current = context;
  const accountCheckRef = useRef(isCurrentAccountOperation);
  accountCheckRef.current = isCurrentAccountOperation;
  const operationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    operationRef.current += 1;
    clearTimer();
    setFeedback(null);
  }, [context.accountId, context.generation, context.dateKey, context.summaryText, clearTimer]);

  useEffect(() => () => {
    operationRef.current += 1;
    clearTimer();
  }, [clearTimer]);

  const copy = useCallback(async () => {
    const owner = contextRef.current;
    const operation = ++operationRef.current;
    clearTimer();
    setFeedback(null);
    const isCurrent = () => operationRef.current === operation
      && sameContext(owner, contextRef.current)
      && accountCheckRef.current({ accountId: owner.accountId, generation: owner.generation });

    if (!isCurrent()) return;
    let copied = false;
    try {
      copied = await writeWorkoutSummaryClipboard(owner.summaryText);
    } catch {
      copied = false;
    }
    if (!isCurrent()) return;

    const status: WorkoutSummaryCopyStatus = copied ? 'copied' : 'failed';
    setFeedback({ context: owner, operation, status });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (isCurrent()) setFeedback(current => current?.operation === operation ? null : current);
    }, 2000);
  }, [clearTimer]);

  const status = feedback && sameContext(feedback.context, context)
    && accountCheckRef.current({ accountId: context.accountId, generation: context.generation })
    ? feedback.status : null;

  return { status, copy } as const;
}
