import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { DATABASE_EMPTY_MESSAGE } from '../databaseViews/databasePresentationMeta';
import type { DatabaseGalleryCardSize } from '../databaseViews/databasePresentationModels';
import { GALLERY_CARD_SIZE_MIN_WIDTH, type GalleryItem } from '../databaseViews/galleryModels';
import { DatabaseNoteCard } from './DatabaseNoteCard';

export interface DatabaseGalleryViewProps {
  colors: NoteChromeColors;
  items: readonly GalleryItem[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  cardSize?: DatabaseGalleryCardSize;
  showCoverPlaceholder?: boolean;
  onSelectNote: (noteId: string) => void;
}

function GalleryCardFields({
  colors: c,
  fields,
}: {
  colors: NoteChromeColors;
  fields: GalleryItem['fields'];
}) {
  if (fields.length === 0) return null;
  return (
    <div style={{ padding: '0 6px 6px' }}>
      {fields.map(field => (
        <div key={field.key} style={{ fontSize: 9, color: c.textMuted }}>
          {field.label}: {field.value}
        </div>
      ))}
    </div>
  );
}

export function DatabaseGalleryView({
  colors: c,
  items,
  service,
  activeNoteId,
  cardSize = 'medium',
  showCoverPlaceholder = false,
  onSelectNote,
}: DatabaseGalleryViewProps) {
  const minWidth = GALLERY_CARD_SIZE_MIN_WIDTH[cardSize];

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.notelist, padding: 8 }}>
      {items.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
          {DATABASE_EMPTY_MESSAGE}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
          gap: 8,
          alignItems: 'start',
        }}>
          {items.map(item => {
            const hasCoverConfig = Boolean(showCoverPlaceholder || item.coverImage);
            if (hasCoverConfig) {
              return (
                <div key={item.noteId}>
                  <DatabaseNoteCard
                    note={item.note}
                    colors={c}
                    service={service}
                    isActive={item.noteId === activeNoteId}
                    onSelect={() => onSelectNote(item.noteId)}
                    size="compact"
                    coverImageUrl={item.coverImage}
                    showCoverPlaceholder={showCoverPlaceholder && !item.coverImage}
                  />
                  <GalleryCardFields colors={c} fields={item.fields} />
                </div>
              );
            }

            return (
              <div key={item.noteId}>
                <DatabaseNoteCard
                  note={item.note}
                  colors={c}
                  service={service}
                  isActive={item.noteId === activeNoteId}
                  onSelect={() => onSelectNote(item.noteId)}
                  size="compact"
                />
                {item.fields.length > 0 && (
                  <GalleryCardFields colors={c} fields={item.fields} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
