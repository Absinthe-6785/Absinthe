/**
 * K-125F — Sidebar mobile navigation audit (K-126B implementation).
 * K-132A adds Home as the first primary workspace tab; legacy workspaces remain in the rail.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditK125fSidebarNavigation(): Record<string, boolean> {
  const sidebar = readFileSync(join(ROOT, 'components/common/Sidebar.tsx'), 'utf8');
  const app = readFileSync(join(ROOT, 'components/AppContent.tsx'), 'utf8');
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  return {
    mobileMoreTrigger: sidebar.includes('data-k126-mobile-more-trigger'),
    mobileSidebarHook: sidebar.includes('data-k126-mobile-sidebar'),
    desktopUtilsHiddenOnMobile: sidebar.includes('hidden lg:flex') && sidebar.includes('flex lg:hidden'),
    primaryWorkspaceTabs: sidebar.includes("['home', 'note', 'health', 'analytics', 'planner', 'recipe']"),
    mobileMoreSheetWired: sidebar.includes('MobileMoreSheet'),
    settingsSectionNav: app.includes('openSettingsSection') && app.includes('settingsScrollTarget'),
    settingsScrollEffect: settings.includes('settingsScrollTarget') && settings.includes('scrollIntoView'),
    desktopThemeButton: sidebar.includes('toggleDarkMode') && sidebar.includes('hidden lg:flex'),
    desktopSettingsButton: sidebar.includes("setActiveTab('settings')") && sidebar.includes('hidden lg:flex'),
  };
}

export function auditK125fRc(): boolean {
  return Object.values(auditK125fSidebarNavigation()).every(Boolean);
}
