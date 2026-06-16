import { lazy, Suspense } from 'react';
import { ViewLoadingFallback } from '../../common/ViewLoadingFallback';
import type { ComponentProps } from 'react';
import type { NoteGraphView } from '../NoteGraphView';

const LazyNoteGraphView = lazy(() =>
  import('../NoteGraphView').then(m => ({ default: m.NoteGraphView })),
);

export type NoteGraphViewLazyProps = ComponentProps<typeof NoteGraphView>;

/** K-86: defer Cosmos bundle + graph simulation until graph view mounts. */
export function NoteGraphViewLazy(props: NoteGraphViewLazyProps) {
  return (
    <Suspense fallback={<ViewLoadingFallback />}>
      <LazyNoteGraphView {...props} />
    </Suspense>
  );
}
