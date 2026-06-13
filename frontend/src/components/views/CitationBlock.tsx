import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import {
  blockToCitationFields,
  citationFieldsToBlockPatch,
  formatCitationCompact,
  type CitationFields,
} from './citationUtils';

export interface CitationBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (fields: CitationFields) => void;
}

function CitationDisplay({ fields, c }: { fields: CitationFields; c: BlockEditorColors }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, color: c.text }}>
      <div style={{ fontWeight: 600 }}>{formatCitationCompact(fields)}</div>
      {fields.page && (
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>p. {fields.page}</div>
      )}
      {fields.url && (
        <a
          href={fields.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: c.accent, marginTop: 2, display: 'inline-block' }}
          onClick={e => e.stopPropagation()}
        >
          {fields.url}
        </a>
      )}
    </div>
  );
}

export function CitationBlock({ block, colors: c, readOnly, onChange }: CitationBlockProps) {
  const fields = blockToCitationFields(block);
  const [editing, setEditing] = useState(!readOnly && !fields.title.trim());
  const [draft, setDraft] = useState<CitationFields>(fields);

  useEffect(() => { if (!editing) setDraft(fields); }, [fields, editing]);

  const apply = () => {
    onChange(draft);
    setEditing(false);
  };

  if (readOnly) {
    return (
      <div
        className="be-citation-block"
        data-block-id={block.id}
        data-block-type="citation"
        style={{
          padding: '8px 12px',
          borderLeft: `3px solid ${c.accent}`,
          background: c.toolbar,
          borderRadius: 6,
          margin: '4px 0',
        }}
      >
        <CitationDisplay fields={fields} c={c} />
      </div>
    );
  }

  if (editing) {
    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box' as const,
      marginBottom: 6,
      background: c.input,
      border: `1px solid ${c.inputBdr}`,
      borderRadius: 6,
      padding: '6px 10px',
      fontSize: 12,
      color: c.text,
      outline: 'none',
    };
    return (
      <div
        style={{ margin: '4px 0', padding: '8px 12px', background: c.toolbar, borderRadius: 8, border: `1px solid ${c.border}` }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: c.textMuted, fontSize: 11 }}>
          <BookOpen size={12} /> Citation
        </div>
        <input value={draft.title} placeholder="Source title" onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={inputStyle} />
        <input value={draft.author} placeholder="Author" onChange={e => setDraft(d => ({ ...d, author: e.target.value }))} style={inputStyle} />
        <input value={draft.year} placeholder="Year" onChange={e => setDraft(d => ({ ...d, year: e.target.value }))} style={inputStyle} />
        <input value={draft.page ?? ''} placeholder="Page (optional)" onChange={e => setDraft(d => ({ ...d, page: e.target.value }))} style={inputStyle} />
        <input value={draft.url ?? ''} placeholder="URL (optional)" onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} style={inputStyle} />
        <button
          type="button"
          onClick={apply}
          style={{
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
      onClick={e => { e.stopPropagation(); setEditing(true); setDraft(fields); }}
      title="클릭해서 인용 편집"
      style={{
        padding: '8px 12px',
        borderLeft: `3px solid ${c.accent}`,
        background: c.toolbar,
        borderRadius: 6,
        margin: '4px 0',
        cursor: 'text',
      }}
    >
      <CitationDisplay fields={fields} c={c} />
    </div>
  );
}

export { citationFieldsToBlockPatch, blockToCitationFields };
