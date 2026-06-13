import React, { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { mermaidFallbackLabel, renderMermaidSvg } from './mermaidRendering';
import { useMermaid } from './useMermaid';

export interface MermaidBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (source: string) => void;
}

export function MermaidBlock({ block, colors: c, readOnly, onChange }: MermaidBlockProps) {
  const mermaidReady = useMermaid();
  const source = block.mermaid ?? '';
  const [editing, setEditing] = useState(!readOnly && !source.trim());
  const [draft, setDraft] = useState(source);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { if (!editing) setDraft(source); }, [source, editing]);

  useEffect(() => {
    const activeSource = editing ? draft : source;
    if (!mermaidReady || !activeSource.trim()) {
      setSvg(null);
      setError(false);
      return;
    }
    let cancelled = false;
    renderMermaidSvg(activeSource).then(result => {
      if (cancelled) return;
      setSvg(result);
      setError(!result);
    });
    return () => { cancelled = true; };
  }, [source, draft, editing, mermaidReady]);

  const renderDiagram = () => {
    if (svg) {
      return (
        <div
          className="be-mermaid-render"
          style={{ overflowX: 'auto', padding: '8px 0', textAlign: 'center' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      );
    }
    return (
      <pre style={{
        margin: 0, padding: '10px 12px', background: c.codeBg, borderRadius: 8,
        fontSize: 12, lineHeight: 1.5, color: error ? c.danger : c.textMuted, overflowX: 'auto',
      }}>
        {source.trim() || `${mermaidFallbackLabel(source)} — Mermaid 소스 입력`}
      </pre>
    );
  };

  if (readOnly) return renderDiagram();

  if (editing) {
    return (
      <div style={{ margin: '4px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: c.textMuted, fontSize: 11 }}>
          <GitBranch size={12} /> Mermaid
        </div>
        <textarea
          value={draft}
          spellCheck={false}
          placeholder={'flowchart TD\n  A --> B'}
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          onBlur={() => setEditing(false)}
          style={{
            width: '100%', minHeight: 80, resize: 'vertical', boxSizing: 'border-box',
            background: c.codeBg, color: c.text, border: `1px solid ${c.accent}`,
            borderRadius: 8, padding: '10px 12px', outline: 'none',
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
          }}
        />
        {renderDiagram()}
      </div>
    );
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="클릭해서 다이어그램 편집"
      style={{ cursor: 'text', padding: '4px 0', borderRadius: 6 }}
    >
      {renderDiagram()}
    </div>
  );
}
