import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { blockToAnswerFields } from './studyBlockUtils';

export interface AnswerBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (content: string, revealed: boolean) => void;
}

export function AnswerBlock({ block, colors: c, readOnly, onChange }: AnswerBlockProps) {
  const fields = blockToAnswerFields(block);
  const [revealed, setRevealed] = useState(fields.revealed);
  const [editing, setEditing] = useState(!readOnly && !fields.content.trim());
  const [draft, setDraft] = useState(fields.content);

  useEffect(() => { setRevealed(fields.revealed); }, [fields.revealed]);
  useEffect(() => { if (!editing) setDraft(fields.content); }, [fields.content, editing]);

  const toggleReveal = () => {
    const next = !revealed;
    setRevealed(next);
    onChange(fields.content, next);
  };

  const shellStyle = {
    padding: '8px 12px',
    borderLeft: `3px solid ${c.textMuted}`,
    background: c.toolbar,
    borderRadius: 6,
    margin: '4px 0',
  } as const;

  if (editing && !readOnly) {
    return (
      <div
        style={{ ...shellStyle, border: `1px solid ${c.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 6 }}>Answer</div>
        <textarea
          value={draft}
          placeholder="Answer text…"
          onChange={e => setDraft(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: c.input,
            border: `1px solid ${c.inputBdr}`,
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: c.text,
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={() => { onChange(draft.trim(), revealed); setEditing(false); }}
          style={{
            marginTop: 8,
            background: c.accent, color: c.toolbarActiveFg ?? '#fff', border: 'none',
            borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          저장
        </button>
      </div>
    );
  }

  return (
    <div className="be-answer-block" data-block-id={block.id} data-block-type="answer" style={shellStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: revealed ? 6 : 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Answer
        </span>
        <button
          type="button"
          className="btbtn"
          onClick={e => { e.stopPropagation(); toggleReveal(); }}
          style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: c.accent }}
        >
          {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
          {revealed ? '숨기기' : '답 보기'}
        </button>
      </div>
      {revealed ? (
        <div
          style={{ fontSize: 13, lineHeight: 1.5, color: c.text, whiteSpace: 'pre-wrap' }}
          onClick={e => {
            if (!readOnly) { e.stopPropagation(); setEditing(true); setDraft(fields.content); }
          }}
        >
          {fields.content.trim() || '…'}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: c.textFaint, fontStyle: 'italic' }}>
          ↓ 답을 보려면 «답 보기»를 누르세요
        </div>
      )}
    </div>
  );
}
