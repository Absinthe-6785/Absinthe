import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { UI_INTERACTION } from '@/lib/uiInteractionTokens';

export const POPOVER_MAX_WIDTH_PX = UI_INTERACTION.popoverMaxWidthPx;

export interface PopoverContextValue {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  position: { top: number; left: number };
  setPosition: (pos: { top: number; left: number }) => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(): PopoverContextValue {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover components must be used within PopoverRoot');
  return ctx;
}

export interface PopoverRootProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile?: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** K-119 — unified popover state: outside dismiss, Escape, focus trap. */
export function PopoverRoot({
  open,
  onOpenChange,
  isMobile = false,
  anchorRef,
  children,
}: PopoverRootProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const onClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  useLayoutEffect(() => {
    if (!open || isMobile || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuW = POPOVER_MAX_WIDTH_PX;
    let left = rect.right - menuW;
    const pad = UI_INTERACTION.popoverViewportPaddingPx;
    left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad));
    let top = rect.bottom + UI_INTERACTION.popoverAnchorGapPx;
    const maxH = UI_INTERACTION.popoverMaxHeightPx;
    if (top + maxH > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - maxH - UI_INTERACTION.popoverAnchorGapPx);
    }
    setPosition({ top, left });
  }, [open, isMobile, anchorRef]);

  useEffect(() => {
    if (!open || isMobile) return;
    const handlePointerDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open, isMobile, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === UI_INTERACTION.escapeKey) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || isMobile) return;
    const menu = menuRef.current;
    if (!menu) return;
    const focusables = () =>
      Array.from(menu.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    menu.addEventListener('keydown', onKeyDown);
    return () => menu.removeEventListener('keydown', onKeyDown);
  }, [open, isMobile]);

  const value = useMemo(
    () => ({
      open,
      onClose,
      isMobile,
      anchorRef,
      menuRef,
      position,
      setPosition,
    }),
    [open, onClose, isMobile, anchorRef, position],
  );

  if (!open) return null;

  return (
    <PopoverContext.Provider value={value}>
      <div data-k119-popover-root data-k119-popover-open="true">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export interface PopoverPortalProps {
  children: ReactNode;
}

/** Renders popover content in document.body. */
export function PopoverPortal({ children }: PopoverPortalProps) {
  const { open } = usePopoverContext();
  if (!open) return null;
  return createPortal(
    <div data-k119-popover-portal>{children}</div>,
    document.body,
  );
}

export interface PopoverDismissProps {
  className?: string;
  /** Mobile bottom-sheet backdrop (flex column justify-end). */
  variant?: 'backdrop' | 'sheet';
  'data-hook'?: string;
  children?: ReactNode;
}

/** Click-outside dismiss layer. Sheet variant wraps panel children. */
export function PopoverDismiss({
  className = '',
  variant = 'backdrop',
  'data-hook': dataHook,
  children,
}: PopoverDismissProps) {
  const { onClose, isMobile } = usePopoverContext();
  if (variant === 'sheet' || isMobile) {
    return (
      <div
        className={`fixed inset-0 flex flex-col justify-end bg-black/40 ${className}`}
        style={{ zIndex: UI_INTERACTION.popoverSheetZIndex }}
        data-k119-popover-dismiss
        data-k104-sort-sheet
        data-k116-sort-backdrop
        {...(dataHook ? { [dataHook]: 'true' } : {})}
        onClick={onClose}
        role="presentation"
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={`fixed inset-0 ${className}`}
      style={{ zIndex: UI_INTERACTION.popoverBackdropZIndex }}
      data-k119-popover-dismiss
      data-k116-sort-backdrop
      aria-hidden
      onClick={onClose}
    />
  );
}

export interface PopoverPanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  role?: string;
  'aria-label'?: string;
  'aria-modal'?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  /** Extra data attributes for legacy audits */
  dataHooks?: Record<string, string>;
}

/** Positioned menu panel (desktop) or sheet panel (mobile). */
export function PopoverPanel({
  children,
  className = '',
  style,
  role = 'dialog',
  'aria-label': ariaLabel,
  'aria-modal': ariaModal = true,
  onClick,
  dataHooks,
}: PopoverPanelProps) {
  const { menuRef, position, isMobile } = usePopoverContext();

  if (isMobile) {
    return (
      <div
        ref={menuRef}
        role={role}
        aria-modal={ariaModal}
        aria-label={ariaLabel}
        className={`rounded-t-2xl p-4 pb-8 shadow-2xl ${className}`}
        style={style}
        onClick={e => {
          e.stopPropagation();
          onClick?.(e);
        }}
        data-k119-popover-panel
        data-k104-sort-menu
        data-k116-sort-menu
        {...dataHooks}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
      className={`bsort-menu ${className}`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_MAX_WIDTH_PX,
        maxWidth: POPOVER_MAX_WIDTH_PX,
        zIndex: UI_INTERACTION.popoverZIndex,
        overflow: 'hidden',
        ...style,
      }}
      onClick={e => {
        e.stopPropagation();
        onClick?.(e);
      }}
      data-k119-popover-panel
      data-k104-sort-menu
      data-k116-sort-menu
      {...dataHooks}
    >
      {children}
    </div>
  );
}

export { usePopoverContext };
