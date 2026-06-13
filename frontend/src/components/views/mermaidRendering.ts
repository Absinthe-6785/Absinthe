declare global {
  interface Window {
    mermaid?: {
      render: (id: string, source: string) => Promise<{ svg: string }>;
      initialize: (config: object) => void;
    };
  }
}

let mermaidInit = false;
let renderCounter = 0;

export function isMermaidAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.mermaid;
}

export function initializeMermaid(): void {
  if (typeof window === 'undefined' || !window.mermaid || mermaidInit) return;
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'strict',
    suppressErrorRendering: true,
  });
  mermaidInit = true;
}

/** Render Mermaid source to SVG HTML, or null on failure/unavailable. */
export async function renderMermaidSvg(source: string): Promise<string | null> {
  const trimmed = source.trim();
  if (!trimmed || typeof window === 'undefined' || !window.mermaid) return null;
  initializeMermaid();
  const id = `mermaid-${++renderCounter}-${Date.now()}`;
  try {
    const { svg } = await window.mermaid.render(id, trimmed);
    return svg;
  } catch {
    return null;
  }
}

/** Synchronous fallback label when async render pending or failed. */
export function mermaidFallbackLabel(source: string): string {
  const first = source.trim().split('\n')[0] ?? '';
  if (/^graph\s/i.test(first) || /^flowchart\s/i.test(first)) return '흐름도';
  if (/^sequenceDiagram/i.test(first)) return '시퀀스 다이어그램';
  return '다이어그램';
}
