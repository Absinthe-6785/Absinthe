import React, { useCallback, useRef, useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

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

export interface AudioBlockProps {
  block: Block;
  colors: BlockEditorColors;
  readOnly: boolean;
  onChange: (patch: { src?: string; caption?: string }) => void;
}

export function AudioBlock({ block, colors: c, readOnly, onChange }: AudioBlockProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [urlDraft, setUrlDraft] = useState(block.src ?? '');
  const [captionDraft, setCaptionDraft] = useState(block.caption ?? '');
  const [urlError, setUrlError] = useState('');

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
      setUrlError('http(s) 또는 data:audio URL을 입력하세요');
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
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: c.textMuted, fontSize: 12 }}>
          <Volume2 size={14} /> 오디오 URL
        </div>
        <input
          value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          placeholder="https://example.com/audio.mp3"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 6,
            background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6,
            padding: '6px 10px', fontSize: 12, color: c.text, outline: 'none',
          }}
        />
        <input
          value={captionDraft}
          onChange={e => setCaptionDraft(e.target.value)}
          placeholder="캡션 (선택)"
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
          }}
        >
          삽입
        </button>
      </div>
    );
  }

  return (
    <div
      className="be-audio-block"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        background: c.toolbar, border: `1px solid ${c.border}`, borderRadius: 8, margin: '4px 0',
      }}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={playing ? '일시정지' : '재생'}
        onClick={togglePlay}
        disabled={!block.src}
        style={{
          width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: block.src ? 'pointer' : 'default',
          background: c.accent, color: c.toolbarActiveFg ?? '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {block.caption?.trim() || '오디오'}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onChange({ src: '', caption: undefined })}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: c.textMuted, cursor: 'pointer' }}
          >
            URL 변경
          </button>
        )}
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
    </div>
  );
}

export { isValidAudioUrl };
