/**
 * K-116 — User-owned workspace audit (no auto subject generation).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SMART_COLLECTION_GROUPS } from '../components/views/features/knowledge/collections/smartCollectionGroups';
import { isSubjectSmartCollectionId } from '../components/views/features/knowledge/collections/sidebarSmartCollections';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function auditWorkspaceOwnership(): Record<string, boolean> {
  const sidebar = readFileSync(join(ROOT, 'components/views/features/knowledge/collections/sidebarSmartCollections.ts'), 'utf8');
  const groups = readFileSync(join(ROOT, 'components/views/features/knowledge/collections/smartCollectionGroups.ts'), 'utf8');
  const dashboard = readFileSync(join(ROOT, 'components/views/noteview/useNoteViewDashboard.ts'), 'utf8');
  const rules = readFileSync(join(ROOT, 'components/views/features/knowledge/collections/ruleCollections.ts'), 'utf8');
  const noSubjectsGroup = !SMART_COLLECTION_GROUPS.some(g => g.id === 'subjects');
  return {
    sidebarFilter: sidebar.includes('filterSidebarSmartCollections'),
    noSubjectsGroup,
    noSubjectIcons: !groups.includes('subject-japanese-history'),
    noAutoDashboardSubjects: !dashboard.includes('buildAllSubjectWorkspaces'),
    ruleCollectionCrud: rules.includes('createRuleCollection') && rules.includes('reorderRuleCollections'),
    legacySubjectLookup: isSubjectSmartCollectionId('subject-politics'),
  };
}

export function auditWorkspaceRc(): boolean {
  const w = auditWorkspaceOwnership();
  return w.sidebarFilter && w.noSubjectsGroup && w.noAutoDashboardSubjects && w.ruleCollectionCrud;
}
