# K-44 Discovery History Integration

---

## Scope

No new discovery categories. History adjusts **confidence scores** only.

Module: `discovery/historyDiscoveryBoost.ts`

---

## Boost rules (14-day window)

| Signal | Effect |
|--------|--------|
| Note recently linked | `emerging-topic` +8 score |
| Note recently linked | `forgotten-knowledge` / `knowledge-drift` −12 |
| Area recently assigned/hub | `emerging-topic` +6 |
| Note reactivated (link/discovery resolve) | `knowledge-drift` −8 |

---

## Wiring

`buildDiscoveryFeed(notes, service, { historyEvents })` in `NoteView` — shared with timeline and dashboard.

---

## Limitations

Boosts apply only when history exists. Pre-K-44 vaults behave as K-38/K-40.
