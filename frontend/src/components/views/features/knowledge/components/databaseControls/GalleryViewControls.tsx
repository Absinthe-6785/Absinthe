import type { NoteChromeColors } from '../../../noteEditorTheme';
import {
  GALLERY_CARD_FIELDS_FIELD,
  GALLERY_COVER_PROPERTY_FIELD,
} from '../../databaseViews/databasePresentationMeta';
import type { DatabaseGalleryConfig } from '../../databaseViews/databasePresentationModels';
import { formatGalleryCardFieldsInput, parseGalleryCardFieldsInput } from '../../databaseViews/galleryModels';
import { DatabasePropertyKeyField } from '../DatabasePropertyKeyField';

export interface GalleryViewControlsProps {
  colors: NoteChromeColors;
  galleryConfig: DatabaseGalleryConfig;
  columnKeys: readonly string[];
  onGalleryCoverChange: (coverProperty: string) => void;
  onGalleryCardFieldsChange: (cardFields: readonly string[]) => void;
}

export function GalleryViewControls({
  colors: c,
  galleryConfig,
  columnKeys,
  onGalleryCoverChange,
  onGalleryCardFieldsChange,
}: GalleryViewControlsProps) {
  return (
    <>
      <DatabasePropertyKeyField
        preset={GALLERY_COVER_PROPERTY_FIELD}
        value={galleryConfig.coverProperty ?? ''}
        onChange={onGalleryCoverChange}
        listId="database-gallery-cover-suggestions"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700 }}>{GALLERY_CARD_FIELDS_FIELD.label}</span>
        <input
          className="bwi"
          style={{ fontSize: 10 }}
          placeholder={GALLERY_CARD_FIELDS_FIELD.placeholder}
          value={formatGalleryCardFieldsInput(galleryConfig.cardFields)}
          list="database-gallery-card-fields-suggestions"
          onChange={event => onGalleryCardFieldsChange(parseGalleryCardFieldsInput(event.target.value))}
        />
        <datalist id="database-gallery-card-fields-suggestions">
          {columnKeys.map(key => (
            <option key={key} value={key} />
          ))}
        </datalist>
      </div>
    </>
  );
}
