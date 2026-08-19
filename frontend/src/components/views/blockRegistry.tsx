import type { CSSProperties, ReactNode } from 'react';
import type { Block, BlockType } from './blockUtils';
import { sanitizeBlockType } from './blockTypeGuards';
import { updateBlockById } from './blockUtils';
import { numberedMarker } from './listBlocks';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';
import { EditableBlock, type EditableBlockProps } from './EditableBlock';
import { CodeBlock } from './CodeBlock';
import { MathBlock } from './MathBlock';
import { MermaidBlock } from './MermaidBlock';
import { AudioBlock } from './AudioBlock';
import { CitationBlock } from './CitationBlock';
import { QuestionBlock } from './QuestionBlock';
import { AnswerBlock } from './AnswerBlock';
import { FootnoteBlock } from './FootnoteBlock';
import { ImageBlock } from './ImageBlock';
import { TableBlock } from './TableBlock';
import { paragraphShowsEmbedPreview } from './mediaUrlUtils';
import { MediaEmbedPreview, ParagraphWithEmbed } from './MediaEmbedPreview';

export type BlockRenderer = (
  block: Block,
  colors: BlockEditorColors,
  ctx: BlockRenderContext,
) => ReactNode;

const registry = new Map<BlockType, BlockRenderer>();

export function registerBlockRenderer(type: BlockType, renderer: BlockRenderer): void {
  registry.set(type, renderer);
}

export function getBlockRenderer(type: BlockType): BlockRenderer | undefined {
  return registry.get(type);
}

export function hasBlockRenderer(type: BlockType): boolean {
  return registry.has(type);
}

/** Reading-mode copy targets — same data attrs as EditableBlock for semantic copy. */
function readingCopyProps(block: Block) {
  return {
    className: 'be-block-text',
    'data-block-id': block.id,
    'data-block-type': block.type,
  } as const;
}

function sharedEditProps(block: Block, ctx: BlockRenderContext) {
  const isActive = ctx.isActiveBlock !== false;
  return {
    editableRef: ctx.editableRef,
    onSplitBlock: ctx.onSplitBlock,
    onMergeWithPrev: ctx.onMergeWithPrev,
    onContentChange: ctx.onContentChange,
    onSlashOpen: ctx.onSlashOpen,
    onSlashClose: ctx.onSlashClose,
    onWikiOpen: ctx.onWikiOpen,
    onWikiClose: ctx.onWikiClose,
    isMenuOpen: ctx.isMenuOpen,
    onNavigateBlock: ctx.onNavigateBlock,
    onActiveBlockChange: ctx.onActiveBlockChange,
    onWikiNavigate: ctx.onWikiNavigate,
    wikiTargets: ctx.wikiTargets,
    searchQuery: ctx.searchQueryFor(block.id),
    onConvertBlock: ctx.onConvertBlock,
    onIndentBlock: ctx.onIndentBlock,
    onOutdentBlock: ctx.onOutdentBlock,
    onPasteAt: ctx.onPasteAt,
    onPasteBlocksAt: ctx.onPasteBlocksAt,
    isActive,
    onActivate: ctx.onActivateBlock
      ? (offset?: 'start' | 'end' | number) => ctx.onActivateBlock!(block.id, offset)
      : undefined,
    onClearBlockSelection: ctx.onClearBlockSelection,
  };
}

function renderTextBlock(block: Block, c: BlockEditorColors, ctx: BlockRenderContext): ReactNode {
  const { inline, readOnly } = ctx;
  const bodyFontSize = 'calc(var(--be-font-size, 16px) + 1px)';
  const editProps = sharedEditProps(block, ctx);
  const ep = (tag: EditableBlockProps['tag'], style: CSSProperties, placeholder?: string) =>
    !readOnly ? (
      <EditableBlock block={block} colors={c} tag={tag} style={style}
        placeholder={placeholder} {...editProps}/>
    ) : null;

  switch (block.type) {
    case 'paragraph':
      if (readOnly && !block.content?.trim()) return null;
      {
        const embedUrl = paragraphShowsEmbedPreview(block);
        if (readOnly && embedUrl) {
          return <MediaEmbedPreview url={embedUrl} colors={c} readOnly />;
        }
        const paragraphEl = readOnly ? (
          <p {...readingCopyProps(block)} style={{ margin:'4px 0', lineHeight:1.65, fontSize:bodyFontSize, color:c.text }}>
            {inline(block.content)}
          </p>
        ) : (
          <EditableBlock block={block} colors={c} tag="p"
            style={{ margin:'4px 0', lineHeight:1.65, fontSize:bodyFontSize, color:c.text, minHeight:30 }}
            persistentPlaceholder={ctx.showPersistentPlaceholder?.(block.id)}
            {...editProps}/>
        );
        if (!readOnly && embedUrl) {
          return (
            <ParagraphWithEmbed block={block} colors={c} readOnly={false} embedUrl={embedUrl}>
              {paragraphEl}
            </ParagraphWithEmbed>
          );
        }
        return paragraphEl;
      }
    case 'heading1':
      if (readOnly && !block.content?.trim()) return null;
      return readOnly
        ? <h1 {...readingCopyProps(block)} style={{ fontSize:'calc(var(--be-font-size, 16px) * 1.75)', fontWeight:800, margin:'20px 0 8px', lineHeight:1.25, color:c.text }}>{inline(block.content)}</h1>
        : ep('h1', { fontSize:'calc(var(--be-font-size, 16px) * 1.75)', fontWeight:800, margin:'20px 0 8px', lineHeight:1.25, color:c.text });
    case 'heading2':
      if (readOnly && !block.content?.trim()) return null;
      return readOnly
        ? <h2 {...readingCopyProps(block)} style={{ fontSize:'calc(var(--be-font-size, 16px) * 1.5)', fontWeight:700, margin:'16px 0 6px', lineHeight:1.3, color:c.text }}>{inline(block.content)}</h2>
        : ep('h2', { fontSize:'calc(var(--be-font-size, 16px) * 1.5)', fontWeight:700, margin:'16px 0 6px', lineHeight:1.3, color:c.text });
    case 'heading3':
      if (readOnly && !block.content?.trim()) return null;
      return readOnly
        ? <h3 {...readingCopyProps(block)} style={{ fontSize:'calc(var(--be-font-size, 16px) * 1.3125)', fontWeight:700, margin:'12px 0 4px', lineHeight:1.35, color:c.text }}>{inline(block.content)}</h3>
        : ep('h3', { fontSize:'calc(var(--be-font-size, 16px) * 1.3125)', fontWeight:700, margin:'12px 0 4px', lineHeight:1.35, color:c.text });
    case 'heading4':
      if (readOnly && !block.content?.trim()) return null;
      return readOnly
        ? <h4 {...readingCopyProps(block)} style={{ fontSize:'calc(var(--be-font-size, 16px) * 0.9375)', fontWeight:700, margin:'10px 0 3px', lineHeight:1.4, color:c.text }}>{inline(block.content)}</h4>
        : ep('h4', { fontSize:'calc(var(--be-font-size, 16px) * 0.9375)', fontWeight:700, margin:'10px 0 3px', lineHeight:1.4, color:c.text });
    case 'bullet':
      if (readOnly && !block.content?.trim()) return null;
      return (
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'3px 0' }}>
          <span style={{ color:c.accent, fontSize:'1.1em', lineHeight:1.65, flexShrink:0 }}>•</span>
          {readOnly
            ? <span {...readingCopyProps(block)} style={{ lineHeight:1.65, fontSize:bodyFontSize, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.65, fontSize:bodyFontSize, color:c.text, flex:1, display:'block' }}
                {...editProps}/>
          }
        </div>
      );
    case 'numbered':
      if (readOnly && !block.content?.trim()) return null;
      return (
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'3px 0' }}>
          <span style={{ color:c.textMuted, fontSize:'0.95em', lineHeight:1.65, flexShrink:0, minWidth:22, fontWeight:600 }}>{numberedMarker(block)}.</span>
          {readOnly
            ? <span {...readingCopyProps(block)} style={{ lineHeight:1.65, fontSize:bodyFontSize, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.65, fontSize:bodyFontSize, color:c.text, flex:1, display:'block' }}
                {...editProps}/>
          }
        </div>
      );
    case 'todo':
      if (readOnly && !block.content?.trim() && !block.checked) return null;
      return (
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'3px 0' }}>
          <button onClick={e => { e.stopPropagation(); ctx.onToggleTodo(); }} style={{
            width:18, height:18, flexShrink:0, marginTop:4,
            border:`2px solid ${block.checked ? c.accent : c.border}`,
            borderRadius:4, background: block.checked ? c.accent : 'transparent',
            cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .1s',
          }}>
            {block.checked && <span style={{ color:'#fff', fontSize:11 }}>✓</span>}
          </button>
          {readOnly
            ? <span {...readingCopyProps(block)} style={{
                lineHeight:1.65, fontSize:bodyFontSize, flex:1,
                color: block.checked ? c.textMuted : c.text,
                textDecoration: block.checked ? 'line-through' : 'none',
                opacity: block.checked ? .6 : 1, transition:'all .15s',
              }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{
                  lineHeight:1.65, fontSize:bodyFontSize, flex:1, display:'block',
                  color: block.checked ? c.textMuted : c.text,
                  textDecoration: block.checked ? 'line-through' : 'none',
                  opacity: block.checked ? .6 : 1, transition:'all .15s',
                }}
                {...editProps}/>
          }
        </div>
      );
    case 'quote':
      if (readOnly && !block.content?.trim()) return null;
      return readOnly
        ? <blockquote {...readingCopyProps(block)} style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
            color:c.textMuted, fontStyle:'italic', fontSize:bodyFontSize, lineHeight:1.65, margin:'6px 0' }}>
            {inline(block.content)}
          </blockquote>
        : <EditableBlock block={block} colors={c} tag="blockquote"
            style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
              color:c.textMuted, fontStyle:'italic', fontSize:bodyFontSize, lineHeight:1.65, margin:'6px 0' }}
            {...editProps}/>;
    case 'callout':
      if (readOnly && !block.content?.trim()) return null;
      return (
        <div className="be-callout" style={{
          background: `linear-gradient(135deg, ${c.calloutBg} 0%, ${c.card} 100%)`,
          borderRadius: 10, padding:'12px 14px',
          display:'flex', gap:12, alignItems:'flex-start', margin:'6px 0',
          border:`1px solid ${c.border}`,
          borderLeft: `4px solid ${c.accent}`,
          boxShadow: `0 1px 3px ${c.border}44`,
        }}>
          <span style={{
            fontSize:20, flexShrink:0, lineHeight:'26px',
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            background: c.accentBg, borderRadius:8,
          }}>{block.calloutIcon ?? '💡'}</span>
          {readOnly
            ? <span {...readingCopyProps(block)} style={{ fontSize:bodyFontSize, lineHeight:1.6, color:c.text }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ fontSize:bodyFontSize, lineHeight:1.6, color:c.text, flex:1, display:'block' }}
                {...editProps}/>
          }
        </div>
      );
    case 'divider':
      return <hr style={{ border:'none', borderTop:`1px solid ${c.border}`, margin:'12px 0' }}/>;
    default:
  return <p style={{ color:c.text, fontSize:bodyFontSize, lineHeight:1.65 }}>{block.content}</p>;
  }
}

const TEXT_TYPES = new Set<BlockType>([
  'paragraph', 'heading1', 'heading2', 'heading3', 'heading4',
  'bullet', 'numbered', 'todo', 'quote', 'callout', 'divider',
]);

export function renderBlockContent(
  block: Block,
  colors: BlockEditorColors,
  ctx: BlockRenderContext,
): ReactNode {
  const type = sanitizeBlockType(block.type);
  const safeBlock = type === block.type ? block : { ...block, type };
  const renderer = registry.get(type);
  if (renderer) return renderer(safeBlock, colors, ctx);
  if (TEXT_TYPES.has(type)) return renderTextBlock(safeBlock, colors, ctx);
  return <p style={{ color:colors.text, fontSize:'calc(var(--be-font-size, 16px) + 1px)', lineHeight:1.65 }}>{safeBlock.content}</p>;
}

registerBlockRenderer('code', (block, c, ctx) => (
  <CodeBlock
    block={block} colors={c} readOnly={ctx.readOnly}
    onChange={patch => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, ...patch })))}
  />
));

registerBlockRenderer('math', (block, c, ctx) => (
  <MathBlock
    block={block} colors={c} readOnly={ctx.readOnly}
    onChange={math => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, math })))}
  />
));

registerBlockRenderer('image', (block, c, ctx) => (
  <ImageBlock
    block={block} colors={c} readOnly={ctx.readOnly}
    onChange={patch => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, ...patch })))}
  />
));

registerBlockRenderer('table', (block, c, ctx) => (
  <TableBlock
    block={block} colors={c}
    readOnly={ctx.readOnly} searchQuery={ctx.searchQuery}
    inline={ctx.inline}
    onTableChange={ctx.onTableChange}
  />
));

registerBlockRenderer('footnote', (block, c, ctx) => (
  <FootnoteBlock
    block={block}
    colors={c}
    readOnly={ctx.readOnly}
    editProps={sharedEditProps(block, ctx)}
  />
));

registerBlockRenderer('mermaid', (block, c, ctx) => (
  <MermaidBlock
    block={block}
    colors={c}
    readOnly={ctx.readOnly}
    onChange={source => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, mermaid: source })))}
  />
));

registerBlockRenderer('audio', (block, c, ctx) => (
  <AudioBlock
    block={block}
    colors={c}
    readOnly={ctx.readOnly}
    onChange={patch => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, ...patch })))}
  />
));

registerBlockRenderer('citation', (block, c, ctx) => (
  <CitationBlock
    block={block}
    colors={c}
    readOnly={ctx.readOnly}
    onChange={fields => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({
      ...b,
      citationTitle: fields.title,
      citationAuthor: fields.author,
      citationYear: fields.year,
      citationPage: fields.page,
      citationUrl: fields.url,
    })))}
  />
));

registerBlockRenderer('question', (block, c, ctx) => (
  <QuestionBlock
    block={block}
    colors={c}
    readOnly={ctx.readOnly}
    onChange={text => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({ ...b, content: text })))}
  />
));

registerBlockRenderer('answer', (block, c, ctx) => (
  <AnswerBlock
    block={block}
    colors={c}
    readOnly={ctx.readOnly}
    onChange={(content, revealed) => ctx.onChange(updateBlockById(ctx.getBlocks(), block.id, b => ({
      ...b,
      content,
      answerRevealed: revealed,
    })))}
  />
));

registerBlockRenderer('toggle', () => null);
