import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Copy, Download, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useViewportLayout } from '../../hooks/useViewportLayout';
import { copyPlainTextToClipboard } from './features/block-editor/features/clipboard/copy/copyToClipboard';
import type { GalleryImage } from './imageGallery';
import { WorkspaceErrorBoundary } from '../common/WorkspaceErrorBoundary';

export interface ImageGalleryViewerProps {
  images: readonly GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

async function fetchImageBlob(src: string): Promise<Blob | null> {
  try {
    if (src.startsWith('data:')) {
      const res = await fetch(src);
      return await res.blob();
    }
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

async function copyImageToClipboard(src: string, label: string): Promise<boolean> {
  const blob = await fetchImageBlob(src);
  if (!blob) return copyPlainTextToClipboard(label);
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const items: Record<string, Blob> = {
        'text/plain': new Blob([label], { type: 'text/plain' }),
        'image/png': blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' }),
      };
      await navigator.clipboard.write([new ClipboardItem(items)]);
      return true;
    }
  } catch {
    // fall through
  }
  return copyPlainTextToClipboard(label);
}

/** K-118 — Fullscreen image viewer with gallery navigation and pinch zoom. */
export function ImageGalleryViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: ImageGalleryViewerProps) {
  const { t } = useTranslation();
  const { isMobile } = useViewportLayout();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const touchRef = useRef<{ x: number; y: number; dist: number; zoom: number } | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
  }, [index, resetView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onIndexChange(index - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onIndexChange(index + 1);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(z => Math.min(4, z + 0.25));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(z => Math.max(1, z - 0.25));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext, index, onIndexChange, resetView]);

  const handleCopy = async () => {
    if (!current) return;
    const label = current.caption?.trim() || current.alt?.trim() || 'Image';
    const ok = await copyImageToClipboard(current.src, label);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleSave = () => {
    if (!current) return;
    const a = document.createElement('a');
    a.href = current.src;
    a.download = current.alt?.trim() || 'image';
    a.rel = 'noopener';
    a.click();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(z => Math.min(4, Math.max(1, z + delta)));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      touchRef.current = { x: 0, y: 0, dist, zoom };
      swipeRef.current = null;
      return;
    }
    if (e.touches.length === 1) {
      swipeRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / touchRef.current.dist;
      setZoom(Math.min(4, Math.max(1, touchRef.current.zoom * ratio)));
      swipeRef.current = null;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    touchRef.current = null;
    if (!swipeRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0]!.clientX - swipeRef.current.x;
    const dy = e.changedTouches[0]!.clientY - swipeRef.current.y;
    swipeRef.current = null;
    if (zoom > 1.05) return;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0 && hasPrev) onIndexChange(index - 1);
    else if (dx < 0 && hasNext) onIndexChange(index + 1);
  };

  if (!current) return null;

  return (
    <WorkspaceErrorBoundary workspace="image-gallery">
    <div
      className="fixed inset-0 z-[250] flex flex-col bg-black/90 backdrop-blur-sm"
      data-k118-image-viewer
      data-k118-image-gallery={images.length > 1 ? 'true' : 'false'}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 shrink-0 text-white"
        onClick={e => e.stopPropagation()}
        data-k118-image-viewer-toolbar
      >
        <span className="text-xs font-semibold tabular-nums opacity-80">
          {images.length > 1 ? `${index + 1} / ${images.length}` : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(1, z - 0.25))}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
            aria-label={t('k118ZoomOut')}
            data-k118-image-zoom-out
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(4, z + 0.25))}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
            aria-label={t('k118ZoomIn')}
            data-k118-image-zoom-in
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
            aria-label={t('k118CopyImage')}
            data-k118-image-copy
          >
            <Copy size={18} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
            aria-label={t('k118SaveImage')}
            data-k118-image-save
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
            aria-label={t('close')}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {copied ? (
        <p className="text-center text-xs text-white/80 -mt-1 mb-1">{t('k118ImageCopied')}</p>
      ) : null}

      <div
        className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden touch-none"
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={e => e.stopPropagation()}
        data-k118-image-viewer-stage
      >
        {hasPrev ? (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            className={`absolute left-2 z-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center ${isMobile ? 'min-h-[44px] min-w-[44px]' : 'p-2'}`}
            aria-label={t('k118PrevImage')}
            data-k118-image-prev
          >
            <ChevronLeft size={22} />
          </button>
        ) : null}

        <img
          src={current.src}
          alt={current.alt ?? ''}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: touchRef.current ? 'none' : 'transform .12s ease-out',
            maxWidth: 'min(96vw, 1200px)',
            maxHeight: '78vh',
            objectFit: 'contain',
            userSelect: 'none',
          }}
          data-k118-image-viewer-img
        />

        {hasNext ? (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            className={`absolute right-2 z-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center ${isMobile ? 'min-h-[44px] min-w-[44px]' : 'p-2'}`}
            aria-label={t('k118NextImage')}
            data-k118-image-next
          >
            <ChevronRight size={22} />
          </button>
        ) : null}
      </div>

      {current.caption ? (
        <p className="text-center text-sm text-white/90 px-4 py-3 shrink-0">{current.caption}</p>
      ) : null}
    </div>
    </WorkspaceErrorBoundary>
  );
}
