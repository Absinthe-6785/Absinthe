/** Built-in callout variants — icon + Korean label for slash menu and parsing. */
export interface CalloutPreset {
  id: string;
  label: string;
  desc: string;
  icon: string;
  keywords: string[];
}

export const CALLOUT_PRESETS: readonly CalloutPreset[] = [
  { id: 'info', label: '정보', desc: '안내·참고 정보', icon: 'ℹ', keywords: ['info', 'information', '정보'] },
  { id: 'tip', label: '팁', desc: '유용한 팁', icon: '💡', keywords: ['tip', 'hint', '팁'] },
  { id: 'warning', label: '주의', desc: '주의·경고', icon: '⚠', keywords: ['warning', 'caution', '주의', '경고'] },
  { id: 'summary', label: '요약', desc: '핵심 요약', icon: '📌', keywords: ['summary', '요약'] },
  { id: 'question', label: '질문', desc: '열린 질문', icon: '❓', keywords: ['question', '질문'] },
];

export const DEFAULT_CALLOUT_ICON = '💡';

export function calloutIconForSlashQuery(query: string): string | undefined {
  const q = query.toLowerCase().trim();
  return CALLOUT_PRESETS.find(p => p.id === q)?.icon;
}

export function calloutPresetByIcon(icon: string): CalloutPreset | undefined {
  return CALLOUT_PRESETS.find(p => p.icon === icon);
}
