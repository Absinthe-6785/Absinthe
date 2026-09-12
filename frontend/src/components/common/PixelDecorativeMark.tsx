import type { ReactNode } from 'react';

export type PixelDecorativeMarkVariant = 'identity' | 'trace' | 'orbit';
export type PixelDecorativeMarkSize = 'xs' | 'sm' | 'md';

interface PixelDecorativeMarkProps {
  readonly variant: PixelDecorativeMarkVariant;
  readonly size?: PixelDecorativeMarkSize;
  readonly className?: string;
}

const PIXEL_COSMOS_MARK_SIZE: Record<PixelDecorativeMarkSize, number> = {
  xs: 12,
  sm: 24,
  md: 36,
};

const PIXEL_COSMOS_MARKS: Record<PixelDecorativeMarkVariant, ReactNode> = {
  identity: (
    <>
      <rect x="5" y="5" width="2" height="2" fill="var(--cosmos-pale-blue-dot)" />
      <rect x="1" y="7" width="1" height="1" fill="var(--cosmos-satellite)" />
      <rect x="9" y="3" width="1" height="1" fill="var(--cosmos-starlight)" />
      <rect x="8" y="8" width="2" height="1" fill="var(--cosmos-orbit)" />
    </>
  ),
  trace: (
    <>
      <rect x="1" y="8" width="2" height="1" fill="var(--cosmos-orbit)" />
      <rect x="4" y="6" width="1" height="1" fill="var(--cosmos-satellite)" />
      <rect x="6" y="5" width="2" height="2" fill="var(--cosmos-pale-blue-dot)" />
      <rect x="9" y="2" width="1" height="1" fill="var(--cosmos-starlight)" />
      <rect x="9" y="8" width="2" height="1" fill="var(--cosmos-trace-glow)" />
    </>
  ),
  orbit: (
    <>
      <rect x="2" y="3" width="1" height="4" fill="var(--cosmos-orbit)" />
      <rect x="3" y="2" width="4" height="1" fill="var(--cosmos-orbit)" />
      <rect x="7" y="3" width="2" height="1" fill="var(--cosmos-orbit)" />
      <rect x="8" y="4" width="1" height="2" fill="var(--cosmos-orbit)" />
      <rect x="7" y="7" width="2" height="2" fill="var(--cosmos-pale-blue-dot)" />
    </>
  ),
};

/** Static decorative identity grammar. It must never communicate product state. */
export function PixelDecorativeMark({
  variant,
  size = 'xs',
  className = '',
}: PixelDecorativeMarkProps) {
  const pixelSize = PIXEL_COSMOS_MARK_SIZE[size];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      width={pixelSize}
      height={pixelSize}
      shapeRendering="crispEdges"
      className={`pointer-events-none select-none ${className}`.trim()}
      data-pixel-cosmos-mark
      data-pixel-cosmos-variant={variant}
      data-pixel-cosmos-size={size}
    >
      {PIXEL_COSMOS_MARKS[variant]}
    </svg>
  );
}
