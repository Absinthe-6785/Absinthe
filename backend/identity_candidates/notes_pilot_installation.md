# Default-OFF single-Note pilot installation handoff

Local candidate only. No runtime/migration loads these files. This is not approval
to install, deploy, issue credentials, enable Cloud Copy, or accept legacy IDs.
Base: `255136b885367d894f2c6c179d89761221ce2587`.

## Immutable sequence

SHA-256 over UTF-8 text with LF line endings (the Python read_text digest used by
the existing tests). Verify every artifact against the reviewed manifest before
execution. Do not regenerate, combine, or edit SQL at execution time.

| Order / file in this directory | SHA-256 |
|---|---|
| 0 notes_pilot_role_provisioning.sql | 8b3d5c8619c40c3474c35c3eca878b3eecd2ba5175956f1a30179d5dbb2dfd0c |
| 1 notes_identity_guard.sql | c857cbf826e09e22507316f61ce4f8957458a3d996b469376a418144d619a36e |
| 2 notes_private_rls_compatibility.sql | d07ff1bce8fc4ba727688cc9ad28e602c798ff6f8787b0936e0d8b966e29b5a1 |
| 3 notes_cloud_identity_mapping.sql | 681bf1ae1a1c9db9d89f73ec30598d2b051e17757e8351b52f9dbaa47b281ec4 |
| 4 notes_identity_private_gateway.sql | 5036ded852d72582c3341823cba4c562e184d7e461c26cb4ea55d514e993c68e |
| 5 notes_cloud_copy_legacy_write_fence.sql | 3d6fa2fb70c6b28fa3765cbd353c9b12db1f6400debd0830ad05a9bdac40fcf7 |

The five existing implementations are unchanged. Step 0 creates four restricted
roles, grants only public schema USAGE to the non-login owner and explicit
INHERIT/SET membership to the trusted postgres installer. The existing SQL reads
the private schema before SET ROLE; granting SET alone is insufficient. No provider grants
are changed. The three other roles are not owner members; gateway/app are NOLOGIN.
Private gateway is LOGIN, password NULL, CONNECTION LIMIT 0. Merely installing
does not permit even trust/certificate-authenticated private connections.
Creating roles as non-superuser CREATEROLE also creates postgres ADMIN membership
edges; only this trusted installer may hold them. No client/provider member is
allowed. A later DBA can change these protections; hostile DBA actions are not
covered by this package.

## Exact separately approvable operation

Target only the operator-confirmed `fhaozlbrmyrzkrlysvmp`, as trusted postgres with
CREATEROLE, database CREATE, public.notes ownership and the ability to SET the
new owner. No new credentials or broader role delegation are part of installation.
Require a controlled window with no other privileged role/grant/extension/DDL
changes. Verify current PG17.6, pgcrypto1.3/extensions, expected public.notes
columns/constraints/RLS/notes_owner policy, provider TRIGGER revocation and no
candidate roles/schema. Existing provider event-trigger dependencies and DDL
permissions must still match the prior approved catalog evidence; stop on drift.

Run each exact file once, in order, via a fresh postgres session using psql -X
and ON_ERROR_STOP=1. Preserve original transaction boundaries. Stop on the first
nonzero exit. Do not continue after an error or blindly replay a successful step.
This is six transactions, NOT an atomic package. A failed transaction rolls back
only itself; earlier committed steps remain. Read-only inventory must establish
the committed prefix before any separately approved continuation. Never drop
roles/schema, ledger, aliases, contexts, receipts or retirement history to undo
an installation. No automatic compensating GRANT or destructive rollback exists.

Expected catalog delta: four roles/memberships and owner schema USAGE; private
identity schema/tables/functions; compatibility HMAC grants/wrapper and six owner
RLS policies; mapping/private RPCs; always-enabled Notes/history/permit triggers.
No Note rows/IDs, folders, existing PUBLIC policy or provider DML ACL are changed.
The compatibility step locks Notes ACCESS EXCLUSIVE NOWAIT. Other DDL may take
relation/catalog locks: use an operator-approved bounded lock/statement timeout
and treat any timeout as failure, not an instruction to bypass admission.

## Mandatory default-OFF postconditions

Read-only catalog/config checks must show all readiness attestations false;
cloud_copy_readiness.enabled false; private_gateway_config.enabled false and
signing_key NULL; zero account fences, principal bindings, identities, aliases,
receipts, private contexts and permits in this initially absent installation.
Owner remains NOLOGIN/NOBYPASSRLS/NOSUPERUSER; private login limit stays 0 with no
password; no untrusted owner membership; no direct Notes DML for candidate app,
model gateway or private-login session roles (the internal NOLOGIN owner is the
intentional exception); no client direct private-table DML; and only the two
signed private RPC entrypoints executable by private login. Existing provider
Notes DML ACLs remain unchanged; protected-ID writes are fenced, not authorized
merely by those legacy grants.
Verify all ten expected ALWAYS triggers, unchanged original Notes/folder data
and provider CRUD/RLS. Do not query personal bodies to prove catalog readiness.

**Default-OFF is not installation-inert.** The fence immediately denies all
non-READ-COMMITTED Notes writes, even unregistered legacy rows. In READ COMMITTED,
unregistered legacy CRUD stays unchanged; protected IDs require signed one-shot
permits. Installation therefore requires the operator to confirm actual legacy
writers' isolation/DDL compatibility. No claim covers unobserved external writers.

## Activation remains blocked and separately approvable

- Do not set readiness true to make a demo work. Account generation/termination,
  reset/restore compatibility and durable identity retention decisions remain
  unapproved; the package deliberately cannot infer them for a personal pilot.
- A LIVE protected copy denies Auth cascade deletion rather than retiring it.
  This isolated denial is not a complete account erasure/retention policy.
- No historical ID adoption/backfill, arbitrary local-ID publication or automatic
  receiving is permitted. Local noteId stays separate from new server cloudNoteId.
- Credentials/key provisioning, restricted runtime transport/project binding,
  TLS, deployed roles/RLS/fence verification, feature flags and actual laptop/mobile
  QA require separate approvals. No production sync or automatic upload exists.

Next approval, only after review and real SQL proof: authorize this exact six-file
default-OFF installation in the stated window with its read-only pre/post checks,
not connection opening, secrets, deployment or activation. If writer isolation or
current catalog cannot be confirmed, remain blocked; do not modify the package.
