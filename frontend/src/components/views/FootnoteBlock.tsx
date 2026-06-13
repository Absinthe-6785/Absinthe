import React from 'react';
import { useTranslation } from '../../lib/i18n';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { EditableBlock, type EditableBlockProps } from './EditableBlock';
import { footnoteAnchorId, normalizeFootnoteId } from './footnoteUtils';

type FootnoteEditProps = Omit<EditableBlockProps, 'block' | 'colors' | 'tag' | 'placeholder' | 'style'>;

export interface FootnoteBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  editProps: FootnoteEditProps;
}

export function FootnoteBlock({
  block,
  colors: c,
  readOnly,
  editProps,
}: FootnoteBlockProps) {
  const { t } = useTranslation();
  const id = normalizeFootnoteId(block.footnoteId ?? '1');
  const label = `[^${id}]`;

  return (
    <div
      className="be-footnote-def"
      data-footnote-def={id}
      id={readOnly ? undefined : footnoteAnchorId(id)}
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '4px 0',
        fontSize: 14,
        lineHeight: 1.6,
        color: c.textMuted,
      }}
    >
      <span style={{ flexShrink: 0, fontWeight: 700, color: c.accent, fontSize: 12 }}>{label}</span>
      {readOnly ? (
        <span className="be-block-text" data-block-id={block.id} data-block-type="footnote">
          {block.content}
        </span>
      ) : (
        <EditableBlock
          block={block}
          colors={c}
          tag="span"
          placeholder={t('blockFootnoteContent')}
          style={{ flex: 1, color: c.text, minHeight: 24 }}
          {...editProps}
        />
      )}
    </div>
  );
}

export interface FootnoteReferenceSectionProps {
  footnotes: Block[];
  colors: BlockEditorColors;
}

/** Reading-mode reference list appended after document body. */
export function FootnoteReferenceSection({ footnotes, colors: c }: FootnoteReferenceSectionProps) {
  if (!footnotes.length) return null;
  return (
    <section className="be-footnote-section" style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${c.border}` }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: c.textMuted, margin: '0 0 8px' }}>각주</h4>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65, color: c.text }}>
        {footnotes.map(fn => {
          const id = normalizeFootnoteId(fn.footnoteId ?? '1');
          return (
            <li key={fn.id} id={footnoteAnchorId(id)} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: c.accent, marginRight: 6 }}>[^{id}]</span>
              {fn.content}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
