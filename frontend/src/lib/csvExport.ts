import { authFetch } from './supabase';
import { API_URL } from './config';
import { isCardioSet } from '../types';

// ── CSV 헬퍼 ──────────────────────────────────────────────────────────────────

/** 셀 값을 CSV 안전 문자열로 변환 (쉼표/줄바꿈/따옴표 이스케이프) */
const cell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const toRow = (values: unknown[]): string => values.map(cell).join(',');

const downloadCsv = (filename: string, rows: string[]): void => {
  const bom = '\uFEFF'; // Excel 한글 깨짐 방지 BOM
  const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ── API fetch 헬퍼 ────────────────────────────────────────────────────────────

const fetchJson = async <T>(path: string): Promise<T> => {
  const res = await authFetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`[${res.status}] ${path}`);
  return res.json() as Promise<T>;
};

// ── 도메인별 CSV 생성 ─────────────────────────────────────────────────────────

interface RangeParams { startDate: string; endDate: string }

const buildSchedulesCsv = async ({ startDate, endDate }: RangeParams): Promise<string[]> => {
  const data = await fetchJson<{
    id: string; date?: string; text: string;
    start_time: string; end_time: string;
    category: string; color: string; is_dday: boolean;
  }[]>(`/api/schedules/range?start_date=${startDate}&end_date=${endDate}`);

  const header = toRow(['date', 'text', 'start_time', 'end_time', 'category', 'color', 'is_dday']);
  const rows = data.map(s =>
    toRow([s.date ?? '', s.text, s.start_time, s.end_time, s.category, s.color, s.is_dday])
  );
  return [header, ...rows];
};

const buildTodosCsv = async ({ startDate, endDate }: RangeParams): Promise<string[]> => {
  const data = await fetchJson<{
    id: string; date?: string; text: string; done: boolean;
  }[]>(`/api/todos/range?start_date=${startDate}&end_date=${endDate}`);

  const header = toRow(['date', 'text', 'done']);
  const rows = data.map(t => toRow([t.date ?? '', t.text, t.done]));
  return [header, ...rows];
};

const buildRoutinesCsv = async ({ startDate, endDate }: RangeParams): Promise<string[]> => {
  const data = await fetchJson<{
    id: string; date?: string; text: string; done: boolean; is_active: boolean;
  }[]>(`/api/routines/range?start_date=${startDate}&end_date=${endDate}`);

  const header = toRow(['date', 'text', 'done', 'is_active']);
  const rows = data.map(r => toRow([r.date ?? '', r.text, r.done, r.is_active]));
  return [header, ...rows];
};

const buildWorkoutsCsv = async ({ startDate, endDate }: RangeParams): Promise<string[]> => {
  const data = await fetchJson<{
    date?: string;
    exercise_blocks: { name: string; type: string };
    sets: unknown[];
  }[]>(`/api/workouts/range?start_date=${startDate}&end_date=${endDate}`);

  const header = toRow(['date', 'exercise', 'type', 'set', 'kg', 'reps', 'time', 'distance', 'done']);
  const rows: string[] = [];

  for (const w of data) {
    const date = w.date ?? '';
    const name = w.exercise_blocks?.name ?? '';
    const type = w.exercise_blocks?.type ?? '';
    for (const s of w.sets as Parameters<typeof isCardioSet>[0][]) {
      if (isCardioSet(s)) {
        rows.push(toRow([date, name, type, s.set, '', '', s.time, s.distance, s.done]));
      } else {
        rows.push(toRow([date, name, type, s.set, s.kg, s.reps, '', '', s.done]));
      }
    }
  }
  return [header, ...rows];
};

const buildInbodyCsv = async ({ startDate, endDate }: RangeParams): Promise<string[]> => {
  const data = await fetchJson<{
    date?: string; weight: number; smm: number; pbf: number;
  }[]>(`/api/inbody/range?start_date=${startDate}&end_date=${endDate}`);

  const header = toRow(['date', 'weight(kg)', 'smm(kg)', 'pbf(%)']);
  const rows = data.map(i => toRow([i.date ?? '', i.weight, i.smm, i.pbf]));
  return [header, ...rows];
};

// ── 섹션 구분선 ───────────────────────────────────────────────────────────────

const section = (title: string): string[] => ['', `## ${title}`, ''];

// ── 공개 API ──────────────────────────────────────────────────────────────────

export interface ExportOptions {
  startDate: string;
  endDate: string;
  onProgress?: (msg: string) => void;
}

/**
 * 전체 데이터(스케줄/투두/루틴/워크아웃/InBody)를 하나의 CSV 파일로 내보냅니다.
 * 각 섹션은 `## 섹션명` 구분선으로 분리됩니다.
 * 다운로드 실패 시 Error를 throw합니다.
 */
export const exportAllToCsv = async ({
  startDate,
  endDate,
  onProgress,
}: ExportOptions): Promise<void> => {
  const range = { startDate, endDate };
  const allRows: string[] = [
    `# Planner Export — ${startDate} ~ ${endDate}`,
  ];

  const steps: [string, () => Promise<string[]>][] = [
    ['Schedules', () => buildSchedulesCsv(range)],
    ['Todos',     () => buildTodosCsv(range)],
    ['Routines',  () => buildRoutinesCsv(range)],
    ['Workouts',  () => buildWorkoutsCsv(range)],
    ['InBody',    () => buildInbodyCsv(range)],
  ];

  for (const [title, builder] of steps) {
    onProgress?.(`Fetching ${title}...`);
    const rows = await builder();
    allRows.push(...section(title), ...rows);
  }

  const filename = `planner_${startDate}_${endDate}.csv`;
  downloadCsv(filename, allRows);
};
