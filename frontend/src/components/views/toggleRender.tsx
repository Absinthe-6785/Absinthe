import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import type { Block } from './blockUtils';
import { blockPlaceholder } from './blockPlaceholders';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';
import { EditableBlock } from './EditableBlock';
import { ChevronRight } from 'lucide-react';

export function toggleSharedEditProps(block: Block, ctx: BlockRenderContext) {
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
  };
}

export function renderToggleHeader(
  block: Block,
  c: BlockEditorColors,
  ctx: BlockRenderContext,
): ReactNode {
  const { inline, readOnly } = ctx;
  const sharedEditProps = toggleSharedEditProps(block, ctx);
  return (
    <div style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'2px 0' }}>
      <button
        type="button"
        aria-label={ctx.toggleOpen ? '접기' : '펼치기'}
        style={{
          color:c.textMuted, background:'none', border:'none', padding:0,
          transition:'transform .18s', transform: ctx.toggleOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          marginTop:3, flexShrink:0, cursor:'pointer', display:'flex',
        }}
        onClick={e => { e.stopPropagation(); ctx.onToggleCollapse(); }}>
        <ChevronRight size={15}/>
      </button>
      {readOnly
        ? <span className="be-block-text" data-block-id={block.id} data-block-type={block.type}
            style={{ fontWeight:600, fontSize:15, color:c.text, lineHeight:1.6 }}>
            {block.content ? inline(block.content) : <span style={{ color:c.textFaint }}>{blockPlaceholder('toggle')}</span>}
          </span>
        : <EditableBlock block={block} colors={c} tag="span"
            style={{ fontWeight:600, fontSize:15, color:c.text, lineHeight:1.6, flex:1, display:'block' }}
            placeholder={blockPlaceholder('toggle')} {...sharedEditProps}
            onEnterOverride={(before, after) => ctx.onToggleEnter(block.id, before, after)}/>
      }
    </div>
  );
}

export type ToggleNestedRenderer = (toggleBlock: Block) => ReactNode;

export function renderToggleChildren(
  block: Block,
  ctx: BlockRenderContext,
  renderNested: ToggleNestedRenderer,
  toggleDropActive = false,
): ReactNode {
  return (
    <div
      className={`be-toggle-children be-toggle-drop${toggleDropActive ? ' be-toggle-drop-active' : ''}`}
      data-toggle-id={block.id}
      style={{ '--be-toggle-depth': ctx.depth + 1 } as CSSProperties}
    >
      {block.children.length > 0 ? (
        renderNested(block)
      ) : !ctx.readOnly && (
        <div
          className="be-toggle-empty"
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); ctx.onToggleAddChild(block.id); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onToggleAddChild(block.id); } }}
        >
          내용 추가…
        </div>
      )}
    </div>
  );
}
