import { useEffect, useState } from 'react';
import { isMobileWidth, VIEWPORT_MEDIA_QUERIES } from '../lib/responsiveLayout';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(VIEWPORT_MEDIA_QUERIES.mobile);
    const onChange = () => setIsMobile(isMobileWidth(window.innerWidth));
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
