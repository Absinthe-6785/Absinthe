# Notes identity lifecycle candidate (inactive)

TASK_ID: NOTES-IDENTITY-LIFECYCLE-GUARD-01

This extends the existing disconnected SQL/Python candidate, not production
Notes endpoints, local persistence, Supabase grants, or a migration. Every
readiness gate remains false by default. Python returns denial even if all
prerequisites are asserted. No browser or provider role receives EXECUTE.

## Identity and reservation

UNREGISTERED means no trusted ledger entry, not "fresh". An absent remote row,
client UUID, local timestamp, comparison result, or provenance string never
authorizes registration of an existing authored ID. There is no arbitrary-ID
registration function. Existing historical/local IDs remain ineligible; their
references are never rewritten or silently assigned new IDs.

The isolated server model derives owner/generation from a private, owner-managed
binding of the authenticated database `session_user`. Function arguments, custom
GUCs and SET ROLE cannot replace this binding. The model gateway is a private
server principal, NOT a Supabase browser/authenticated/service-role session.
Production JWT-to-owner binding and lifecycle issuance remain unimplemented.

`reserve(operation_id)` generates a new server UUID, rejects a current Note ID
collision, and commits RESERVED identity plus immutable issuance receipt in one
transaction. No caller-selected Note ID or owner is accepted. Repeated operation
IDs return the same historical issuance ID, never renewed publication permission.
UUID issuance is prospective server issuance, not proof/reconstruction of any
pre-enforcement deletion history. No attempt is made to retrofit existing IDs.

## Atomic transitions

- RESERVED -> LIVE: exact owner/generation, current readiness, reservation, strict
  four-field supported payload; plain INSERT + state change + receipt atomically.
- RESERVED or LIVE -> RETIRED: exact owner/generation and matching current Note
  presence, DELETE + terminal identity + receipt atomically.
- RETIRED never becomes RESERVED or LIVE and its owner never changes.
- Replay uses immutable account/operation/identity/kind/payload/digest evidence.
  An old publication replay after retirement reports APPLIED_THEN_RETIRED without
  creating a Note. Retirement acknowledgement requires its exact receipt.
- Unknown IDs, unsupported metadata and conflicting receipts fail closed. Nothing
  is stripped, revision winners are not invented, and existing Notes are not upserted.

Lock order: readiness -> principal binding -> account fence -> transaction-level
reservation-operation advisory lock -> identity -> Note -> receipt. Concurrent
reservation replay serializes before UUID generation. Other operations retain
existing identity-row locking and unique operation/receipt constraints. No network
I/O, automatic retry, or compensation runs inside these transactions.

## Production blockers and compatibility

The database login binding is an isolated enforcement model, not a proposed
per-account production login rollout. Authenticated server integration, deployed
schema/roles, immutable issuance policy, existing active-ID registration, unknown
historical-ID policy, account generation/termination retention, and reset/restore
participation require separate owner approval and evidence. Do not activate any
gate merely because these tests pass.

Current legacy POST, physical DELETE, reset/account-reset, restore/K-323 and direct
INSERT/UPDATE/DELETE remain possible bypasses. Candidate readiness rejects effective
provider-role DML grants; it neither repairs deployed grants nor intercepts live
routes. No historical backfill, account-close API, local ID-generation change or
cloud UI is included. Offline local authoring remains unchanged. A later workflow
cannot publish an existing unproven local ID by rekeying it to this reserved ID.

Rollback means leaving the candidate disconnected. Once separately deployed,
rollback must not remove identity/receipt history or restore bypass permissions.

## Verification boundary

Existing labelled, no-network disposable Docker PostgreSQL tests execute the SQL,
including observed lock barriers and transaction-failure rollback. They require
K323_POSTGRES_INTEGRATION=1; skipped tests are NOT proof of atomicity. The existing
backend-rel05g1 CI already enumerates this test module. No new harness/job is added.
