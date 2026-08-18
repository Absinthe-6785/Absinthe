import { describe, expect, it } from 'vitest';
import {
  auditAppContentStartupContract,
  auditSyncPathHooks,
  auditSyncPaths,
} from './k114SyncPathAudit';

describe('k114SyncPathAudit', () => {
  it('routes authenticated startup through the complete snapshot bootstrap', () => {
    const audit = auditSyncPaths();
    expect(audit.usesNotesSyncClient).toBe(true);
    expect(audit.appContentOnceGuard).toBe(true);
    expect(audit.healthSingleFlightWired).toBe(true);
    expect(audit.deltaSyncCallers).toEqual([]);
    expect(audit.dormantHydrateEntryPointsRemoved).toBe(true);
    expect(auditSyncPathHooks()).toContain('fetchCompleteNotesFoldersSnapshot');
    expect(auditSyncPathHooks()).toContain('startIndependentStartup');
    expect(auditSyncPathHooks()).toContain('account-scoped Notes storage initialization');
    expect(auditSyncPathHooks()).toContain('startup cancellation cleanup');
  });

  it('has no unconditional GET /api/notes in store', () => {
    const audit = auditSyncPaths();
    expect(audit.duplicateFetchRisks).toEqual([]);
  });

  it('fails closed when a protected startup boundary is absent or reordered', () => {
    const fixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes: async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        },
        startHealth: () => runHealthBootstrapSingleFlight(authUser.id, startHealth),
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;

    expect(auditAppContentStartupContract(fixture)).toMatchObject({
      coordinatorWired: true,
      notesBootstrapOrdered: true,
      cancellationBoundaryWired: true,
      accountScoped: true,
      healthSingleFlightWired: true,
      appContentOnceGuard: true,
    });
    expect(auditAppContentStartupContract(fixture.replace('startIndependentStartup', 'legacyStartup')).appContentOnceGuard)
      .toBe(false);
    expect(auditAppContentStartupContract(fixture.replace('await initNotesStorage(authUser.id);', 'await bootstrapFromSupabase();'))
      .notesBootstrapOrdered).toBe(false);
    expect(auditAppContentStartupContract(fixture.replace('startupLifecycle.cancel();', 'someOtherThing.cancel();'))
      .cancellationBoundaryWired).toBe(false);
    expect(auditAppContentStartupContract(fixture.replace('runHealthBootstrapSingleFlight', 'runHealthBootstrap'))
      .healthSingleFlightWired).toBe(false);
  });

  it('bounds Notes evidence to the coordinator startNotes callback', () => {
    const unrelatedEvidenceFixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes: async () => {},
        startHealth: () => runHealthBootstrapSingleFlight(authUser.id, startHealth),
      });
      await initNotesStorage(otherAccountId);
      await bootstrapFromSupabase();
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    expect(auditAppContentStartupContract(unrelatedEvidenceFixture).appContentOnceGuard).toBe(false);
  });

  it('selects the exact startNotes property between sibling callbacks', () => {
    const precedingSiblingFixture = `
      const startupLifecycle = startIndependentStartup({
        startHealth: async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        },
        startNotes: async () => {},
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    const followingSiblingFixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes: async () => {},
        startHealth: async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        },
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;

    expect(auditAppContentStartupContract(precedingSiblingFixture).appContentOnceGuard).toBe(false);
    expect(auditAppContentStartupContract(followingSiblingFixture).appContentOnceGuard).toBe(false);
  });

  it('fails closed for unsupported startNotes values before following siblings', () => {
    const values = [
      'startNotes: startNotesHandler,',
      'startNotes: async () => doSomething(),',
      'startNotes: async () => ({ diagnostic: initNotesStorage(authUser.id), bootstrap: bootstrapFromSupabase() }),',
      'startNotes: null,',
      'startNotes: "async () => { initNotesStorage(authUser.id); bootstrapFromSupabase(); }",',
      'startNotes: `\n        async () => {\n          initNotesStorage(authUser.id);\n          bootstrapFromSupabase();\n        }\n      `,',
      'startNotes: async () => {},',
      `startNotes: async () => {
        // initNotesStorage(authUser.id)
        // bootstrapFromSupabase()
      },`,
      `startNotes: condition
        ? async () => {
            await initNotesStorage(authUser.id);
            await bootstrapFromSupabase();
          }
        : fallback,`,
      `startNotes: wrap(
        async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        }
      ),`,
      `startNotes: condition && async () => {
        await initNotesStorage(authUser.id);
        await bootstrapFromSupabase();
      },`,
      `startNotes: maybeHandler ?? async () => {
        await initNotesStorage(authUser.id);
        await bootstrapFromSupabase();
      },`,
      `startNotes: [
        async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        }
      ][0],`,
      `startNotes: ({
        handler: async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        }
      }).handler,`,
    ];

    for (const value of values) {
      const fixture = `
        const startupLifecycle = startIndependentStartup({
          ${value}
          startHealth: async () => {
            await initNotesStorage(authUser.id);
            await bootstrapFromSupabase();
          },
        });
        return () => {
          startupLifecycle.cancel();
          detachNotesStorage();
        };
      `;
      expect(auditAppContentStartupContract(fixture)).toMatchObject({
        notesBootstrapOrdered: false,
        accountScoped: false,
        appContentOnceGuard: false,
      });
    }
  });

  it('allows comments between the supported root callback tokens', () => {
    const fixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes:
          /* startup */
          async /* callback */ () /* parameters */ => /* body */ {
            await initNotesStorage(authUser.id);
            await bootstrapFromSupabase();
          },
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    expect(auditAppContentStartupContract(fixture)).toMatchObject({
      accountScoped: true,
      notesBootstrapOrdered: true,
      appContentOnceGuard: true,
    });
  });

  it('masks comments between the property and its inline callback', () => {
    const values = [
      `startNotes:
        // => { initNotesStorage(authUser.id); bootstrapFromSupabase(); }
        async () => {},`,
      `startNotes:
        /*
          => {
            initNotesStorage(authUser.id);
            bootstrapFromSupabase();
          }
        */
        async () => {},`,
    ];

    for (const value of values) {
      const fixture = `
        const startupLifecycle = startIndependentStartup({
          ${value}
        });
        return () => {
          startupLifecycle.cancel();
          detachNotesStorage();
        };
      `;
      expect(auditAppContentStartupContract(fixture)).toMatchObject({
        notesBootstrapOrdered: false,
        accountScoped: false,
        appContentOnceGuard: false,
      });
    }
  });

  it('rejects Notes evidence found only in comments and string literals', () => {
    const bodies = [
      `
        // initNotesStorage(authUser.id)
        // bootstrapFromSupabase()
      `,
      `
        /*
          initNotesStorage(authUser.id)
          bootstrapFromSupabase()
        */
      `,
      `
        const debug = "initNotesStorage(authUser.id)";
        const marker = 'bootstrapFromSupabase()';
      `,
      `
        const debug = ` + '`\n          initNotesStorage(authUser.id)\n          bootstrapFromSupabase()\n        `' + `;
      `,
    ];

    for (const body of bodies) {
      const fixture = `
        const startupLifecycle = startIndependentStartup({
          startNotes: async () => {${body}},
        });
        return () => {
          startupLifecycle.cancel();
          detachNotesStorage();
        };
      `;
      expect(auditAppContentStartupContract(fixture)).toMatchObject({
        notesBootstrapOrdered: false,
        accountScoped: false,
        appContentOnceGuard: false,
      });
    }
  });

  it('rejects reversed or unrelated account-scoped Notes evidence', () => {
    const fixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes: async () => {
          await bootstrapFromSupabase();
          await initNotesStorage(otherAccountId);
        },
        startHealth: () => runHealthBootstrapSingleFlight(authUser.id, startHealth),
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    expect(auditAppContentStartupContract(fixture).notesBootstrapOrdered).toBe(false);
    expect(auditAppContentStartupContract(fixture).accountScoped).toBe(false);
  });

  it('rejects reversed executable calls even when account scope is correct', () => {
    const fixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes: async () => {
          await bootstrapFromSupabase();
          await initNotesStorage(authUser.id);
        },
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    expect(auditAppContentStartupContract(fixture)).toMatchObject({
      accountScoped: true,
      notesBootstrapOrdered: false,
      appContentOnceGuard: false,
    });
  });

  it('keeps the correctly ordered inline callback as the control case', () => {
    const fixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes:
          // formatting/comment between the property and callback is allowed
          async () => {
            await initNotesStorage(authUser.id);
            await bootstrapFromSupabase();
          },
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    expect(auditAppContentStartupContract(fixture)).toMatchObject({
      accountScoped: true,
      notesBootstrapOrdered: true,
      appContentOnceGuard: true,
    });
  });

  it('binds cancellation to the startup-run result regardless of its local name', () => {
    const fixture = `
      const startupLifecycle = startIndependentStartup({
        startNotes: async () => {
          await initNotesStorage(authUser.id);
          await bootstrapFromSupabase();
        },
      });
      return () => {
        startupLifecycle.cancel();
        detachNotesStorage();
      };
    `;
    expect(auditAppContentStartupContract(fixture).cancellationBoundaryWired).toBe(true);
    expect(auditAppContentStartupContract(fixture.replace('startupLifecycle.cancel()', 'someOtherThing.cancel()'))
      .cancellationBoundaryWired).toBe(false);
  });
});
