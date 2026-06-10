import {
  normalizeWorkspaceSession,
  type WorkspaceSessionState,
} from './workspaceModels';

export const WORKSPACE_SESSION_KEY = 'note-workspace-session-v1';

export function workspaceSessionFromActivation(
  activation: WorkspaceSessionState['activation'],
  previous: WorkspaceSessionState | null = null,
  updatedAt = Date.now(),
): WorkspaceSessionState {
  const resumeActivation = activation.kind !== 'none' && activation.kind !== 'dashboard'
    ? activation
    : previous?.resumeActivation;
  const session: WorkspaceSessionState = { activation, updatedAt };
  if (
    resumeActivation
    && resumeActivation.kind !== 'none'
    && resumeActivation.kind !== 'dashboard'
  ) {
    session.resumeActivation = resumeActivation;
  }
  return session;
}

export function loadWorkspaceSession(): WorkspaceSessionState | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_SESSION_KEY);
    if (!raw) return null;
    return normalizeWorkspaceSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveWorkspaceSession(state: WorkspaceSessionState): void {
  try {
    localStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify(state));
  } catch {
    /** ignore quota errors */
  }
}

export function clearWorkspaceSession(): void {
  try {
    localStorage.removeItem(WORKSPACE_SESSION_KEY);
  } catch {
    /** ignore storage errors */
  }
}
