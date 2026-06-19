import React, { useCallback, useRef, useState } from 'react';
import {
  ExternalLink, FileText, Globe, Music, Play, Video, Youtube,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useViewportLayout } from '../../hooks/useViewportLayout';
import type { BlockEditorColors } from './editorTypes';
import {
  classifyMediaUrl,
  faviconUrl,
  formatMediaDisplayLabel,
  hostFromUrl,
  truncateUrl,
  youtubeVideoId,
  type MediaKind,
} from './mediaUrlUtils';

export interface MediaEmbedPreviewProps {
  url: string;
  colors: BlockEditorColors;
  readOnly?: boolean;
  compact?: boolean;
}

function kindIcon(kind: MediaKind) {
  switch (kind) {
    case 'youtube': return Youtube;
    case 'pdf': return FileText;
    case 'audio': return Music;
    case 'video': return Video;
    default: return Globe;
  }
}

/** K-118 — Rich embed / file preview card (replaces raw long URLs). */
export function MediaEmbedPreview({ url, colors: c, readOnly = false, compact = false }: MediaEmbedPreviewProps) {
  const { t } = useTranslation();
  const { isMobile } = useViewportLayout();
  const kind = classifyMediaUrl(url);
  const label = formatMediaDisplayLabel(kind, url);
  const Icon = kindIcon(kind);
  const ytId = kind === 'youtube' ? youtubeVideoId(url) : null;
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const openUrl = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const playVideo = () => {
    setVideoPlaying(true);
    void videoRef.current?.play();
  };

  const shellClass = `rounded-xl border overflow-hidden ${compact ? 'my-1' : 'my-2'}`;
  const shellStyle = {
    borderColor: c.border,
    background: c.card,
  };

  if (kind === 'youtube' && ytId && readOnly) {
    return (
      <div
        className={shellClass}
        style={shellStyle}
        data-k118-embed-preview
        data-k118-embed-kind="youtube"
      >
        <div className="relative w-full aspect-video bg-black">
          <iframe
            title={label}
            src={`https://www.youtube.com/embed/${ytId}`}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
          <Youtube size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-semibold truncate">{label}</span>
        </div>
      </div>
    );
  }

  if (kind === 'video' && readOnly && videoPlaying) {
    return (
      <div className={shellClass} style={shellStyle} data-k118-embed-preview data-k118-embed-kind="video">
        <video
          ref={videoRef}
          src={url}
          controls
          className="w-full max-h-[360px] bg-black"
          data-k118-video-player
        />
      </div>
    );
  }

  return (
    <div
      className={shellClass}
      style={shellStyle}
      data-k118-embed-preview
      data-k118-embed-kind={kind}
      data-k118-file-preview={kind === 'pdf' || kind === 'audio' || kind === 'video' ? 'true' : undefined}
    >
      {kind === 'video' && readOnly ? (
        <button
          type="button"
          onClick={playVideo}
          className="relative w-full aspect-video bg-black/80 flex items-center justify-center min-h-[120px]"
          data-k118-video-thumb
        >
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play size={22} className="ml-1 text-black" />
            </span>
          </span>
        </button>
      ) : null}

      <div className={`flex items-center gap-3 px-3 ${kind === 'video' && readOnly ? 'py-2' : 'py-2.5'} min-h-[44px]`}>
        {kind === 'web' ? (
          <img src={faviconUrl(url)} alt="" width={20} height={20} className="shrink-0 rounded-sm" data-k118-embed-favicon />
        ) : (
          <Icon size={18} className="shrink-0 opacity-80" style={{ color: c.accent }} />
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-semibold truncate" style={{ color: c.text }} data-k118-embed-title>
            {label}
          </p>
          {!readOnly || kind !== 'web' ? (
            <p className="text-[10px] truncate opacity-60" style={{ color: c.textMuted }} data-k118-embed-url-collapsed>
              {truncateUrl(url, isMobile ? 32 : 56)}
            </p>
          ) : (
            <p className="text-[10px] truncate opacity-60" style={{ color: c.textMuted }}>
              {hostFromUrl(url)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openUrl}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg min-h-[44px] lg:min-h-[32px]"
          style={{ background: c.accent, color: c.toolbarActiveFg ?? '#fff' }}
          data-k118-embed-open
        >
          {kind === 'pdf' ? t('k118OpenFile') : kind === 'audio' || kind === 'video' ? t('k118Play') : t('k118OpenLink')}
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}

export interface ParagraphWithEmbedProps {
  block: { id: string; content: string };
  colors: BlockEditorColors;
  readOnly: boolean;
  children: React.ReactNode;
  embedUrl: string;
}

/** Paragraph wrapper — preview card + optional editor chrome. */
export function ParagraphWithEmbed({ colors, readOnly, children, embedUrl }: ParagraphWithEmbedProps) {
  if (readOnly) {
    return <MediaEmbedPreview url={embedUrl} colors={colors} readOnly />;
  }
  return (
    <div data-k118-paragraph-embed>
      <MediaEmbedPreview url={embedUrl} colors={colors} compact />
      {children}
    </div>
  );
}
