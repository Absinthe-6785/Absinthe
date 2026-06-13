import { useEffect, useState } from 'react';
import {
  isMobileWidth,
  isNarrowWidth,
  isTabletWidth,
  VIEWPORT_BREAKPOINTS,
} from '../lib/responsiveLayout';

export interface ViewportLayout {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isNarrow: boolean;
}

export function useViewportLayout(): ViewportLayout {
  const [width, setWidth] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_BREAKPOINTS.narrow),
  );

  useEffect(() => {
    const onChange = () => setWidth(window.innerWidth);
    const mqlMobile = window.matchMedia(`(max-width: ${VIEWPORT_BREAKPOINTS.mobile - 1}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${VIEWPORT_BREAKPOINTS.tablet - 1}px)`);
    mqlMobile.addEventListener('change', onChange);
    mqlTablet.addEventListener('change', onChange);
    onChange();
    return () => {
      mqlMobile.removeEventListener('change', onChange);
      mqlTablet.removeEventListener('change', onChange);
    };
  }, []);

  return {
    width,
    isMobile: isMobileWidth(width),
    isTablet: isTabletWidth(width),
    isNarrow: isNarrowWidth(width),
  };
}
