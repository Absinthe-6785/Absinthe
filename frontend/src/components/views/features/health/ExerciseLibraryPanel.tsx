import { memo } from 'react';
import { HealthBlockLibrary, type HealthBlockLibraryProps } from './HealthBlockLibrary';

export type ExerciseLibraryPanelProps = HealthBlockLibraryProps;

/** K-125C — immediate-mount exercise library wrapper. */
export const ExerciseLibraryPanel = memo(function ExerciseLibraryPanel(props: ExerciseLibraryPanelProps) {
  return (
    <div data-k125c-health-immediate="library">
      <HealthBlockLibrary {...props} />
    </div>
  );
});
