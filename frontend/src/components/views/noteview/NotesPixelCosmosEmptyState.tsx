import type { NoteChromeColors } from '../noteEditorTheme';

type PixelCosmosColors = Pick<
  NoteChromeColors,
  'accent' | 'card' | 'editor' | 'inputBdr' | 'sideBdr' | 'text' | 'textMuted' | 'textFaint'
>;

export interface NotesPixelCosmosEmptyStateProps {
  readonly colors: PixelCosmosColors;
  readonly onCreateNote: () => void;
  readonly onOpenTodaysNote?: () => void;
  readonly onImportVault?: () => void;
}

const markerBase = {
  position: 'absolute',
  width: 7,
  height: 7,
  borderRadius: 2,
  pointerEvents: 'none',
} as const;

export function NotesPixelCosmosEmptyState({
  colors: c,
  onCreateNote,
  onOpenTodaysNote,
  onImportVault,
}: NotesPixelCosmosEmptyStateProps) {
  const actionBase = {
    borderRadius: 8,
    minHeight: 44,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  } as const;

  return (
    <section
      role="status"
      aria-label="Notes empty state"
      data-notes-pixel-cosmos-empty
      data-notes-empty
      data-product-empty="vault-empty"
      data-vault-empty
      data-k127-empty-state
      data-k212-notes-empty
      style={{
        width: 'min(100%, 560px)',
        margin: 'clamp(28px, 8vh, 72px) auto',
        padding: 'clamp(18px, 4vw, 28px)',
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${c.card}, ${c.editor} 58%)`,
        boxShadow: `inset 3px 0 0 ${c.accent}55`,
        color: c.text,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
      }}
    >
      <div
        aria-hidden="true"
        data-k212-cosmos-motif
        style={{
          position: 'absolute',
          inset: 12,
          border: `1px solid ${c.sideBdr}66`,
          borderRadius: 8,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
      <span aria-hidden="true" style={{ ...markerBase, top: 22, left: 22, border: `1px solid ${c.accent}`, background: `${c.accent}18`, boxShadow: `9px 0 0 ${c.accent}33` }} />
      <span aria-hidden="true" style={{ ...markerBase, right: 25, top: 38, border: `1px solid ${c.textFaint}`, background: c.card }} />
      <span aria-hidden="true" style={{ ...markerBase, bottom: 24, left: '18%', border: `1px solid ${c.sideBdr}`, background: c.editor }} />

      <div
        aria-hidden="true"
        style={{
          width: 42,
          height: 42,
          border: `1px solid ${c.accent}99`,
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          background: `${c.accent}10`,
          boxShadow: `inset 3px 0 0 ${c.accent}55`,
          zIndex: 1,
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            border: `2px solid ${c.accent}`,
            borderRadius: 3,
            boxShadow: `12px -8px 0 -5px ${c.accent}, -10px 10px 0 -5px ${c.textFaint}`,
          }}
        />
      </div>

      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center', maxWidth: 430, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: c.textMuted, letterSpacing: 0, textTransform: 'uppercase' }}>
          Notes / Living Cosmos
        </p>
        <h2 style={{ margin: 0, fontSize: 'clamp(18px, 3vw, 24px)', lineHeight: 1.15, color: c.text, overflowWrap: 'anywhere' }}>
          No signals detected yet
        </h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: c.textMuted, maxWidth: 390, overflowWrap: 'anywhere' }}>
          Create your first note to start mapping your personal cosmos. Your notes will appear here as signals, nodes, and traces.
        </p>
      </div>

      <div style={{ zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: '100%' }}>
        <button
          type="button"
          className="bwbg k99-interactive abs-focus-ring"
          onClick={onCreateNote}
          style={{
            ...actionBase,
            border: 'none',
            background: c.accent,
            color: '#fff',
          }}
        >
          Create note
        </button>
        {onOpenTodaysNote ? (
          <button
            type="button"
            className="k99-interactive abs-focus-ring"
            onClick={onOpenTodaysNote}
            style={{
              ...actionBase,
              border: `1px solid ${c.inputBdr}`,
              background: 'transparent',
              color: c.textMuted,
              fontWeight: 700,
            }}
          >
            Open today's note
          </button>
        ) : null}
        {onImportVault ? (
          <button
            type="button"
            className="k99-interactive abs-focus-ring"
            onClick={onImportVault}
            data-vault-empty-import
            style={{
              ...actionBase,
              border: `1px solid ${c.inputBdr}`,
              background: 'transparent',
              color: c.textMuted,
              fontWeight: 700,
            }}
          >
            Import backup
          </button>
        ) : null}
      </div>
    </section>
  );
}
