# Single-Note exact-ID contract — inactive local candidate

This optional boundary reuses the existing identity guard, its account-generation
and readiness checks, immutable identities/receipts, atomic plain INSERT and
retirement. It adds no tables, issuer, historical adoption, migration, runtime
route, credentials, feature flag or production permission change. The six-file
pilot installation package and its reviewed artifacts are unchanged.

## Admission and outcome

- Only a current trusted account principal with **both** a matching server-issued
  identity and its valid reserve receipt may publish. Unknown IDs (including an
  absent remote row or a legacy laptop ID without that evidence) remain denied.
  A new ledger cannot retrospectively prove that an ID was never deleted.
- `publish_single_note(owner, generation, id, operation, payload)` reuses one
  transaction for identity locking, the existing validated four-field text
  payload, plain INSERT, immutable receipt and exact readback. Existing-ID
  conflicts never become an UPDATE. An identical operation may return a no-write
  replay; changed intent or another operation cannot overwrite the Note.
- The function response is **not a commit receipt**. Its
  `requires_post_commit_readback=true` must not be represented as durable success.
  A future authorized adapter must finish the transaction and then call
  `read_single_note` in a fresh transaction with current authentication, the same
  exact ID, operation and expected payload. That read verifies owner, generation,
  reserve/publication receipts, active state and the exact stored content.
- Lost dispatch/commit responses are indeterminate; there is no automatic retry.
  Only the explicit readback can resolve the observed result. Failed/unavailable
  readback cannot be reported as successful publication. Retirement after a
  completed read can still change remote availability; no continuous guarantee.
- Existing retirement is terminal. Even exact publication replay after retirement
  is denied here. Ledger/receipt deletion, backfill and destructive rollback are
  not supplied. Preserve the original local Note, ID and content independently.

## Default-OFF and proof limits

The SQL is outside migrations and not imported or called by the application. It
does not enable any readiness attestation or Cloud Copy. Run it only in the
existing disposable identity harness after `notes_identity_guard.sql`. The base
model requires blanket denial of unguarded DML; a deployed alternative would need
the separately reviewed fence and trusted binding, not client-side preflight.
Modeled principals are **not** proof of deployed Supabase authentication/RLS.
Tests must never accept a production DSN, host port, host volume or user content.

Existing laptop IDs are not made eligible by this change. Before any real Note
publication: independently establish trusted issuance/provenance, local durable
preflight, deployment enforcement, post-commit authenticated readback and explicit
owner approvals for integration/installation/activation. If provenance cannot be
proved, keep that Note denied. This is neither general sync nor a complete backup.
