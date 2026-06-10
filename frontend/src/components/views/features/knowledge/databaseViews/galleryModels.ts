import type { NoteBase } from '../../../noteUtils';

/** Resolved field row on a gallery card — not persisted */
export interface GalleryField {
  key: string;
  label: string;
  value: string;
}

/** Resolved gallery card — not persisted */
export interface GalleryItem {
  noteId: string;
  note: NoteBase;
  title: string;
  coverImage?: string;
  tags?: string;
  fields: GalleryField[];
}

export function isValidCoverImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function parseGalleryCardFieldsInput(raw: string): string[] {
  return raw
    .split(',')
    .map(field => field.trim())
    .filter(Boolean);
}

export function formatGalleryCardFieldsInput(fields: readonly string[] | undefined): string {
  return fields?.join(', ') ?? '';
}

export const GALLERY_CARD_SIZE_MIN_WIDTH: Record<'compact' | 'medium' | 'large', number> = {
  compact: 120,
  medium: 160,
  large: 200,
};
