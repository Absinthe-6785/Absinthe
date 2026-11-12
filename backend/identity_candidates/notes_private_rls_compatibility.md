# Local-only HMAC / private Notes RLS compatibility candidate

Not a migration, production installer, credential provisioner, or activation.
No runtime code imports this SQL. The existing disposable fence test module is
already registered in backend-rel05g1; its new PG17 cases use the same no-network,
no-host-port, tmpfs, labelled-container harness.

## Fixed sequence and prerequisites

1. Separately provision the existing restricted candidate roles. Owner must be
   NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB,
   NOREPLICATION, with no untrusted role able to become it. The trusted postgres
   table-owner executor must be able to SET ROLE to it (a separate provisioning
   prerequisite on managed PostgreSQL, not an assumption of superuser access).
   Owner needs USAGE on
   public before the existing guard creates functions referencing public.notes.
   This candidate provisions no role, password, signing key or account fence.
2. Existing notes_identity_guard.sql (unchanged, default-OFF).
3. New notes_private_rls_compatibility.sql. Requires PG 17.6, postgres executor,
   the observed notes_owner PUBLIC policy, and pgcrypto 1.3 already in extensions.
   It owns one transaction and an ACCESS EXCLUSIVE NOWAIT Notes lock.
4. Existing notes_cloud_identity_mapping.sql.
5. Existing notes_identity_private_gateway.sql.
6. Existing notes_cloud_copy_legacy_write_fence.sql.

All existing SQL sources retain their own transactions. This is NOT a single
atomic full-package installer. An operator must stop on any failure, inventory
what committed, and never drop the schema, ledger, aliases or receipts as an
automatic rollback. The new adapter itself rolls back all its ACL/function/policy
changes on an admission or post-DDL failure. Rerunning it is denied, not an
automatic overwrite. SQL hashes must be re-recorded against the final reviewed
diff before any separately approved publication or production proposal.

## Deliberate authority boundary

- pgcrypto stays in extensions. The private hmac(bytea,bytea,text) wrapper is
  SECURITY INVOKER with fixed pg_catalog search_path and an explicitly qualified
  extension call. Only the private owner receives extensions USAGE and explicit
  execution of that overload. PUBLIC execution on the wrapper is revoked.
- The existing non-login owner already has Notes SELECT/INSERT/DELETE grants,
  but those grants alone cannot pass the deployed JWT-based RLS policy.
- Owner-only global SELECT is deliberate for global existing-ID collision checks,
  retirement conflict checks, and the truncate fence. Account-filtering this read
  would turn another account's existing ID into apparent absence. The private
  login gets NO direct table SELECT/DML and may call only the existing fixed,
  signed prepare/apply entrypoints; these return only the authenticated account's
  exact identity. Admin grants/replacement after installation remain outside
  the candidate's guarantees.
- Owner INSERT/DELETE require the one-invocation principal binding, its current
  ACTIVE account generation, and all existing readiness attestations. They do not
  trust request.jwt.* settings or caller-selected account IDs.
- Permissive policies admit that scope; matching restrictive policies prevent the
  existing PUBLIC policy's OR semantics from bypassing it with forged JWT GUCs.
  Owner UPDATE is restrictively denied. No BYPASSRLS or Notes ownership changes.
- The existing PUBLIC policy, provider privileges, note_folders and local Notes
  authority are untouched. Existing Notes are not registered, rekeyed or adopted.
- Default-OFF remains: readiness false, cloud-copy readiness false, private gateway
  false with no key/bindings. Synthetic positive tests attest/enable only inside
  their disposable database, not in this artifact.

The relation lock does not serialize role/extension catalogs. Any future install
also requires an operator-controlled window with no competing privileged
role/grant/extension/DDL changes.

## Proof and remaining gates

The PG17 test models RLS-enabled Notes plus the observed auth.uid() behavior,
extensions placement and FK cascade. It exercises installation rejection/atomicity,
HMAC byte equivalence, legacy CRUD/RLS, global foreign-ID collision rejection,
signed Cloud Copy/readback/retirement, cross-account and stale-generation denial,
forged JWT policy attempts, and retained retirement history.

The intentionally unsafe policy-probe function exists ONLY inside the disposable
test and is removed there; it is not an installation artifact or an auth adapter.

Execution results must be reported separately. Collection or static assertions are
not PostgreSQL proof. No Docker install/host port/production DSN is accepted.
Production operator approval, real exact-sequence PG17 proof, current schema and
role admission, runtime isolation, reset/restore and account-termination contracts,
credentials, deployment and activation remain separate gates. The existing fence
is always-enabled and denies non-READ-COMMITTED writes even while readiness is
false; default-OFF must never be described as installation-inert.
