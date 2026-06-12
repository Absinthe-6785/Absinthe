import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Code2, Copy, Check } from 'lucide-react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { insertTabAt } from './codeBlockUtils';
import { copyPlainTextToClipboard } from './features/block-editor/features/clipboard/copy/copyToClipboard';

export interface CodeBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { code?: string; language?: string }) => void;
}

export function CodeBlock({ block, colors: c, readOnly, onChange }: CodeBlockProps) {
  const code = block.code ?? '';
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(code);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyCode = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyPlainTextToClipboard(code);
    if (!ok) return;
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [code]);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);
  useEffect(() => {
    if (document.activeElement !== taRef.current) setDraft(code);
  }, [code]);

  useEffect(() => {
    if (!readOnly && !code.trim()) taRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (readOnly) {
    return (
      <div style={{ background:c.codeBg, borderRadius:8, overflow:'hidden', margin:'4px 0', border:`1px solid ${c.border}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 12px', borderBottom:`1px solid ${c.border}` }}>
          {block.language ? (
            <span style={{ fontSize:11, color:c.textMuted, fontFamily:'monospace', fontWeight:600 }}>{block.language}</span>
          ) : <span/>}
          <button type="button" onClick={handleCopyCode} title="Copy code"
            style={{ background:'none', border:'none', cursor:'pointer', color: copied ? c.green : c.textMuted, display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'2px 4px' }}>
            {copied ? <Check size={12}/> : <Copy size={12}/>}
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
        <pre style={{ margin:0, padding:'12px 16px', overflowX:'auto', fontSize:13, lineHeight:1.6 }}>
          <code style={{ color:c.text, fontFamily:'monospace' }}>{code || ' '}</code>
        </pre>
      </div>
    );
  }

  return (
    <div style={{ background:c.codeBg, borderRadius:8, overflow:'hidden', margin:'4px 0', border:`1px solid ${c.border}` }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderBottom:`1px solid ${c.border}` }}>
        <Code2 size={12} color={c.textMuted}/>
        <input
          value={block.language ?? ''}
          onChange={e => onChange({ language: e.target.value })}
          placeholder="language"
          spellCheck={false}
          style={{ background:'transparent', border:'none', outline:'none', color:c.textMuted, fontFamily:'monospace', fontSize:11, fontWeight:600, width:140 }}
        />
        <button type="button" onClick={handleCopyCode} title="Copy code"
          style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color: copied ? c.green : c.textMuted, display:'flex', alignItems:'center', gap:4, fontSize:10, padding:'2px 4px' }}>
          {copied ? <Check size={12}/> : <Copy size={12}/>}
          {copied ? 'Copied' : 'Copy Code'}
        </button>
      </div>
      <textarea
        ref={taRef}
        value={draft}
        spellCheck={false}
        placeholder="코드 입력…"
        onChange={e => { setDraft(e.target.value); onChange({ code: e.target.value }); }}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const { next, caret } = insertTabAt(draft, ta.selectionStart, ta.selectionEnd);
            setDraft(next);
            onChange({ code: next });
            requestAnimationFrame(() => {
              if (taRef.current) taRef.current.selectionStart = taRef.current.selectionEnd = caret;
            });
          }
          if (e.key === 'Escape') (e.currentTarget as HTMLTextAreaElement).blur();
        }}
        style={{
          width:'100%', minHeight:72, resize:'vertical', boxSizing:'border-box',
          background:'transparent', color:c.text, border:'none', outline:'none',
          padding:'12px 16px', fontFamily:'monospace', fontSize:13, lineHeight:1.6,
        }}
      />
    </div>
  );
}
