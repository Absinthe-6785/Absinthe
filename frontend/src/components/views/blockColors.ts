export type BlockTint = 'default' | 'purple' | 'blue' | 'green' | 'yellow' | 'red';

export const BLOCK_TINT_OPTIONS: { id: BlockTint; label: string; bg: string; border: string }[] = [
  { id: 'default', label: '기본', bg: 'transparent', border: 'transparent' },
  { id: 'purple',  label: '보라', bg: 'rgba(139,92,246,0.08)', border: '#8B5CF6' },
  { id: 'blue',    label: '파랑', bg: 'rgba(59,130,246,0.08)', border: '#3B82F6' },
  { id: 'green',   label: '초록', bg: 'rgba(34,197,94,0.08)', border: '#22C55E' },
  { id: 'yellow',  label: '노랑', bg: 'rgba(234,179,8,0.1)', border: '#EAB308' },
  { id: 'red',     label: '빨강', bg: 'rgba(239,68,68,0.08)', border: '#EF4444' },
];

export function blockTintStyle(tint: BlockTint | undefined): { background?: string; borderLeft?: string } {
  const opt = BLOCK_TINT_OPTIONS.find(o => o.id === (tint ?? 'default'));
  if (!opt || opt.id === 'default') return {};
  return {
    background: opt.bg,
    borderLeft: `3px solid ${opt.border}`,
  };
}
