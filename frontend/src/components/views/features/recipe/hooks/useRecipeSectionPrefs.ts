import { useCallback, useMemo, useState } from 'react';
import {
  readRecipeSectionPrefs,
  writeRecipeSectionPrefs,
  type RecipeSectionPrefKey,
  type RecipeSectionPrefs,
} from '../recipeSectionPrefs';

export function useRecipeSectionPrefs(): {
  prefs: RecipeSectionPrefs;
  toggle: (key: RecipeSectionPrefKey) => void;
} {
  const [prefs, setPrefs] = useState<RecipeSectionPrefs>(() => readRecipeSectionPrefs());

  const toggle = useCallback((key: RecipeSectionPrefKey) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      writeRecipeSectionPrefs(next);
      return next;
    });
  }, []);

  return useMemo(() => ({ prefs, toggle }), [prefs, toggle]);
}
