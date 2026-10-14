import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  createHealthWorkoutOperationAuthority,
  type CommittedWorkoutAuthority,
} from './healthWorkoutOperationScope';

/** In-memory UI admission only. No draft, reader or persistence ownership. */
export function useHealthWorkoutOperationLifetime(accountId: string, generation: number, dateKey: string) {
  const current = useRef<CommittedWorkoutAuthority | null>(null);
  const [publication, setPublication] = useState<CommittedWorkoutAuthority | null>(null);
  const getCurrent = useCallback(() => current.current, []);

  useLayoutEffect(() => {
    const authority = createHealthWorkoutOperationAuthority({ accountId, generation }, dateKey);
    current.current = authority;
    // Bind closures through state, never by reading the current ref during render.
    setPublication(authority);
    return () => {
      if (current.current === authority) current.current = null;
    };
  }, [accountId, generation, dateKey]);

  return { publication, getCurrent };
}
