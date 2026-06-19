import { useCallback, useMemo, useState } from 'react';
import {
  readSearchSectionPrefs,
  writeSearchSectionPrefs,
  type SearchSectionPrefKey,
  type SearchSectionPrefs,
} from '../searchSectionPrefs';

export function useSearchSectionPrefs(): {
  prefs: SearchSectionPrefs;
  toggle: (key: SearchSectionPrefKey) => void;
} {
  const [prefs, setPrefs] = useState<SearchSectionPrefs>(() => readSearchSectionPrefs());

  const toggle = useCallback((key: SearchSectionPrefKey) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      writeSearchSectionPrefs(next);
      return next;
    });
  }, []);

  return useMemo(() => ({ prefs, toggle }), [prefs, toggle]);
}
