import React, { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { normalizeQuestionText } from './studyBlockUtils';

export interface QuestionBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (text: string) => void;
}

export function QuestionBlock({ block, colors: c, readOnly, onChange }: QuestionBlockProps) {
  const text = normalizeQuestionText(block.content ?? '');
  const [editing, setEditing] = useState(!readOnly && !text.trim());
  const [draft, setDraft] = useState(text);

  useEffect(() => { if (!editing) setDraft(text); }, [text, editing]);

  const display = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontWeight: 700, color: c.accent, fontSize: 12, flexShrink: 0 }}>Q:</span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: c.text }}>{text || 'Question…'}</span>
    </div>
  );

  if (readOnly) {
    return (
      <div
        className="be-question-block"
        data-block-id={block.id}
        data-block-type="question"
        style={{
          padding: '8px 12px',
          borderLeft: `3px solid ${c.accent}`,
          background: c.toolbar,
          borderRadius: 6,
          margin: '4px 0',
        }}
      >
        {display}
      </div>
    );
  }

  if (editing) {
    return (
      <div
        style={{ margin: '4px 0', padding: '8px 12px', background: c.toolbar, borderRadius: 8, border: `1px solid ${c.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: c.textMuted, fontSize: 11 }}>
          <HelpCircle size={12} /> Question
        </div>
        <textarea
          value={draft}
          placeholder="What caused the Meiji Restoration?"
          onChange={e => setDraft(e.target.value)}
          rows={2}
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
          onClick={() => { onChange(normalizeQuestionText(draft)); setEditing(false); }}
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
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); setDraft(text); }}
      title="클릭해서 질문 편집"
      style={{
        padding: '8px 12px',
        borderLeft: `3px solid ${c.accent}`,
        background: c.toolbar,
        borderRadius: 6,
        margin: '4px 0',
        cursor: 'text',
      }}
    >
      {display}
    </div>
  );
}
