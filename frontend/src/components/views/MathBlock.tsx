import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '../../lib/i18n';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { renderKatexHtml } from './mathRendering';
import { insertMathSnippetAt, MATH_SNIPPETS } from './mathSnippets';

export interface MathBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (math: string) => void;
}

export function MathBlock({ block, colors: c, readOnly, onChange }: MathBlockProps) {
  const { t } = useTranslation();
  const expr = block.math ?? '';
  const [editing, setEditing] = useState(!readOnly && !expr.trim());
  const [draft, setDraft] = useState(expr);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!editing) setDraft(expr); }, [expr, editing]);

  useEffect(() => {
    if (editing) {
      const ta = taRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
  }, [editing]);

  const rendered = useMemo(() => renderKatexHtml(expr), [expr]);
  const draftRendered = useMemo(() => renderKatexHtml(draft), [draft]);

  if (readOnly) {
    return rendered
      ? <div style={{ textAlign:'center', padding:'8px 0', overflowX:'auto' }} dangerouslySetInnerHTML={{ __html: rendered }}/>
      : <code style={{ background:c.codeBg, padding:'6px 10px', borderRadius:6, display:'block', color: expr.trim() ? c.danger : c.textFaint }}>
          {expr.trim() ? expr : t('mathBlockEmpty')}
        </code>;
  }

  const insertSnippet = (latex: string) => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? draft.length;
    const end = ta?.selectionEnd ?? start;
    const next = insertMathSnippetAt(draft, latex, start, end);
    setDraft(next.value);
    onChange(next.value);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(next.selectionStart, next.selectionEnd);
      }
    });
  };

  if (editing) {
    return (
      <div style={{ margin:'4px 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
          {MATH_SNIPPETS.map(snippet => (
            <button
              key={snippet.id}
              type="button"
              title={snippet.latex}
              onMouseDown={e => { e.preventDefault(); insertSnippet(snippet.latex); }}
              style={{
                fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:6, cursor:'pointer',
                background:c.toolbar, color:c.textMuted, border:`1px solid ${c.border}`,
              }}
            >
              {snippet.label}
            </button>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={draft}
          spellCheck={false}
          placeholder={t('mathBlockPlaceholder')}
          onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
          onBlur={() => setEditing(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLTextAreaElement).blur(); }
          }}
          style={{
            width:'100%', minHeight:54, resize:'vertical', boxSizing:'border-box',
            background:c.codeBg, color:c.text, border:`1px solid ${c.accent}`,
            borderRadius:8, padding:'10px 12px', outline:'none',
            fontFamily:'monospace', fontSize:13, lineHeight:1.5,
          }}
        />
        {draftRendered && (
          <div style={{ textAlign:'center', padding:'8px 0', overflowX:'auto', borderTop:`1px dashed ${c.border}`, marginTop:6 }}
            dangerouslySetInnerHTML={{ __html: draftRendered }}/>
        )}
        <div style={{ fontSize:10, color:c.textFaint, marginTop:3, textAlign:'right' }}>
          {t('mathBlockEditHint')}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title={t('blockClickEditMath')}
      style={{ cursor:'text', padding:'6px 0', borderRadius:6 }}>
      {rendered
        ? <div style={{ textAlign:'center', overflowX:'auto' }} dangerouslySetInnerHTML={{ __html: rendered }}/>
        : <code style={{ background:c.codeBg, padding:'6px 10px', borderRadius:6, display:'block', color: expr.trim() ? c.danger : c.textFaint }}>
            {expr.trim() ? expr : t('mathBlockClickHint')}
          </code>}
    </div>
  );
}
