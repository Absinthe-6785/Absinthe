import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Image as ImageIcon, MoreHorizontal } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useViewportLayout } from '../../hooks/useViewportLayout';
import type { Block } from './blockUtils';
import { isValidImageUrl, imageAltFromUrl } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import type { CSSProperties } from 'react';
import { clampImageWidth, imageDisplayStyle, imgBtnStyle } from './imageBlockUtils';
import { useImageGallery } from './ImageGalleryContext';

export interface ImageBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { src?: string; alt?: string; caption?: string; width?: number }) => void;
}

export function ImageBlock({ block, colors: c, readOnly, onChange }: ImageBlockProps) {
  const { t } = useTranslation();
  const { isMobile } = useViewportLayout();
  const gallery = useImageGallery();
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [resizingW, setResizingW] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState(block.caption ?? '');
  const [hoverControls, setHoverControls] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setCaptionDraft(block.caption ?? ''); }, [block.caption]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [mobileMenuOpen]);

  const imgStyle = (width?: number) => imageDisplayStyle(c, width);

  const applyFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) return;
    setUrlError('Use Attach image to store local images.');
    setShowUrl(true);
    setMobileMenuOpen(false);
  }, []);

  const applyUrl = useCallback((raw: string) => {
    const url = raw.trim();
    if (!isValidImageUrl(url)) {
      setUrlError(t('blockImageUrlInvalid'));
      return;
    }
    setUrlError('');
    onChange({ src: url, alt: block.alt || imageAltFromUrl(url) });
    setShowUrl(false);
    setUrlDraft('');
    setMobileMenuOpen(false);
  }, [block.alt, onChange, t]);

  const handleFilesDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const f = Array.from(e.dataTransfer.files).find(x => x.type.startsWith('image/'));
    if (f) applyFile(f);
  }, [applyFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (Array.from(e.dataTransfer.items).some(i => i.kind === 'file' && i.type.startsWith('image/'))) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const el = zoneRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const f = item.getAsFile();
          if (f) applyFile(f);
          return;
        }
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [readOnly, applyFile, block.src]);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = wrapRef.current?.querySelector('img');
    const startW = block.width ?? img?.clientWidth ?? 300;
    resizeRef.current = { startX: e.clientX, startW };
    setResizingW(startW);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const delta = e.clientX - resizeRef.current.startX;
    const next = clampImageWidth(resizeRef.current.startW, delta);
    setResizingW(next);
    onChange({ width: next });
  };

  const endResize = () => { resizeRef.current = null; setResizingW(null); };

  const saveCaption = useCallback(() => {
    const trimmed = captionDraft.trim();
    if (trimmed !== (block.caption ?? '')) onChange({ caption: trimmed });
  }, [captionDraft, block.caption, onChange]);

  const dropZoneStyle = (active: boolean): CSSProperties => ({
    border: `2px dashed ${active ? c.accent : c.border}`,
    borderRadius: 10,
    padding: block.src ? '12px' : '22px 16px',
    textAlign: 'center',
    background: active ? c.accentBg : c.card,
    transition: 'border-color .15s, background .15s',
  });

  const hiddenFile = (
    <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
      onChange={e => { const f = e.target.files?.[0]; if (f) applyFile(f); e.target.value = ''; }}/>
  );

  const controlBtnStyle = { ...imgBtnStyle(c), fontSize: 10, padding: '3px 8px' };
  const deleteBtnStyle = { ...imgBtnStyle(c, true), fontSize: 10, padding: '3px 8px' };

  const showDesktopControls = !isMobile && (hoverControls || showUrl);

  const imageActionButtons = (
    <>
      <button type="button" onClick={() => fileRef.current?.click()} style={controlBtnStyle} data-k108-image-replace-file>
        {t('blockImageReplaceFile')}
      </button>
      <button type="button" onClick={() => { setShowUrl(v => !v); setUrlError(''); }} style={controlBtnStyle} data-k108-image-replace-url>
        {t('blockImageReplaceUrl')}
      </button>
      <button type="button" onClick={() => onChange({ src: '', width: undefined })} style={deleteBtnStyle} data-k108-image-delete>
        {t('blockImageDelete')}
      </button>
    </>
  );

  const openViewer = useCallback(() => {
    if (block.src) gallery?.openGallery(block.id);
  }, [block.src, block.id, gallery]);

  if (readOnly) {
    return (
      <figure className="be-image-block" style={{ margin:'8px 0', textAlign:'center' }} data-k108-image-block>
        {block.src
          ? (
            <button
              type="button"
              onClick={openViewer}
              className="border-0 bg-transparent p-0 cursor-zoom-in inline-block max-w-full"
              data-k118-image-open
              aria-label={t('k118OpenImageViewer')}
            >
              <img src={block.src} alt={block.alt ?? ''} style={imgStyle(block.width)}/>
            </button>
          )
          : <div style={{ background:c.card, border:`2px dashed ${c.border}`, borderRadius:8, padding:'40px 20px', color:c.textFaint, fontSize:13 }}>
              <ImageIcon size={24} style={{ marginBottom:8, opacity:.4 }}/><div>{t('blockImageNoImage')}</div>
            </div>}
        {block.caption && <figcaption style={{ fontSize:12, color:c.textMuted, marginTop:6, fontStyle:'italic' }}>{block.caption}</figcaption>}
      </figure>
    );
  }

  if (!block.src) {
    return (
      <div
        ref={zoneRef}
        className="be-image-block"
        tabIndex={0}
        onClick={e => e.stopPropagation()}
        style={{ margin:'8px 0', outline:'none' }}
        data-k108-image-block
        data-k108-image-empty
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleFilesDrop}
          style={dropZoneStyle(isDragOver)}
        >
          <div style={{ marginBottom:10, color:c.textFaint }}><ImageIcon size={22}/></div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={imgBtnStyle(c)}>{t('blockImageUpload')}</button>
            <button type="button" onClick={() => { setShowUrl(v => !v); setUrlError(''); }} style={imgBtnStyle(c)}>{t('blockImageEnterUrl')}</button>
          </div>
          {showUrl && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:10, alignItems:'center' }}>
              <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%', maxWidth:360 }}>
                <input value={urlDraft} autoFocus
                  onChange={e => { setUrlDraft(e.target.value); setUrlError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(urlDraft); } }}
                  placeholder="https://example.com/image.png"
                  style={{ flex:1, background:c.input, border:`1px solid ${urlError ? c.danger : c.inputBdr}`, color:c.text, borderRadius:6, padding:'5px 9px', fontSize:12, outline:'none' }}/>
                <button type="button" onClick={() => applyUrl(urlDraft)} style={imgBtnStyle(c)}>{t('blockImageAdd')}</button>
              </div>
              {urlError && <span style={{ fontSize:11, color:c.danger }}>{urlError}</span>}
            </div>
          )}
          <div style={{ fontSize:10, color:c.textFaint, marginTop:8 }}>
            {t('blockImageDropPasteHint')}
          </div>
        </div>
        <input value={captionDraft}
          onChange={e => setCaptionDraft(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); (e.target as HTMLInputElement).blur(); } }}
          placeholder={t('blockCaptionOptional')}
          style={{ display:'block', margin:'10px auto 0', width:'70%', maxWidth:420, textAlign:'center', background:'transparent', border:'none', borderBottom:`1px solid ${c.border}`, color:c.textMuted, fontSize:12, fontStyle:'italic', outline:'none', padding:'2px 4px' }}/>
        {hiddenFile}
      </div>
    );
  }

  return (
    <figure
      ref={zoneRef}
      className="be-image-block"
      tabIndex={0}
      onClick={e => e.stopPropagation()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFilesDrop}
      onMouseEnter={() => setHoverControls(true)}
      onMouseLeave={() => { setHoverControls(false); if (!showUrl) setMobileMenuOpen(false); }}
      style={{ margin:'8px 0', textAlign:'center', outline:'none' }}
      data-k108-image-block
      data-k108-image-compact={isMobile ? 'mobile-menu' : 'hover-reveal'}
    >
      <div
        ref={wrapRef}
        style={{
          position:'relative', display:'inline-block', maxWidth:'100%',
          ...dropZoneStyle(isDragOver),
          padding: isDragOver ? 8 : 0,
          border: isDragOver ? `2px dashed ${c.accent}` : 'none',
          background: isDragOver ? c.accentBg : 'transparent',
        }}
      >
        <img
          src={block.src}
          alt={block.alt ?? ''}
          style={{ ...imgStyle(block.width), cursor: 'zoom-in' }}
          onClick={openViewer}
          data-k118-image-open
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openViewer();
            }
          }}
        />
        {!isMobile && (
          <div
            data-k108-image-controls
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 6,
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
              justifyContent: 'center',
              maxWidth: 'calc(100% - 12px)',
              padding: '4px 6px',
              borderRadius: 8,
              background: c.card,
              border: `1px solid ${c.border}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              opacity: showDesktopControls ? 1 : 0,
              pointerEvents: showDesktopControls ? 'auto' : 'none',
              transition: 'opacity .15s ease',
            }}
          >
            {imageActionButtons}
          </div>
        )}
        <div
          role="separator"
          aria-label={t('blockImageResize')}
          onPointerDown={startResize}
          onPointerMove={onResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          style={{
            position:'absolute', right:-4, bottom:-4, width:14, height:14,
            cursor:'nwse-resize', background:c.accent, borderRadius:3,
            border:`2px solid ${c.card}`, touchAction:'none',
          }}
        />
        {resizingW != null && (
          <span style={{
            position:'absolute', top:-22, right:0, fontSize:10, fontWeight:700,
            color:c.accent, background:c.card, border:`1px solid ${c.border}`,
            borderRadius:4, padding:'1px 6px',
          }}>{resizingW}px</span>
        )}
      </div>
      {isMobile && (
        <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex', marginTop: 4 }}>
          <button
            type="button"
            className="btbtn"
            aria-expanded={mobileMenuOpen}
            title={t('blockImageMoreActions')}
            onClick={() => setMobileMenuOpen(v => !v)}
            data-k108-image-more
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
              padding: '0 10px',
              color: mobileMenuOpen ? c.accent : c.textMuted,
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {mobileMenuOpen ? (
            <div
              role="menu"
              data-k108-image-mobile-menu
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 4,
                zIndex: 120,
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: '4px 0',
                minWidth: 160,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              {imageActionButtons}
            </div>
          ) : null}
        </div>
      )}
      {showUrl && (
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8, alignItems:'center' }} data-k108-image-url-panel>
          <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%', maxWidth:360 }}>
            <input value={urlDraft} autoFocus
              onChange={e => { setUrlDraft(e.target.value); setUrlError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(urlDraft); } }}
              placeholder="https://example.com/image.png"
              style={{ flex:1, background:c.input, border:`1px solid ${urlError ? c.danger : c.inputBdr}`, color:c.text, borderRadius:6, padding:'5px 9px', fontSize:12, outline:'none' }}/>
            <button type="button" onClick={() => applyUrl(urlDraft)} style={imgBtnStyle(c)}>{t('blockImageApply')}</button>
          </div>
          {urlError && <span style={{ fontSize:11, color:c.danger }}>{urlError}</span>}
        </div>
      )}
      <input value={captionDraft}
        onChange={e => setCaptionDraft(e.target.value)}
        onBlur={saveCaption}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); (e.target as HTMLInputElement).blur(); } }}
        placeholder={t('blockCaptionSaveHint')}
        data-k108-image-caption
        style={{ display:'block', margin:'6px auto 0', width:'70%', maxWidth:420, textAlign:'center', background:'transparent', border:'none', borderBottom:`1px solid ${c.border}`, color:c.textMuted, fontSize:12, fontStyle:'italic', outline:'none', padding:'2px 4px' }}/>
      {hiddenFile}
    </figure>
  );
}
