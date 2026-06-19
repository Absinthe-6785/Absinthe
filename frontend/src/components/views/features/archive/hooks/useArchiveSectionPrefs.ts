import { useCallback, useMemo, useState } from 'react';
import {
  readArchiveSectionPrefs,
  writeArchiveSectionPrefs,
  type ArchiveSectionPrefKey,
  type ArchiveSectionPrefs,
} from '../../knowledge/archive/archiveSectionPrefs';

export function useArchiveSectionPrefs(): {
  prefs: ArchiveSectionPrefs;
  toggle: (key: ArchiveSectionPrefKey) => void;
} {
  const [prefs, setPrefs] = useState<ArchiveSectionPrefs>(() => readArchiveSectionPrefs());

  const toggle = useCallback((key: ArchiveSectionPrefKey) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      writeArchiveSectionPrefs(next);
      return next;
    });
  }, []);

  return useMemo(() => ({ prefs, toggle }), [prefs, toggle]);
}
