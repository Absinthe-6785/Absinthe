export type StartupDomain = 'notes' | 'health';
export type StartupDomainStatus = 'pending' | 'ready' | 'failed';

export type StartupDomainState = {
  status: StartupDomainStatus;
  error: string | null;
};

export type StartupStateChange = (
  domain: StartupDomain,
  state: StartupDomainState,
) => void;

export type IndependentStartupInput = {
  startNotes: () => Promise<void>;
  startHealth: (() => Promise<void>) | null;
  onStateChange: StartupStateChange;
};

export type IndependentStartupRun = {
  cancel: () => void;
  retry: (domain: StartupDomain) => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'startup_domain_failed';
}

/**
 * Starts the two domain bootstraps from the same authenticated boundary.
 * Each domain keeps its own internal order; only the domain entry points are
 * concurrent. Per-domain generations prevent a cancelled or superseded run
 * from publishing a stale ready/failed state.
 */
export function startIndependentStartup(
  input: IndependentStartupInput,
): IndependentStartupRun {
  let active = true;
  const generations: Record<StartupDomain, number> = { notes: 0, health: 0 };
  const tasks: Record<StartupDomain, (() => Promise<void>) | null> = {
    notes: input.startNotes,
    health: input.startHealth,
  };

  const publish = (
    domain: StartupDomain,
    generation: number,
    state: StartupDomainState,
  ): void => {
    if (!active || generations[domain] !== generation) return;
    input.onStateChange(domain, state);
  };

  const run = (domain: StartupDomain): void => {
    const task = tasks[domain];
    if (!task) {
      generations[domain] += 1;
      publish(domain, generations[domain], { status: 'ready', error: null });
      return;
    }

    const generation = generations[domain] + 1;
    generations[domain] = generation;
    publish(domain, generation, { status: 'pending', error: null });

    let result: Promise<void>;
    try {
      // Invoke synchronously so both independent domain entries begin before
      // either deferred task can resolve.
      result = task();
    } catch (error) {
      publish(domain, generation, { status: 'failed', error: errorMessage(error) });
      return;
    }

    void result.then(
      () => publish(domain, generation, { status: 'ready', error: null }),
      error => publish(domain, generation, { status: 'failed', error: errorMessage(error) }),
    );
  };

  run('notes');
  run('health');

  return {
    cancel: () => {
      active = false;
      generations.notes += 1;
      generations.health += 1;
    },
    retry: (domain) => {
      if (active) run(domain);
    },
  };
}
