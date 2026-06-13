import { type CSSProperties, type ReactNode } from 'react';
import type { Block } from './blockUtils';
import { blockPlaceholder } from './blockPlaceholders';
import type { BlockEditorColors, BlockRenderContext } from './editorTypes';
import { EditableBlock } from './EditableBlock';
import { ChevronRight } from 'lucide-react';
import { toggleHeadingLevel } from './toggleBlockTypes';

export function toggleSharedEditProps(block: Block, ctx: BlockRenderContext) {
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

const TOGGLE_HEADING_HEADER: Record<number, { tag: 'h1' | 'h2' | 'h3' | 'h4'; style: React.CSSProperties }> = {
  1: { tag: 'h1', style: { fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.3 } },
  2: { tag: 'h2', style: { fontSize: 22, fontWeight: 700, margin: 0, lineHeight: 1.35 } },
  3: { tag: 'h3', style: { fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.4 } },
  4: { tag: 'h4', style: { fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.45 } },
};

export function renderToggleHeader(
  block: Block,
  c: BlockEditorColors,
  ctx: BlockRenderContext,
): ReactNode {
  const { inline, readOnly } = ctx;
  const sharedEditProps = toggleSharedEditProps(block, ctx);
  const headingLevel = toggleHeadingLevel(block.type);
  const headingMeta = headingLevel ? TOGGLE_HEADING_HEADER[headingLevel] : null;
  const headerTag = headingMeta?.tag ?? 'span';
  const headerStyle = headingMeta?.style ?? { fontWeight: 600, fontSize: 15, lineHeight: 1.6 };
  const placeholderKey = headingLevel ? (`toggleHeading${headingLevel}` as Block['type']) : 'toggle';
  return (
    <div style={{ display:'flex', gap:6, alignItems:'flex-start', padding:'2px 0' }}>
      <button
        type="button"
        aria-label={ctx.toggleOpen ? '접기' : '펼치기'}
        style={{
          color:c.textMuted, background:'none', border:'none', padding:0,
          transition:'transform .18s', transform: ctx.toggleOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          marginTop: headingLevel ? 6 : 3, flexShrink:0, cursor:'pointer', display:'flex',
        }}
        onClick={e => { e.stopPropagation(); ctx.onToggleCollapse(); }}>
        <ChevronRight size={15}/>
      </button>
      {readOnly
        ? (block.content?.trim()
          ? (() => {
              const HeaderTag = headerTag;
              return (
                <HeaderTag className="be-block-text" data-block-id={block.id} data-block-type={block.type}
                  style={{ ...headerStyle, color: c.text }}>
                  {inline(block.content)}
                </HeaderTag>
              );
            })()
          : null)
        : <EditableBlock block={block} colors={c} tag={headerTag}
            style={{ ...headerStyle, color:c.text, flex:1, display:'block' }}
            placeholder={blockPlaceholder(placeholderKey)} {...sharedEditProps}
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
        <>
          {renderNested(block)}
          {!ctx.readOnly && (
            <button
              type="button"
              className="be-toggle-add-child"
              data-toggle-add-child={block.id}
              onClick={e => { e.stopPropagation(); ctx.onToggleAddChild(block.id); }}
            >
              블록 추가…
            </button>
          )}
        </>
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
