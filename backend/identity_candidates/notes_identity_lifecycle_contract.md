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

## Inactive private gateway extension (PRIVATE-GATEWAY-01)

`notes_identity_private_gateway.sql` is a SEPARATE unapplied candidate, not a
migration. Its shared login has only private prepare/apply EXECUTE, no Notes or
ledger DML, signing-key read, owner membership or raw lifecycle EXECUTE. No public
RPC/browser grant is provided; production schema exposure must still be verified.

The Notes-only backend signer calls the existing SupabaseJWTVerifier itself. It
never signs a caller's owner or generation. A separate, at-least-32-byte HMAC key
attests exact owner/intent/payload/operation, audience and expiry to PostgreSQL;
the DB login credential alone cannot create this proof. The signer and its key
are a TRUSTED server boundary, not a claim of safety after backend compromise.
Supabase's JWT signing key is not reused. Synthetic key provisioning is test-only.

Prepare verifies that proof and durably captures the ACTIVE DB generation once,
keyed by account/operation. Replays cannot refresh its generation, deadline or
intent, including after A/B/A, expiry or execution failure. Apply verifies a new
short-lived proof of the WHOLE immutable DB context. Existing fence checks run
under locks in the same transaction as identity/Note/receipt changes. The only
temporary login binding is inserted AND deleted inside that verified SQL call;
an exception rolls it back. A transaction-scoped lock serializes calls on the
shared login. No GUC, per-user login, pool-local user state or automatic retry is
used. A new operation is new authenticated intent, not resurrection of an old one.
Both assertion/context deadlines are rechecked after the shared-login lock and
after lifecycle execution, before returning. Expiry during lower-level lock waits
raises and rolls back identity, Note, receipt and temporary binding together.

The Python transport uses fixed parameterized psycopg-3-compatible calls and
acknowledges only after successful transaction AND connection-context exit. It
accepts an injected trusted connection factory; it creates no DSN, credentials,
pool, environment switch or runtime endpoint. Python and SQL both default OFF.
Prepare admission and each apply have separate transactions; all state-changing
identity effects of apply are one transaction. Inert admission rows are retained,
not deleted/refreshed by callers. Retention/rotation are future deployment gates.

The isolated psql tests verify the actual SQL privilege/MAC/JWT-to-assertion path,
including reused/concurrent real connections, not a deployed psycopg/TLS/pool or
Supabase authentication transport. Unit fake-driver tests are NOT DB proof. The
existing verifier does not prove immediate JWT-session revocation; expiry and DB
fence closure/generation changes are the tested denial boundaries. Real Auth
session/account lifecycle integration, production key custody/rotation, direct
connection role/grants/RLS, pgcrypto availability and all earlier legacy-bypass
gates remain unverified. Do not turn readiness flags on because tests pass.
