import { Component, lazy, Suspense, useCallback, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';

import type { ToastType } from '../hooks/useToast';
import { useTranslation } from '../lib/i18n';
import { ViewLoadingFallback } from './common/ViewLoadingFallback';

type NotesRouteViewProps = {
  showToast?: (message: string, type?: ToastType) => void;
  accountId?: string;
};

type NotesRouteBoundaryProps = NotesRouteViewProps & {
  active: boolean;
};

type NotesRouteErrorBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
  errorMessage: string;
  retryLabel: string;
};

type NotesRouteErrorBoundaryState = {
  error: Error | null;
};

function createLazyNoteView() {
  return lazy(async () => {
    const module = await import('./views/NoteView');
    return { default: module.NoteView };
  });
}

class NotesRouteErrorBoundary extends Component<
  NotesRouteErrorBoundaryProps,
  NotesRouteErrorBoundaryState
> {
  state: NotesRouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): NotesRouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.warn('[NotesRouteErrorBoundary]', error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex flex-1 items-center justify-center p-6" role="alert" data-testid="notes-route-load-error">
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-surface p-6 text-center shadow-absinthe-lg">
            <p className="font-semibold text-primary">{this.props.errorMessage}</p>
            <button
              type="button"
              onClick={this.props.onRetry}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              data-testid="notes-route-retry"
            >
              {this.props.retryLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Keeps Notes authority in AppContent while isolating only the NoteView UI. */
export function NotesRouteBoundary({ active, showToast, accountId }: NotesRouteBoundaryProps) {
  const { t } = useTranslation();
  const [retryKey, setRetryKey] = useState(0);
  const LazyNoteView = useMemo(() => createLazyNoteView(), [retryKey]);
  const retry = useCallback(() => setRetryKey(previous => previous + 1), []);

  if (!active) return null;

  return (
    <NotesRouteErrorBoundary
      key={retryKey}
      onRetry={retry}
      errorMessage={t('notesRouteLoadFailed')}
      retryLabel={t('startupRetry')}
    >
      <Suspense fallback={<ViewLoadingFallback label={t('notesRouteLoading')} />}>
        <LazyNoteView showToast={showToast} accountId={accountId} />
      </Suspense>
    </NotesRouteErrorBoundary>
  );
}
