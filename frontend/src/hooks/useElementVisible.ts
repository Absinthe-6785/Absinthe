import { useEffect, useRef, useState } from 'react';

/** IntersectionObserver hook — K-107 lazy section mount. */
export function useElementVisible(rootMargin = '120px'): {
  ref: React.RefObject<HTMLElement | null>;
  visible: boolean;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return { ref, visible };
}
