# REL-05G1 Workout Dormant Foundation

REL-05G1 adds the future canonical workout session schema and a read-only capability foundation. It is dormant: absent capability rows resolve to `DISABLED`, persisted rows are constrained to `DISABLED`, and no account may become `ACTIVE`. Manual `ACTIVE` transition is prohibited in G1.

The new canonical schema is not production workout authority. Existing local IndexedDB and legacy workout behavior remain authoritative. G1 performs no adoption, backfill, product cutover, or cross-device sync.

## Reference client topology

- Desktop: Windows with Absinthe installed from the website in Microsoft Edge as an app/PWA-style site.
- Mobile: iPhone/iOS Safari with Absinthe added to the Home Screen and used as a Web App.

These are independent device and local-storage instances. They do not share IndexedDB, and unsynced local data is not cloud-recoverable merely because it exists in IndexedDB. Future cloud convergence must work between these clients.

REL-05G1 does not implement or test cross-device convergence. REL-05G3 must test independent source manifests, different local-only histories, late-device arrival, and duplicate or ambiguous adoption. REL-05G4 must test convergence in both directions, independent generations, offline mutation and reconnect, conflict preservation, and reset epochs across disconnected devices. REL-05G5 must test the actual product cutover on both reference environments, including relaunch, offline use, reconnect, cloud recovery, and cross-device propagation.

## Deferred work

- G2: canonical numeric wire validation, delivery binding, shared local workout repository, and atomic convergence commits.
- G3: device/account adoption manifests and late-device candidates.
- G4: workout push/pull, common authority lock, authority epochs, generation binding, stable inventory, and durable reset jobs.
- G5: product save/delete, startup, history, calendar, analytics, backup, restore, and reset adapters.
- G6: legacy database evidence, rollback-proof writer/API fences, old-binary validation, and any account `ACTIVE` transition.

Do not expand G1 to change legacy workout routes, `workout_logs`, product UI, or browser-specific behavior.
