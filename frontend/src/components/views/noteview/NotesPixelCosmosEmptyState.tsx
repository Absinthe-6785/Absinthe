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

const signalStepBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  fontSize: 12,
  lineHeight: 1.45,
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
        width: 'min(100%, 620px)',
        margin: 'clamp(22px, 7vh, 60px) auto',
        padding: 'clamp(18px, 4vw, 30px)',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${c.card}, ${c.editor} 58%)`,
        boxShadow: `inset 3px 0 0 ${c.accent}55`,
        color: c.text,
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 18,
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

      <div style={{ zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
        <div
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            border: `1px solid ${c.accent}99`,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: `${c.accent}10`,
            boxShadow: `inset 3px 0 0 ${c.accent}55`,
            flexShrink: 0,
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: c.textMuted, letterSpacing: 0, textTransform: 'uppercase' }}>
              Notes / Living Cosmos
            </p>
            <span
              style={{
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 750,
                color: c.textMuted,
                background: `${c.card}cc`,
              }}
            >
              Empty vault
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 'clamp(21px, 4vw, 28px)', lineHeight: 1.12, color: c.text, overflowWrap: 'anywhere' }}>
            Start with one signal
          </h2>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: c.textMuted, maxWidth: 470, overflowWrap: 'anywhere' }}>
            Create a note, open today's page, or bring in an existing vault. Each note becomes a trace you can return to, connect, and grow.
          </p>
        </div>
      </div>

      <div
        aria-label="How Notes grows from here"
        style={{
          zIndex: 1,
          display: 'grid',
          gap: 8,
          padding: '12px 14px',
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 10,
          background: `${c.editor}aa`,
        }}
      >
        <div style={signalStepBase}>
          <span aria-hidden="true" style={{ ...markerBase, position: 'relative', flexShrink: 0, border: `1px solid ${c.accent}`, background: `${c.accent}18` }} />
          <span style={{ color: c.textMuted, minWidth: 0, overflowWrap: 'anywhere' }}>Write the first signal.</span>
        </div>
        <div style={signalStepBase}>
          <span aria-hidden="true" style={{ ...markerBase, position: 'relative', flexShrink: 0, border: `1px solid ${c.textFaint}`, background: c.card }} />
          <span style={{ color: c.textMuted, minWidth: 0, overflowWrap: 'anywhere' }}>Let links and context form over time.</span>
        </div>
        <div style={signalStepBase}>
          <span aria-hidden="true" style={{ ...markerBase, position: 'relative', flexShrink: 0, border: `1px solid ${c.sideBdr}`, background: c.editor }} />
          <span style={{ color: c.textMuted, minWidth: 0, overflowWrap: 'anywhere' }}>Return to the traces that matter.</span>
        </div>
      </div>

      <div style={{ zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8, maxWidth: '100%' }}>
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
