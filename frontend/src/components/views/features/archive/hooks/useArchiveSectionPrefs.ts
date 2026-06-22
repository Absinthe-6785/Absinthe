import { useCallback, useMemo, useState } from 'react';
import {
  readArchiveSectionPrefs,
  writeArchiveSectionPrefs,
  type ArchiveSectionPrefKey,
  type ArchiveSectionPrefs,
} from '../../knowledge/archive/archiveSectionPrefs';

/** K-125D — major archive panels that share single-expand accordion behavior. */
export const ARCHIVE_MAJOR_SECTION_KEYS = [
  'historyCollapsed',
  'deletedCollapsed',
  'snapshotsCollapsed',
  'timelineCollapsed',
] as const;

export type ArchiveMajorSectionKey = typeof ARCHIVE_MAJOR_SECTION_KEYS[number];

export function useArchiveSectionPrefs(): {
  prefs: ArchiveSectionPrefs;
  toggle: (key: ArchiveSectionPrefKey) => void;
  toggleMajor: (key: ArchiveMajorSectionKey) => void;
} {
  const [prefs, setPrefs] = useState<ArchiveSectionPrefs>(() => readArchiveSectionPrefs());

  const toggle = useCallback((key: ArchiveSectionPrefKey) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      writeArchiveSectionPrefs(next);
      return next;
    });
  }, []);

  const toggleMajor = useCallback((key: ArchiveMajorSectionKey) => {
    setPrefs(prev => {
      const isExpanded = !prev[key];
      const next = { ...prev };
      if (isExpanded) {
        next[key] = true;
      } else {
        for (const sectionKey of ARCHIVE_MAJOR_SECTION_KEYS) {
          next[sectionKey] = sectionKey !== key;
        }
      }
      writeArchiveSectionPrefs(next);
      return next;
    });
  }, []);

  return useMemo(() => ({ prefs, toggle, toggleMajor }), [prefs, toggle, toggleMajor]);
}
