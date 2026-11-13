# Laptop initial adoption — unapplied local contract

This owner-approved exception permits an explicitly approved historical local ID,
not arbitrary historical publication. It does **not** prove that an absent ID
was never remotely deleted. Known deleted/retired IDs remain excluded globally.
No production database, API, frontend, six-file installation manifest, credentials
or feature flags are changed. Cloud Copy and automatic synchronization stay OFF.

## Minimal additive boundary

In the existing disposable identity harness only, apply
notes_laptop_initial_adoption.sql after notes_identity_guard.sql.
The extension reuses existing account/principal/generation/readiness checks,
the global identity PK, plain INSERT, immutable receipts and terminal retirement.
It adds one immutable per-ID approval table and a receipt trigger.
The six-SQL installation is neither started nor replaced with a new gateway.

Only the private model owner can call approve_laptop_adoption. It must supply:

- Exact current account, generation, existing laptop ID and operation ID.
- Exact supported text payload, a capture-manifest SHA-256, and explicit
  OWNER_APPROVED_HISTORICAL_ADOPTION acknowledgement.
- Complete known-deleted-ID set (bounded to 500; malformed/duplicate IDs denied).
- Current durable local, complete active Note, no pending mutations and no
  dependency attestations. These are **trusted operator assertions**, not SQL
  verification of local IndexedDB. They must come from existing local
  preflight, source fencing and deletion capture in any future integration.
- A deadline no more than 24 hours away; source changes require fresh
  preflight/approval, never reuse of an old payload or automatic reapproval.

The approval transaction locks IDs in stable order, records known deleted IDs
in the immutable RETIRED ledger, rejects every existing target identity or
remote row (including tombstones/foreign rows), then records a RESERVED
identity and immutable approval. No server-issuance reserve receipt is fabricated.
No existing Note is updated, retired, adopted or deleted by approval. A conflict
rolls back the entire approval, including newly recorded deletion markers.

The caller cannot invoke approval or edit its table. Publication accepts only
the exact approved intent; the receipt trigger also guards the low-level
publication primitive against changed payload, operation, stale generation and
expired first dispatch. Existing lifecycle retirement remains irreversible.
The base deny-unguarded-DML gate must continue to pass: legacy deletion, reset,
restore, direct DML or privilege bypass are **not** safe merely because this
extension exists. No installed compatibility is claimed.

## Eligibility and outcomes

- Already matching remote Notes: no approval or write.
- Known deleted IDs, current/retired/reserved remote identities: blocked.
- Attachments/embeds, explicit Wiki references, metadata/relationships, folders,
  oversized text, missing durable/source/deletion proof: blocked in this first
  text-only scope. Never strip dependencies to make a Note eligible.
- Unknown-history laptop IDs: only the explicit, exact owner-approved exception.
  Source IDs and authored text are not regenerated, title-matched or normalized.

publish_laptop_note returns requires_post_commit_readback=true, not durable
success. A future adapter must finish the transaction, then call
read_laptop_publication in a fresh transaction with live authentication, exact
ID, operation, approved payload and generation. Readback checks the current
LIVE identity, immutable receipt and actual owner/content/dependency fields.
An exact explicit replay is no-write; retirement rejects replays. A lost write
or commit response is indeterminate: no automatic retry. Only manual readback
may establish the observed result; unavailable readback is never success.

## Verification and separate approvals

The suite uses the existing labelled disposable PostgreSQL container with
network none, tmpfs, no host volumes/ports and synthetic accounts. It uses the
existing K323_POSTGRES_INTEGRATION=1 job; skipped SQL tests are not PASS.
Mocked/static results do not establish PostgreSQL or production behavior.

This is a storage-contract candidate, not the initial-publication UI. A future
integration requires separate approval for a trusted per-account approval path,
durable local/deletion capture, session/source invalidation, production role/RLS
and legacy-writer enforcement, plus isolated SQL evidence and independent review.
Production schema installation, activation and publishing even one real Note
each require explicit approval. Do not automatically delete ledger/approval/
receipt evidence or regrant legacy write authority as a rollback.
