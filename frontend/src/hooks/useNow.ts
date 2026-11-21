import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { DateTime } from 'luxon';

const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Asia/Seoul';
  }
};

const browserDateOf = (time: DateTime) => time.toJSDate().toDateString();

function createClock() {
  const userTimezone = getUserTimezone();
  const readTime = () => DateTime.now().setZone(userTimezone);
  let minute = readTime();
  let day = minute;
  let browserDate = browserDateOf(minute);
  const listeners = new Set<() => void>();

  return {
    userTimezone,
    getMinute: () => minute,
    getDay() {
      // A render can follow a browser timezone change before the next tick.
      // Match the last sample's native day without reading the clock again.
      return day === minute || browserDateOf(day) === browserDateOf(minute) ? day : minute;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    tick() {
      minute = readTime();
      // Shared helpers use the captured zone, but calendars also read native
      // local dates. After a zone switch the retained instant can land on the
      // wrong native date even when the last published date key is unchanged.
      const nextBrowserDate = browserDateOf(minute);
      if (!minute.hasSame(day, 'day') || nextBrowserDate !== browserDate || nextBrowserDate !== browserDateOf(day)) {
        day = minute;
        browserDate = nextBrowserDate;
      }
      listeners.forEach(listener => listener());
    },
  };
}

/** One minute sampler per mounted owner; date-only views ignore same-day samples. */
export const useNow = (resolution: 'minute' | 'day' = 'minute') => {
  const [clock] = useState(createClock);
  const { userTimezone } = clock;
  const now = useSyncExternalStore(clock.subscribe, resolution === 'minute' ? clock.getMinute : clock.getDay);

  useEffect(() => {
    const interval = setInterval(clock.tick, 60_000);
    return () => clearInterval(interval);
  }, [clock]);

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
