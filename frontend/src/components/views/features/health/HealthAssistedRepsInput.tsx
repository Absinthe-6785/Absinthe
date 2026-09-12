import type { Ref } from 'react';
import type { StrengthSet, Theme } from '../../../../types';
import {
  fillAssistedRepsTemplate,
  getAssistedRepsBreakdown,
  hasAssistedRepsField,
} from '../../../../lib/healthAssistedReps';

export interface HealthAssistedRepsInputProps {
  set: StrengthSet;
  inputId: string;
  inputRef?: Ref<HTMLInputElement>;
  locked: boolean;
  theme: Theme;
  label: string;
  compactTemplate: string;
  invalidMessage: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}

/** Optional disclosure rendered only after this eligible set activates assistance. */
export function HealthAssistedRepsInput({
  set,
  inputId,
  inputRef,
  locked,
  theme,
  label,
  compactTemplate,
  invalidMessage,
  onChange,
  onBlur,
}: HealthAssistedRepsInputProps) {
  if (!hasAssistedRepsField(set)) return null;

  const breakdown = getAssistedRepsBreakdown(set);
  const draft = String(set.assisted_reps ?? '');
  const invalid = draft.trim() !== '' && Number(draft) !== 0 && breakdown === null;
  const errorId = `${inputId}-error`;

  return (
    <div
      className={`mx-2.5 border-x border-b px-3 py-2.5 ${theme.input} ${theme.border}`}
      data-health-assisted-reps
    >
      <div className="flex min-w-0 items-center gap-2">
        <label htmlFor={inputId} className={`min-w-0 flex-1 text-xs font-bold ${theme.textMuted}`}>
          {label}
        </label>
        {breakdown && (
          <span className={`shrink-0 text-xs font-bold ${theme.textMuted}`} data-health-assisted-breakdown>
            {fillAssistedRepsTemplate(compactTemplate, breakdown)}
          </span>
        )}
        <input
          id={inputId}
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={set.assisted_reps ?? ''}
          disabled={locked}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={event => onChange(event.target.value)}
          onBlur={event => onBlur(event.target.value)}
          className={`w-20 shrink-0 rounded-lg px-2 py-2 text-center text-[16px] font-bold outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${theme.card}`}
        />
      </div>
      {invalid && (
        <p id={errorId} className="pt-1 text-right text-[11px] font-semibold text-red-500" role="alert">
          {invalidMessage}
        </p>
      )}
    </div>
  );
}
