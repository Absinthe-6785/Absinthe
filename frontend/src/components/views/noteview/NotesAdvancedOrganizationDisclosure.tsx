import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';

export const NOTES_ADVANCED_ORGANIZATION_REGION_ID = 'noteview-advanced-organization';
const NOTES_ADVANCED_ORGANIZATION_TOGGLE_ID = 'noteview-advanced-organization-toggle';

export interface NotesAdvancedOrganizationDisclosureProps {
  colors: NoteChromeColors;
  expanded: boolean;
  active: boolean;
  label: string;
  onToggle: () => void;
  children: ReactNode;
}

export interface NotesAdvancedOrganizationIntent {
  hasActiveTag: boolean;
  isDashboardMode: boolean;
  isTraceAreaMode: boolean;
  isTraceDiscoveryMode: boolean;
  hasWorkspaceActivation: boolean;
}

export interface NotesPrimarySurfaceInput {
  isMobile: boolean;
  mobileShowEditor: boolean;
  hasActiveNote: boolean;
  isMobileEmptyVault: boolean;
}

export function shouldRevealNotesAdvancedOrganization({
  hasActiveTag,
  isDashboardMode,
  isTraceAreaMode,
  isTraceDiscoveryMode,
  hasWorkspaceActivation,
}: NotesAdvancedOrganizationIntent): boolean {
  return hasActiveTag
    || isDashboardMode
    || isTraceAreaMode
    || isTraceDiscoveryMode
    || hasWorkspaceActivation;
}

export function resolveNotesPrimarySurfaceVisibility({
  isMobile,
  mobileShowEditor,
  hasActiveNote,
  isMobileEmptyVault,
}: NotesPrimarySurfaceInput) {
  return {
    hideNoteList: (isMobile && mobileShowEditor && hasActiveNote) || (isMobile && isMobileEmptyVault),
    hideEditorArea: isMobile && !mobileShowEditor && !isMobileEmptyVault,
  };
}

/** Notes-only containment boundary for tertiary knowledge-management navigation. */
export function NotesAdvancedOrganizationDisclosure({
  colors: c,
  expanded,
  active,
  label,
  onToggle,
  children,
}: NotesAdvancedOrganizationDisclosureProps) {
  return (
    <section
      data-notes-hierarchy-level="advanced-organization"
      data-notes-advanced-active={active || undefined}
      style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}
    >
      <button
        id={NOTES_ADVANCED_ORGANIZATION_TOGGLE_ID}
        type="button"
        className="bseclbl k101-interactive"
        aria-expanded={expanded}
        aria-controls={NOTES_ADVANCED_ORGANIZATION_REGION_ID}
        onClick={onToggle}
        data-notes-advanced-organization-toggle
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          border: 'none',
          background: 'none',
          color: active ? c.accent : 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {expanded
          ? <ChevronDown size={10} style={{ flexShrink: 0, color: active ? c.accent : c.textFaint }} />
          : <ChevronRight size={10} style={{ flexShrink: 0, color: active ? c.accent : c.textFaint }} />}
        <span>{label}</span>
      </button>
      <div
        id={NOTES_ADVANCED_ORGANIZATION_REGION_ID}
        role="region"
        aria-labelledby={NOTES_ADVANCED_ORGANIZATION_TOGGLE_ID}
        hidden={!expanded}
        data-notes-advanced-organization-content
      >
        {children}
      </div>
    </section>
  );
}
