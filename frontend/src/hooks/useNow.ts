import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateTime } from 'luxon';

const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Asia/Seoul';
  }
};

/**
 * useNow — 1분마다 갱신되는 현재 시각을 격리된 훅으로 분리.
 *
 * 기존: now가 AppContent에서 관리되어 매 분마다 AppContent 전체(+모든 자식)가 리렌더.
 * 변경 후: 이 훅을 사용하는 컴포넌트만 1분마다 갱신됩니다.
 * ViewProps.now는 여전히 전달되지만, AppContent의 다른 무거운 렌더는 영향 없음.
 */
export const useNow = () => {
  const userTimezone = useMemo(() => getUserTimezone(), []);
  const [now, setNow] = useState(() => DateTime.now().setZone(userTimezone));

  useEffect(() => {
    const interval = setInterval(
      () => setNow(DateTime.now().setZone(userTimezone)),
      60_000
    );
    return () => clearInterval(interval);
  }, [userTimezone]);

  const formatDate = useCallback(
    (date: Date | DateTime) => {
      const dt = date instanceof Date ? DateTime.fromJSDate(date) : date;
      return dt.setZone(userTimezone).toFormat('yyyy-MM-dd');
    },
    [userTimezone]
  );

  const isToday = useCallback(
    (targetDateStr: string) => {
      const target = DateTime.fromFormat(targetDateStr, 'yyyy-MM-dd', { zone: userTimezone });
      return target.isValid && target.hasSame(now, 'day');
    },
    [now, userTimezone]
  );

  return { now, formatDate, isToday };
};
