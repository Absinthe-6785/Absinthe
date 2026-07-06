# K-299 Supabase Usage Guardrail Metadata Boundary Implementation

K-299 adds the pure metadata boundary selected by K-298.

Files:

- `frontend/src/lib/supabaseUsageRouteMetadata.ts`
- `frontend/src/lib/supabaseUsageRouteMetadata.test.ts`
- `frontend/src/lib/supabaseUsageRouteMetadataBoundaryAudit.test.ts`

The metadata classifies source-grounded request categories only. It includes auth/session, app bootstrap, analytics polling, user-action reads/writes, Notes sync reads/writes, provider transfers, attachment transfers, background refresh, and conservative unknown/unclassified fallback behavior.

K-299 does not wire metadata into runtime request paths. It does not change `authFetch`, `fetcher`, SWR hooks, analytics polling, Supabase config/env, auth/session behavior, Notes runtime, backup/provider behavior, Signal Panel behavior, Health/Schedule, or persistence.

Recommended K-300 path: a closure audit or runbook/monitoring plan that consumes the K-299 vocabulary without adding broad traffic-control behavior.
