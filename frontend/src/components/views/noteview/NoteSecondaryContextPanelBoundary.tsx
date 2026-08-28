import {
  Component,
  lazy,
  Suspense,
  type ComponentType,
  type ErrorInfo,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { useTranslation } from '@/lib/i18n';
import { ViewLoadingFallback } from '../../common/ViewLoadingFallback';
import type {
  NoteSecondaryContextPanelProps,
  SecondaryContextPanel,
} from './NoteSecondaryContextPanelContract';

export type SecondaryContextPanelComponent = ComponentType<NoteSecondaryContextPanelProps>;
export type SecondaryContextPanelLazyComponent = LazyExoticComponent<SecondaryContextPanelComponent>;
export type SecondaryContextPanelLoader = () => Promise<{ default: SecondaryContextPanelComponent }>;

const loadSecondaryContextPanel: SecondaryContextPanelLoader = () => import('./NoteSecondaryContextPanel');

/** Creates the stable lazy identity used for one mounted Notes context host. */
export function createLazySecondaryContextPanel(
  loader: SecondaryContextPanelLoader = loadSecondaryContextPanel,
): SecondaryContextPanelLazyComponent {
  return lazy(loader);
}

type PanelErrorBoundaryProps = {
  children: ReactNode;
  panel: SecondaryContextPanel;
  onRetry: () => void;
  errorMessage: string;
  retryLabel: string;
};

type PanelErrorBoundaryState = {
  error: Error | null;
};

class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.warn('[NoteSecondaryContextPanelBoundary]', error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          data-testid="notes-secondary-panel-error"
          data-secondary-panel={this.props.panel}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            flex: 1,
            minHeight: 120,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, color: 'inherit', fontSize: 12 }}>{this.props.errorMessage}</p>
          <button
            type="button"
            onClick={this.props.onRetry}
            data-testid="notes-secondary-panel-retry"
            style={{
              minHeight: 34,
              padding: '6px 12px',
              borderRadius: 7,
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {this.props.retryLabel}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function PanelLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div data-testid="notes-secondary-panel-loading" data-loading-scope="panel-body">
      <ViewLoadingFallback label={t('loading')} />
    </div>
  );
}

export type NoteSecondaryContextPanelBoundaryProps = NoteSecondaryContextPanelProps & {
  LazyPanelComponent: SecondaryContextPanelLazyComponent;
  retryKey: number;
  onRetry: () => void;
};

/** Keeps lazy loading and failures inside the right-panel body only. */
export function NoteSecondaryContextPanelBoundary({
  LazyPanelComponent,
  retryKey,
  onRetry,
  ...panelProps
}: NoteSecondaryContextPanelBoundaryProps) {
  const { t } = useTranslation();
  return (
    <PanelErrorBoundary
      key={retryKey}
      panel={panelProps.panel}
      onRetry={onRetry}
      errorMessage={t('notesContextPanelLoadFailed')}
      retryLabel={t('startupRetry')}
    >
      <Suspense fallback={<PanelLoadingFallback />}>
        <LazyPanelComponent {...panelProps} />
      </Suspense>
    </PanelErrorBoundary>
  );
}
