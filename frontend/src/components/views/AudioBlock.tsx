import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';
import { fileNameFromUrl, formatMediaDisplayLabel } from './mediaUrlUtils';

function isValidAudioUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (/^data:audio\//i.test(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface AudioBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { src?: string; caption?: string }) => void;
}

/** K-118 — Audio file preview with duration and play control. */
export function AudioBlock({ block, colors: c, readOnly, onChange }: AudioBlockProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [urlDraft, setUrlDraft] = useState(block.src ?? '');
  const [captionDraft, setCaptionDraft] = useState(block.caption ?? '');
  const [urlError, setUrlError] = useState('');
  const [duration, setDuration] = useState<number | null>(null);

  const fileLabel = block.src
    ? formatMediaDisplayLabel('audio', block.src)
    : t('k118AudioLabel');

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => setDuration(el.duration);
    el.addEventListener('loadedmetadata', onMeta);
    return () => el.removeEventListener('loadedmetadata', onMeta);
  }, [block.src]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !block.src) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [block.src]);

  const applyUrl = () => {
    const url = urlDraft.trim();
    if (!isValidAudioUrl(url)) {
      setUrlError(t('k118AudioUrlInvalid'));
      return;
    }
    setUrlError('');
    onChange({ src: url, caption: captionDraft.trim() || undefined });
  };

  if (!readOnly && !block.src) {
    return (
      <div
        className="be-audio-block"
        style={{
          border: `1px dashed ${c.border}`, borderRadius: 8, padding: '12px 14px',
          background: c.toolbar, margin: '4px 0',
        }}
        onClick={e => e.stopPropagation()}
        data-k118-audio-block
        data-k118-audio-empty
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: c.textMuted, fontSize: 12 }}>
          <Volume2 size={14} /> {t('k118AudioUrlHint')}
        </div>
        <input
          value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          placeholder="https://example.com/lecture.mp3"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 6,
            background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6,
            padding: '6px 10px', fontSize: 12, color: c.text, outline: 'none',
          }}
        />
        <input
          value={captionDraft}
          onChange={e => setCaptionDraft(e.target.value)}
          placeholder={t('blockCaptionOptional')}
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 8,
            background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6,
            padding: '6px 10px', fontSize: 12, color: c.text, outline: 'none',
          }}
        />
        {urlError && <div style={{ fontSize: 11, color: c.danger, marginBottom: 6 }}>{urlError}</div>}
        <button
          type="button"
          onClick={applyUrl}
          style={{
            background: c.accent, color: c.toolbarActiveFg ?? '#fff', border: 'none',
            borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {t('blockImageAdd')}
        </button>
      </div>
    );
  }

  return (
    <div
      className="be-audio-block"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: c.toolbar, border: `1px solid ${c.border}`, borderRadius: 10, margin: '4px 0',
      }}
      onClick={e => e.stopPropagation()}
      data-k118-audio-block
      data-k118-file-preview="audio"
    >
      <button
        type="button"
        aria-label={playing ? t('k118Pause') : t('k118Play')}
        onClick={togglePlay}
        disabled={!block.src}
        className="shrink-0"
        data-k118-audio-play
        style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: block.src ? 'pointer' : 'default',
          background: c.accent, color: c.toolbarActiveFg ?? '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-k118-audio-title>
          {block.caption?.trim() || fileLabel}
        </div>
        <div style={{ fontSize: 10, color: c.textMuted, display: 'flex', gap: 8, marginTop: 2 }}>
          <span data-k118-audio-duration>{duration != null ? formatDuration(duration) : '—'}</span>
          {block.src ? (
            <button
              type="button"
              onClick={() => window.open(block.src, '_blank', 'noopener,noreferrer')}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: c.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}
              data-k118-audio-open
            >
              {t('k118OpenFile')} <ExternalLink size={10} />
            </button>
          ) : null}
        </div>
      </div>
      {block.src && (
        <audio
          ref={audioRef}
          src={block.src}
          preload="metadata"
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange({ src: '', caption: undefined })}
          style={{ background: 'none', border: 'none', padding: '0 6px', fontSize: 10, color: c.textMuted, cursor: 'pointer', minHeight: 44 }}
        >
          {t('k118ChangeUrl')}
        </button>
      )}
    </div>
  );
}

export { isValidAudioUrl };
