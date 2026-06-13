import type { NoteChromeColors } from '../../../../noteEditorTheme';
import { useTranslation } from '../../../../../../lib/i18n';
import { getDatabasePropertyFieldPreset } from '../../databaseViews/databasePresentationMeta';
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
  galleryConfig,
  columnKeys,
  onGalleryCoverChange,
  onGalleryCardFieldsChange,
}: GalleryViewControlsProps) {
  const { lang } = useTranslation();
  const coverField = getDatabasePropertyFieldPreset('galleryCover', lang);
  const cardFieldsPreset = getDatabasePropertyFieldPreset('galleryCardFields', lang);

  return (
    <>
      <DatabasePropertyKeyField
        preset={coverField}
        value={galleryConfig.coverProperty ?? ''}
        onChange={onGalleryCoverChange}
        listId="database-gallery-cover-suggestions"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700 }}>{cardFieldsPreset.label}</span>
        <input
          className="bwi"
          style={{ fontSize: 10 }}
          placeholder={cardFieldsPreset.placeholder}
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
