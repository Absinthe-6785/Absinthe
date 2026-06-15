import type { NoteChromeColors } from '../noteEditorTheme';
import { useTranslation } from '../../../lib/i18n';

interface NoteViewShortcutsModalProps {
  colors: NoteChromeColors;
  panelRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export function NoteViewShortcutsModal({ colors: c, panelRef, onClose }: NoteViewShortcutsModalProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nv-shortcuts-title"
        style={{ background: c.card, borderRadius: 12, padding: '20px 24px', width: 340, boxShadow: '0 8px 32px #00000030' }}
        onClick={e => e.stopPropagation()}
      >
        <div id="nv-shortcuts-title" style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: c.text }}>{t('nvShortcuts')}</div>
        {[
          ['Ctrl + N',         t('nvScNewNote')],
          ['Ctrl + D',         t('nvScDuplicate')],
          ['Ctrl + E',         t('nvScToggleRead')],
          ['Ctrl + G',         t('nvScGraph')],
          ['Ctrl + K',         t('nvScWorkspaceSearch')],
          ['Ctrl + F',         t('nvScNoteSearch')],
          ['Ctrl + Shift + F', t('nvScFocus')],
          ['Ctrl + /',         t('nvScShowShortcuts')],
          [null, null],
          ['Ctrl + S',         t('nvScSave')],
          ['Ctrl + Z',         t('nvScUndo')],
          ['Ctrl + Y / ⇧+Z',  t('nvScRedo')],
          [null, null],
          ['/',                t('nvScSlash')],
          ['[[...]]',          t('nvScWikiLink')],
          ['Ctrl + Click',     t('nvScWikiNav')],
          ['[[link]]',         t('nvScWikiClick')],
          ['#tag in search',   t('nvScTagFilter')],
          ['↑ ↓ Enter',        t('nvScMenuNav')],
          ['Esc',              t('nvScEsc')],
        ].map(([key, desc], i) => (
          key === null
            ? <div key={i} style={{ height: 1, background: c.textFaint, margin: '6px 0' }} />
            : <div key={key} className="bsc-row">
                <span style={{ color: c.textMuted }}>{desc}</span>
                <span className="bsc-key">{key}</span>
              </div>
        ))}
        <button
          onClick={onClose}
          style={{ marginTop: 14, width: '100%', background: c.accentBg, border: 'none', borderRadius: 7, padding: '8px', color: c.accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
