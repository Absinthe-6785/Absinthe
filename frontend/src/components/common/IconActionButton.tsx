import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import {
  ACTION_SIZE_LG,
  ACTION_SIZE_MD,
  ACTION_SIZE_SM,
  ICON_SIZE_LG,
  ICON_SIZE_MD,
  ICON_SIZE_SM,
} from '../../theme/actionTokens';
import { TOUCH_TARGET_MIN_PX } from '../../lib/responsiveLayout';

export type IconActionSize = 'sm' | 'md' | 'lg';

export interface IconActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconActionSize;
  touch?: boolean;
  children: ReactNode;
}

const SIZE_MAP: Record<IconActionSize, { box: number; icon: number }> = {
  sm: { box: ACTION_SIZE_SM, icon: ICON_SIZE_SM },
  md: { box: ACTION_SIZE_MD, icon: ICON_SIZE_MD },
  lg: { box: ACTION_SIZE_LG, icon: ICON_SIZE_LG },
};

/** Standardized square icon action — K-75. */
export function IconActionButton({
  size = 'md',
  touch = false,
  children,
  style,
  className,
  type = 'button',
  ...rest
}: IconActionButtonProps) {
  const dims = SIZE_MAP[size];
  const box = touch ? TOUCH_TARGET_MIN_PX : dims.box;
  const merged: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: box,
    height: box,
    minWidth: box,
    minHeight: box,
    padding: 0,
    border: 'none',
    borderRadius: 8,
    background: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    ...style,
  };

  return (
    <button type={type} className={className} style={merged} {...rest}>
      {children}
    </button>
  );
}

export { ICON_SIZE_SM, ICON_SIZE_MD };
