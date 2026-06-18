import type { ElementType } from 'react';
import type { Theme } from '../../types';
import { ProductEmptyState } from './ProductEmptyState';

interface EmptyStateProps {
  text: string;
  icon: ElementType;
  theme: Theme;
  onClick?: () => void;
  description?: string;
  actionLabel?: string;
  dataHook?: string;
}

/** Tailwind workspace empty state — K-99 extends with description and explicit CTA. */
export const EmptyState = ({
  text,
  icon,
  theme,
  onClick,
  description,
  actionLabel,
  dataHook,
}: EmptyStateProps) => {
  if (onClick && !actionLabel) {
    const Icon = icon;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        data-product-empty={dataHook ?? true}
        {...(dataHook ? { [`data-${dataHook}`]: 'true' } : {})}
        className={`flex flex-col items-center justify-center h-full opacity-50 ${theme.textMuted} p-6 text-center cursor-pointer hover:opacity-80 transition-opacity`}
      >
        <Icon size={32} className="mb-3" />
        <p className="text-sm font-semibold">{text}</p>
        {description ? <p className="text-xs opacity-80 mt-1 max-w-xs">{description}</p> : null}
      </div>
    );
  }

  const Icon = icon;
  return (
    <ProductEmptyState
      variant="tailwind"
      theme={theme}
      icon={Icon}
      title={text}
      description={description}
      dataHook={dataHook}
      primaryAction={onClick && actionLabel ? { label: actionLabel, onClick } : undefined}
    />
  );
};
