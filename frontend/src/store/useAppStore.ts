import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings } from '../types';

// Note/NoteFolder 타입·CRUD는 useNotesStore로 이전됨
export type { Note, NoteFolder } from './useNotesStore';

interface StoreState {
  appSettings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void;
  weightUnits: Record<string, 'kg' | 'lbs'>;
  setWeightUnit: (blockId: string, unit: 'kg' | 'lbs') => void;
  toggleWeightUnit: (blockId: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  defaultCategory: 'Study',
  defaultColor: 'gold',
  language: 'en',
  notesFontFamily: 'system',
  notesFontSize: 16,
  notesTextColor: '',
  notesAccentColor: '',
};

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      appSettings: DEFAULT_SETTINGS,

      updateSetting: (key, value) =>
        set(s => ({ appSettings: { ...s.appSettings, [key]: value } })),

      weightUnits: (() => {
        try {
          const raw = localStorage.getItem('planner-storage');
          if (raw) return JSON.parse(raw)?.state?.weightUnits ?? {};
        } catch { /**/ }
        return {};
      })(),

      setWeightUnit: (blockId, unit) =>
        set(s => ({ weightUnits: { ...s.weightUnits, [blockId]: unit } })),

      toggleWeightUnit: (blockId) =>
        set(s => ({
          weightUnits: {
            ...s.weightUnits,
            [blockId]: s.weightUnits[blockId] === 'lbs' ? 'kg' : 'lbs',
          },
        })),
    }),
    {
      name: 'planner-storage',
      storage: createJSONStorage(() => localStorage),
      version: 5,
      partialize: s => ({ appSettings: s.appSettings, weightUnits: s.weightUnits }),
      migrate: (persisted: unknown, fromVersion: number) => {
        const s = persisted as Partial<StoreState>;
        if (fromVersion < 1) {
          return { appSettings: DEFAULT_SETTINGS, weightUnits: {} } as StoreState;
        }
        return {
          ...s,
          appSettings: {
            ...DEFAULT_SETTINGS,
            ...(s.appSettings ?? {}),
            notesFontFamily: (s.appSettings as AppSettings)?.notesFontFamily ?? 'system',
            notesFontSize: (s.appSettings as AppSettings)?.notesFontSize ?? 16,
            notesTextColor: (s.appSettings as AppSettings)?.notesTextColor ?? '',
            notesAccentColor: (s.appSettings as AppSettings)?.notesAccentColor ?? '',
          },
          weightUnits: s.weightUnits ?? {},
        } as StoreState;
      },
      onRehydrateStorage: () => s => {
        if (s && !s.weightUnits) s.weightUnits = {};
      },
    }
  )
);
