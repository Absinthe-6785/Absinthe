// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useNoteNavigationStack } from './useNoteNavigationStack';
import { resetNoteNavigationStack } from '../lib/noteNavigationStack';

describe('useNoteNavigationStack', () => {
  beforeEach(() => {
    resetNoteNavigationStack();
  });

  it('does not enter an infinite render loop (React #185 guard)', () => {
    let renderCount = 0;

    function Probe() {
      renderCount += 1;
      if (renderCount > 50) {
        throw new Error('Maximum update depth exceeded — unstable useSyncExternalStore snapshot');
      }
      const { canBack, canForward } = useNoteNavigationStack();
      const renders = useRef(0);
      renders.current += 1;
      return (
        <div data-testid="probe">
          {String(canBack)}
          {String(canForward)}
          {renders.current}
        </div>
      );
    }

    render(<Probe />);
    expect(renderCount).toBeLessThanOrEqual(5);
  });
});
