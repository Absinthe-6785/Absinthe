import { useEffect, useState } from 'react';

declare global {
  interface Window {
    mermaid?: {
      render: (id: string, source: string) => Promise<{ svg: string }>;
      initialize: (config: object) => void;
    };
  }
}

/** Load Mermaid from CDN (same pattern as KaTeX). */
export function useMermaid(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.mermaid) {
      setReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}
