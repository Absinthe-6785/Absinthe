import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface WorkspaceErrorBoundaryProps {
  workspace: string;
  children: ReactNode;
  fallback?: ReactNode;
}

interface WorkspaceErrorBoundaryState {
  error: Error | null;
}

/** K-120 — lightweight workspace error boundary (isolates failures per surface). */
export class WorkspaceErrorBoundary extends Component<WorkspaceErrorBoundaryProps, WorkspaceErrorBoundaryState> {
  state: WorkspaceErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WorkspaceErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.warn(`[WorkspaceErrorBoundary:${this.props.workspace}]`, error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          data-k120-workspace-error={this.props.workspace}
          className="flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground"
        >
          <p className="font-semibold">Something went wrong in this workspace.</p>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted/50"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-k120-workspace-boundary={this.props.workspace}>
        {this.props.children}
      </div>
    );
  }
}
