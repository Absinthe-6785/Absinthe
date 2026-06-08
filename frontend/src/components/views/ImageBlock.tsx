import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { Block } from './blockUtils';
import { isValidImageUrl, imageAltFromUrl } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import type { CSSProperties } from 'react';
import { clampImageWidth, imageDisplayStyle, imgBtnStyle } from './imageBlockUtils';

export interface ImageBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { src?: string; alt?: string; caption?: string; width?: number }) => void;
}

export function ImageBlock({ block, colors: c, readOnly, onChange }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [resizingW, setResizingW] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState(block.caption ?? '');

  useEffect(() => { setCaptionDraft(block.caption ?? ''); }, [block.caption]);

  const imgStyle = (width?: number) => imageDisplayStyle(c, width);

  const applyFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      onChange({ src, alt: block.alt || f.name.replace(/\.[^.]+$/, '') });
      setUrlError('');
      setShowUrl(false);
      setUrlDraft('');
    };
    reader.readAsDataURL(f);
  }, [block.alt, onChange]);

  const applyUrl = useCallback((raw: string) => {
    const url = raw.trim();
    if (!isValidImageUrl(url)) {
      setUrlError('http(s) 또는 data:image URL을 입력하세요');
      return;
    }
    setUrlError('');
    onChange({ src: url, alt: block.alt || imageAltFromUrl(url) });
    setShowUrl(false);
    setUrlDraft('');
  }, [block.alt, onChange]);

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

  if (readOnly) {
    return (
      <figure className="be-image-block" style={{ margin:'8px 0', textAlign:'center' }}>
        {block.src
          ? <img src={block.src} alt={block.alt ?? ''} style={imgStyle(block.width)}/>
          : <div style={{ background:c.card, border:`2px dashed ${c.border}`, borderRadius:8, padding:'40px 20px', color:c.textFaint, fontSize:13 }}>
              <ImageIcon size={24} style={{ marginBottom:8, opacity:.4 }}/><div>이미지 없음</div>
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
      >
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleFilesDrop}
          style={dropZoneStyle(isDragOver)}
        >
          <div style={{ marginBottom:10, color:c.textFaint }}><ImageIcon size={22}/></div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={imgBtnStyle(c)}>파일 업로드</button>
            <button type="button" onClick={() => { setShowUrl(v => !v); setUrlError(''); }} style={imgBtnStyle(c)}>URL 입력</button>
          </div>
          {showUrl && (
            <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:10, alignItems:'center' }}>
              <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%', maxWidth:360 }}>
                <input value={urlDraft} autoFocus
                  onChange={e => { setUrlDraft(e.target.value); setUrlError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(urlDraft); } }}
                  placeholder="https://example.com/image.png"
                  style={{ flex:1, background:c.input, border:`1px solid ${urlError ? c.danger : c.inputBdr}`, color:c.text, borderRadius:6, padding:'5px 9px', fontSize:12, outline:'none' }}/>
                <button type="button" onClick={() => applyUrl(urlDraft)} style={imgBtnStyle(c)}>추가</button>
              </div>
              {urlError && <span style={{ fontSize:11, color:c.danger }}>{urlError}</span>}
            </div>
          )}
          <div style={{ fontSize:10, color:c.textFaint, marginTop:8 }}>
            드래그&드롭 · 붙여넣기(Ctrl+V) 지원
          </div>
        </div>
        <input value={captionDraft}
          onChange={e => setCaptionDraft(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); (e.target as HTMLInputElement).blur(); } }}
          placeholder="캡션 (선택)"
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
      style={{ margin:'8px 0', textAlign:'center', outline:'none' }}
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
        <img src={block.src} alt={block.alt ?? ''} style={imgStyle(block.width)}/>
        <div
          role="separator"
          aria-label="이미지 크기 조절"
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
      <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:8, flexWrap:'wrap' }}>
        <button type="button" onClick={() => fileRef.current?.click()} style={imgBtnStyle(c)}>파일 교체</button>
        <button type="button" onClick={() => { setShowUrl(v => !v); setUrlError(''); }} style={imgBtnStyle(c)}>URL 교체</button>
        <button type="button" onClick={() => onChange({ src: '', width: undefined })} style={imgBtnStyle(c, true)}>삭제</button>
      </div>
      {showUrl && (
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:6, justifyContent:'center', width:'100%', maxWidth:360 }}>
            <input value={urlDraft} autoFocus
              onChange={e => { setUrlDraft(e.target.value); setUrlError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(urlDraft); } }}
              placeholder="https://example.com/image.png"
              style={{ flex:1, background:c.input, border:`1px solid ${urlError ? c.danger : c.inputBdr}`, color:c.text, borderRadius:6, padding:'5px 9px', fontSize:12, outline:'none' }}/>
            <button type="button" onClick={() => applyUrl(urlDraft)} style={imgBtnStyle(c)}>적용</button>
          </div>
          {urlError && <span style={{ fontSize:11, color:c.danger }}>{urlError}</span>}
        </div>
      )}
      <input value={captionDraft}
        onChange={e => setCaptionDraft(e.target.value)}
        onBlur={saveCaption}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCaption(); (e.target as HTMLInputElement).blur(); } }}
        placeholder="캡션 (선택) — Enter 또는 포커스 해제 시 저장"
        style={{ display:'block', margin:'10px auto 0', width:'70%', maxWidth:420, textAlign:'center', background:'transparent', border:'none', borderBottom:`1px solid ${c.border}`, color:c.textMuted, fontSize:12, fontStyle:'italic', outline:'none', padding:'2px 4px' }}/>
      {hiddenFile}
    </figure>
  );
}
