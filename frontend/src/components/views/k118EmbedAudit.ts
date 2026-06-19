/**
 * K-118 — Embed preview audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)));

export function auditEmbeds(): Record<string, boolean> {
  const embed = readFileSync(join(ROOT, 'MediaEmbedPreview.tsx'), 'utf8');
  const registry = readFileSync(join(ROOT, 'blockRegistry.tsx'), 'utf8');
  const code = readFileSync(join(ROOT, 'CodeBlock.tsx'), 'utf8');
  return {
    youtubeEmbed: embed.includes('youtube.com/embed'),
    webFavicon: embed.includes('data-k118-embed-favicon'),
    collapsedUrl: embed.includes('data-k118-embed-url-collapsed'),
    paragraphHook: registry.includes('paragraphShowsEmbedPreview'),
    codeBlock: code.includes('data-k118-code-block'),
  };
}

export function auditEmbedRc(): boolean {
  const r = auditEmbeds();
  return r.youtubeEmbed && r.paragraphHook && r.collapsedUrl;
}
