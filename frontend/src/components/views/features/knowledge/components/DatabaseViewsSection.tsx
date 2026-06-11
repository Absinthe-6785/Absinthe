import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DatabaseView, DatabaseViewPresentation } from '../databaseViews/databaseViewModels';
import {
  BOARD_GROUP_BY_FIELD,
  CALENDAR_DATE_PROPERTY_FIELD,
  GALLERY_CARD_FIELDS_FIELD,
  GALLERY_COVER_PROPERTY_FIELD,
  TIMELINE_END_DATE_FIELD,
  TIMELINE_START_DATE_FIELD,
  presentationLabel,
} from '../databaseViews/databasePresentationMeta';
import { parseGalleryCardFieldsInput } from '../databaseViews/galleryModels';
import { DATABASE_TEMPLATES } from '../databaseViews/databaseTemplates';
import { WorkspacePinToggle } from './WorkspacePinToggle';
import { DatabasePresentationSwitcher } from './DatabasePresentationSwitcher';
import { DatabasePropertyKeyField } from './DatabasePropertyKeyField';

export interface DatabaseViewsSectionProps {
  colors: NoteChromeColors;
  views: readonly DatabaseView[];
  activeViewId: string | null;
  counts: Readonly<Record<string, number>>;
  canCreateFromCurrent: boolean;
  currentQuery: string;
  onActivate: (view: DatabaseView) => void;
  onClearActive: () => void;
  onCreate: (
    name: string,
    query: string,
    presentation?: DatabaseViewPresentation,
    groupBy?: string,
    dateProperty?: string,
    startDateProperty?: string,
    endDateProperty?: string,
    coverProperty?: string,
    cardFields?: readonly string[],
  ) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onCreateFromTemplate?: (templateId: string) => void;
  isPinned?: (id: string) => boolean;
  onTogglePin?: (view: DatabaseView) => void;
  /** Increment to programmatically open the create form (e.g. dashboard quick action) */
  openCreateFormSignal?: number;
}

export function DatabaseViewsSection({
  colors: c,
  views,
  activeViewId,
  counts,
  canCreateFromCurrent,
  currentQuery,
  onActivate,
  onClearActive,
  onCreate,
  onRename,
  onDelete,
  onCreateFromTemplate,
  isPinned,
  onTogglePin,
  openCreateFormSignal,
}: DatabaseViewsSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [newPresentation, setNewPresentation] = useState<DatabaseViewPresentation>('table');
  const [newGroupBy, setNewGroupBy] = useState('status');
  const [newDateProperty, setNewDateProperty] = useState('reviewDate');
  const [newStartDateProperty, setNewStartDateProperty] = useState('startDate');
  const [newEndDateProperty, setNewEndDateProperty] = useState('endDate');
  const [newCoverProperty, setNewCoverProperty] = useState('coverImage');
  const [newCardFields, setNewCardFields] = useState('status, priority, reviewDate');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const openCreateForm = (prefillQuery = '') => {
    setShowTemplatePicker(false);
    setNewQuery(prefillQuery);
    setNewPresentation('table');
    setNewGroupBy('status');
    setNewDateProperty('reviewDate');
    setNewStartDateProperty('startDate');
    setNewEndDateProperty('endDate');
    setNewCoverProperty('coverImage');
    setNewCardFields('status, priority, reviewDate');
    setShowCreateForm(true);
  };

  useEffect(() => {
    if (openCreateFormSignal) {
      openCreateForm('');
    }
  }, [openCreateFormSignal]);

  const openTemplatePicker = () => {
    setShowCreateForm(false);
    setShowTemplatePicker(true);
  };

  const selectTemplate = (templateId: string) => {
    onCreateFromTemplate?.(templateId);
    setShowTemplatePicker(false);
  };

  const submitCreate = () => {
    const trimmedName = newName.trim();
    const trimmedQuery = newQuery.trim();
    if (!trimmedName || !trimmedQuery) return;
    onCreate(
      trimmedName,
      trimmedQuery,
      newPresentation,
      newPresentation === 'board' ? newGroupBy : undefined,
      newPresentation === 'calendar' ? newDateProperty : undefined,
      newPresentation === 'timeline' ? newStartDateProperty : undefined,
      newPresentation === 'timeline' ? newEndDateProperty : undefined,
      newPresentation === 'gallery' ? newCoverProperty : undefined,
      newPresentation === 'gallery' ? parseGalleryCardFieldsInput(newCardFields) : undefined,
    );
    setNewName('');
    setNewQuery('');
    setShowCreateForm(false);
  };

  const submitRename = () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRename(renamingId, trimmed);
    setRenamingId(null);
    setRenameValue('');
  };

  const presentationLabelForView = (view: DatabaseView) => presentationLabel(view.presentation);

  if (
    views.length === 0
    && !canCreateFromCurrent
    && !showCreateForm
    && !showTemplatePicker
    && !openCreateFormSignal
  ) {
    return null;
  }

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Database Views</span>
        {activeViewId && (
          <button
            type="button"
            onClick={onClearActive}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title="Clear active database view"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {views.map(view => (
        renamingId === view.id ? (
          <div key={view.id} style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
            <input
              className="bwi"
              style={{ flex: 1, fontSize: 11 }}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              autoFocus
            />
            <button className="bwbg" style={{ padding: '2px 6px', fontSize: 10 }} onClick={submitRename}>Save</button>
          </div>
        ) : (
          <div
            key={view.id}
            className={`bfi ${activeViewId === view.id ? 'active' : ''}`}
            onClick={() => onActivate(view)}
            style={{ gap: 4, fontSize: 11 }}
            title={`${view.query} · ${presentationLabelForView(view)}`}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {view.name}
            </span>
            <span style={{ fontSize: 9, color: c.textMuted }}>{counts[view.id] ?? 0}</span>
            {onTogglePin && (
              <WorkspacePinToggle
                colors={c}
                pinned={isPinned?.(view.id) ?? false}
                onToggle={e => { e.stopPropagation(); onTogglePin(view); }}
              />
            )}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setRenamingId(view.id);
                setRenameValue(view.name);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="Rename database view"
            >
              <Pencil size={9} />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete(view.id);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
              title="Delete database view"
            >
              <Trash2 size={9} />
            </button>
          </div>
        )
      ))}

      {showTemplatePicker ? (
        <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {DATABASE_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => selectTemplate(template.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: c.card,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 5,
                padding: '6px 8px',
                cursor: 'pointer',
                color: c.text,
              }}
              title={template.description}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>{template.name}</div>
              <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{template.description}</div>
              <div style={{ fontSize: 9, color: c.textFaint, marginTop: 4 }}>
                {presentationLabel(template.presentation)}
              </div>
            </button>
          ))}
          <button
            onClick={() => setShowTemplatePicker(false)}
            style={{ background: c.cardHov, border: 'none', borderRadius: 5, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '3px' }}
          >
            Cancel
          </button>
        </div>
      ) : showCreateForm ? (
        <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="Database name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
            autoFocus
          />
          <input
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="Query (e.g. tag:japanese)"
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setShowCreateForm(false);
            }}
          />
          <DatabasePresentationSwitcher
            value={newPresentation}
            onChange={setNewPresentation}
            showLabel={false}
            className="bwi"
            style={{ width: '100%' }}
          />
          {newPresentation === 'board' && (
            <div style={{ width: '100%' }}>
              <DatabasePropertyKeyField
                preset={BOARD_GROUP_BY_FIELD}
                value={newGroupBy}
                onChange={setNewGroupBy}
                onSubmit={submitCreate}
                inputClassName="bwi"
                inputStyle={{ width: '100%', minWidth: 0, fontSize: 11 }}
                labelStyle={{ fontSize: 11 }}
                listId="database-create-board-groupby"
              />
            </div>
          )}
          {newPresentation === 'calendar' && (
            <div style={{ width: '100%' }}>
              <DatabasePropertyKeyField
                preset={CALENDAR_DATE_PROPERTY_FIELD}
                value={newDateProperty}
                onChange={setNewDateProperty}
                onSubmit={submitCreate}
                inputClassName="bwi"
                inputStyle={{ width: '100%', minWidth: 0, fontSize: 11 }}
                labelStyle={{ fontSize: 11 }}
                listId="database-create-calendar-date"
              />
            </div>
          )}
          {newPresentation === 'timeline' && (
            <>
              <div style={{ width: '100%' }}>
                <DatabasePropertyKeyField
                  preset={TIMELINE_START_DATE_FIELD}
                  value={newStartDateProperty}
                  onChange={setNewStartDateProperty}
                  onSubmit={submitCreate}
                  inputClassName="bwi"
                  inputStyle={{ width: '100%', minWidth: 0, fontSize: 11 }}
                  labelStyle={{ fontSize: 11 }}
                  listId="database-create-timeline-start"
                />
              </div>
              <div style={{ width: '100%' }}>
                <DatabasePropertyKeyField
                  preset={TIMELINE_END_DATE_FIELD}
                  value={newEndDateProperty}
                  onChange={setNewEndDateProperty}
                  onSubmit={submitCreate}
                  inputClassName="bwi"
                  inputStyle={{ width: '100%', minWidth: 0, fontSize: 11 }}
                  labelStyle={{ fontSize: 11 }}
                  listId="database-create-timeline-end"
                />
              </div>
            </>
          )}
          {newPresentation === 'gallery' && (
            <>
              <div style={{ width: '100%' }}>
                <DatabasePropertyKeyField
                  preset={GALLERY_COVER_PROPERTY_FIELD}
                  value={newCoverProperty}
                  onChange={setNewCoverProperty}
                  onSubmit={submitCreate}
                  inputClassName="bwi"
                  inputStyle={{ width: '100%', minWidth: 0, fontSize: 11 }}
                  labelStyle={{ fontSize: 11 }}
                  listId="database-create-gallery-cover"
                />
              </div>
              <input
                className="bwi"
                style={{ width: '100%', fontSize: 11 }}
                placeholder={GALLERY_CARD_FIELDS_FIELD.placeholder}
                value={newCardFields}
                onChange={e => setNewCardFields(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') setShowCreateForm(false);
                }}
              />
            </>
          )}
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="bwbg" style={{ flex: 1, padding: '3px', fontSize: 11 }} onClick={submitCreate}>Save</button>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{ flex: 1, background: c.cardHov, border: 'none', borderRadius: 5, color: c.textMuted, fontSize: 11, cursor: 'pointer', padding: '3px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="bfi"
            onClick={() => openCreateForm()}
            style={{ color: c.textMuted, fontSize: 10 }}
          >
            <Plus size={10} color={c.textMuted} />
            <span>New database</span>
          </div>
          {onCreateFromTemplate && (
            <div
              className="bfi"
              onClick={openTemplatePicker}
              style={{ color: c.textMuted, fontSize: 10 }}
            >
              <Plus size={10} color={c.textMuted} />
              <span>Choose template</span>
            </div>
          )}
          {canCreateFromCurrent && (
            <div
              className="bfi"
              onClick={() => openCreateForm(currentQuery)}
              style={{ color: c.textMuted, fontSize: 10 }}
            >
              <Plus size={10} color={c.textMuted} />
              <span>Save current query</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
