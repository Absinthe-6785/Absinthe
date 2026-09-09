import { useEffect, useState } from 'react';
import {
  classifyViewportWidth,
  isMobileWidth,
  isNarrowWidth,
  isTabletWidth,
  VIEWPORT_BOUNDARIES,
  VIEWPORT_MEDIA_QUERIES,
  type ViewportCategory,
} from '../lib/responsiveLayout';

export interface ViewportLayout {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isNarrow: boolean;
  category: ViewportCategory;
}

export function useViewportLayout(): ViewportLayout {
  const [width, setWidth] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth : VIEWPORT_BOUNDARIES.wide),
  );

  useEffect(() => {
    const onChange = () => setWidth(window.innerWidth);
    const mediaQueries = [
      VIEWPORT_MEDIA_QUERIES.mobile,
      VIEWPORT_MEDIA_QUERIES.compact,
      VIEWPORT_MEDIA_QUERIES.narrow,
    ].map(query => window.matchMedia(query));
    mediaQueries.forEach(query => query.addEventListener('change', onChange));
    onChange();
    return () => mediaQueries.forEach(query => query.removeEventListener('change', onChange));
  }, []);

  return {
    width,
    isMobile: isMobileWidth(width),
    isTablet: isTabletWidth(width),
    isNarrow: isNarrowWidth(width),
    category: classifyViewportWidth(width),
  };
}
