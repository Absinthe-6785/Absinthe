import { describe, expect, it } from 'vitest';
import {
  classifyMediaUrl,
  extractLoneUrl,
  formatMediaDisplayLabel,
  youtubeVideoId,
} from './mediaUrlUtils';
import { collectConsecutiveImageGallery } from './imageGallery';
import { makeBlock } from './blockUtils';

describe('mediaUrlUtils', () => {
  it('extracts bare and markdown lone URLs', () => {
    expect(extractLoneUrl('https://example.com/doc.pdf')).toBe('https://example.com/doc.pdf');
    expect(extractLoneUrl('[](https://youtu.be/abcdefghijk)')).toBe('https://youtu.be/abcdefghijk');
    expect(extractLoneUrl('not a url')).toBeNull();
  });

  it('classifies media kinds', () => {
    expect(classifyMediaUrl('https://x.com/a.pdf')).toBe('pdf');
    expect(classifyMediaUrl('https://x.com/lecture.mp3')).toBe('audio');
    expect(classifyMediaUrl('https://x.com/clip.mp4')).toBe('video');
    expect(classifyMediaUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe('youtube');
    expect(youtubeVideoId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk');
  });

  it('formats display labels without raw URLs', () => {
    expect(formatMediaDisplayLabel('pdf', 'https://x.com/document.pdf')).toBe('document.pdf');
    expect(formatMediaDisplayLabel('youtube', 'https://youtube.com/watch?v=abcdefghijk')).toBe('YouTube');
    expect(formatMediaDisplayLabel('web', 'https://docs.example.com/page')).toBe('docs.example.com');
  });
});

describe('imageGallery', () => {
  it('collects consecutive root image blocks', () => {
    const blocks = [
      makeBlock('paragraph', { content: 'text' }),
      makeBlock('image', { src: 'a.png' }),
      makeBlock('image', { src: 'b.png' }),
      makeBlock('image', { src: 'c.png' }),
      makeBlock('paragraph', { content: 'end' }),
    ];
    const mid = blocks[2]!;
    const { images, index } = collectConsecutiveImageGallery(blocks, mid.id);
    expect(images).toHaveLength(3);
    expect(index).toBe(1);
    expect(images.map(i => i.src)).toEqual(['a.png', 'b.png', 'c.png']);
  });
});
