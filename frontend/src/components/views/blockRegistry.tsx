import type { CSSProperties, ReactNode } from 'react';
import type { Block, BlockType } from './blockUtils';
import { sanitizeBlockType } from './blockTypeGuards';
import { updateBlockById } from './blockUtils';
import { numberedMarker } from './listBlocks';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';
import { EditableBlock, type EditableBlockProps } from './EditableBlock';
import { CodeBlock } from './CodeBlock';
import { MathBlock } from './MathBlock';
import { ImageBlock } from './ImageBlock';
import { TableBlock } from './TableBlock';

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
  const editProps = sharedEditProps(block, ctx);
  const ep = (tag: EditableBlockProps['tag'], style: CSSProperties, placeholder?: string) =>
    !readOnly ? (
      <EditableBlock block={block} colors={c} tag={tag} style={style}
        placeholder={placeholder} {...editProps}/>
    ) : null;

  switch (block.type) {
    case 'paragraph':
      return readOnly ? (
        <p {...readingCopyProps(block)} style={{ margin:'2px 0', lineHeight:1.75, fontSize:15,
          color: block.content ? c.text : c.textFaint, minHeight:26 }}>
          {block.content
            ? inline(block.content)
            : <span style={{ color:c.textFaint, pointerEvents:'none' }}>텍스트 입력…</span>}
        </p>
      ) : (
        <EditableBlock block={block} colors={c} tag="p"
          style={{ margin:'2px 0', lineHeight:1.75, fontSize:15, color:c.text, minHeight:26 }}
          persistentPlaceholder={ctx.showPersistentPlaceholder?.(block.id)}
          {...editProps}/>
      );
    case 'heading1':
      return readOnly
        ? <h1 {...readingCopyProps(block)} style={{ fontSize:28, fontWeight:800, margin:'16px 0 4px', lineHeight:1.3, color:c.text }}>{inline(block.content)}</h1>
        : ep('h1', { fontSize:28, fontWeight:800, margin:'16px 0 4px', lineHeight:1.3, color:c.text });
    case 'heading2':
      return readOnly
        ? <h2 {...readingCopyProps(block)} style={{ fontSize:22, fontWeight:700, margin:'14px 0 3px', lineHeight:1.35, color:c.text }}>{inline(block.content)}</h2>
        : ep('h2', { fontSize:22, fontWeight:700, margin:'14px 0 3px', lineHeight:1.35, color:c.text });
    case 'heading3':
      return readOnly
        ? <h3 {...readingCopyProps(block)} style={{ fontSize:17, fontWeight:700, margin:'10px 0 2px', lineHeight:1.4, color:c.text }}>{inline(block.content)}</h3>
        : ep('h3', { fontSize:17, fontWeight:700, margin:'10px 0 2px', lineHeight:1.4, color:c.text });
    case 'bullet':
      return (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'2px 0' }}>
          <span style={{ color:c.accent, fontSize:18, lineHeight:'26px', flexShrink:0 }}>•</span>
          {readOnly
            ? <span {...readingCopyProps(block)} style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1, display:'block' }}
                {...editProps}/>
          }
        </div>
      );
    case 'numbered':
      return (
        <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'2px 0' }}>
          <span style={{ color:c.textMuted, fontSize:14, lineHeight:'26px', flexShrink:0, minWidth:20, fontWeight:500 }}>{numberedMarker(block)}.</span>
          {readOnly
            ? <span {...readingCopyProps(block)} style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1 }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ lineHeight:1.7, fontSize:15, color:c.text, flex:1, display:'block' }}
                {...editProps}/>
          }
        </div>
      );
    case 'todo':
      return (
        <div style={{ display:'flex', gap:9, alignItems:'flex-start', padding:'2px 0' }}>
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
                lineHeight:1.7, fontSize:15, flex:1,
                color: block.checked ? c.textMuted : c.text,
                textDecoration: block.checked ? 'line-through' : 'none',
                opacity: block.checked ? .6 : 1, transition:'all .15s',
              }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{
                  lineHeight:1.7, fontSize:15, flex:1, display:'block',
                  color: block.checked ? c.textMuted : c.text,
                  textDecoration: block.checked ? 'line-through' : 'none',
                  opacity: block.checked ? .6 : 1, transition:'all .15s',
                }}
                {...editProps}/>
          }
        </div>
      );
    case 'quote':
      return readOnly
        ? <blockquote {...readingCopyProps(block)} style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
            color:c.textMuted, fontStyle:'italic', fontSize:15, lineHeight:1.7, margin:'4px 0' }}>
            {inline(block.content)}
          </blockquote>
        : <EditableBlock block={block} colors={c} tag="blockquote"
            style={{ borderLeft:`3px solid ${c.quoteBdr}`, marginLeft:0, paddingLeft:16,
              color:c.textMuted, fontStyle:'italic', fontSize:15, lineHeight:1.7, margin:'4px 0' }}
            {...editProps}/>;
    case 'callout':
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
            ? <span {...readingCopyProps(block)} style={{ fontSize:14, lineHeight:1.7, color:c.text }}>{inline(block.content)}</span>
            : <EditableBlock block={block} colors={c} tag="span"
                style={{ fontSize:14, lineHeight:1.7, color:c.text, flex:1, display:'block' }}
                {...editProps}/>
          }
        </div>
      );
    case 'divider':
      return <hr style={{ border:'none', borderTop:`1px solid ${c.border}`, margin:'12px 0' }}/>;
    default:
      return <p style={{ color:c.text, fontSize:15, lineHeight:1.7 }}>{block.content}</p>;
  }
}

const TEXT_TYPES = new Set<BlockType>([
  'paragraph', 'heading1', 'heading2', 'heading3',
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
  return <p style={{ color:colors.text, fontSize:15, lineHeight:1.7 }}>{safeBlock.content}</p>;
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

registerBlockRenderer('toggle', () => null);
