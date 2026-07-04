# K-261 Local Backup Preflight Line Closure and Product Surface Return Decision

Status: decision / closure.

Scope: docs/decision plus audit test only.

Risk: Low.

K-261 closes the K-235 through K-260 local backup/preflight diagnostic foundation line. K-261 makes no runtime behavior changes. Production export preflight runtime wiring is deferred. The recommended next direction is returning to product/UI surface work while preserving the backup/preflight safety guardrails.

## Decision

- The backup/preflight diagnostic foundation is complete enough to pause.
- Production export preflight runtime wiring is deferred.
- User-facing backup health/data safety UI is deferred to a separate future line.
- Restore preview/dry-run is deferred to a separate future line.
- Attachment blob backup is deferred to a separate future line.
- Provider-aware recovery is deferred to a separate future line.
- `attachmentMetadataOnly` warning escalation, if desired, is deferred to a separately scoped future line.
- The next recommended direction is product/UI surface work, not backup runtime wiring.

## Completed Line Summary

K-235 through K-260 now form the completed local backup/preflight diagnostic foundation.

### Boundary/spec foundation

- K-235 defined local-first backup/restore boundaries.
- K-236 defined the local-first backup manifest spec.
- K-237 added the manifest audit fixture spec.
- K-238 added the manifest generator/validator prototype with privacy/security validation.
- K-239 audited the manifest integration boundary.
- K-240 planned export integration.

### Export diagnostic hook

- K-241 added the output-neutral export diagnostic helper.
- K-242 closed the export diagnostic wiring boundary.
- K-243 planned the export diagnostic hook.
- K-244 added the output-neutral export diagnostic hook.
- K-245 closed the hook.

### Diagnostic visibility/harness

- K-246 planned diagnostic visibility.
- K-247 planned the diagnostic harness.
- K-248 added the redacted diagnostic harness prototype.
- K-249 closed K-248.
- K-250 planned the harness integration boundary.
- K-251 added scopeLevel redaction.
- K-252 closed scopeLevel redaction.
- K-253 closed the K-248 through K-252 hardening line.

### Export preflight planning/prototype

- K-254 planned the export preflight diagnostic boundary.
- K-255 planned the export preflight diagnostic test harness.
- K-256 added the pure dev/test-only preflight diagnostic harness.
- K-257 closed K-256.

### Export-adjacent preflight adapter

- K-258 planned the export-adjacent preflight integration boundary.
- K-259 added the pure test/dev-only export-adjacent metadata fixture adapter.
- K-260 closed K-259 and documented `attachmentMetadataOnly` as informational current behavior.

## Current Capability

Absinthe now has:

- local-first backup/restore boundary documentation.
- manifest generator/validator foundation.
- output-neutral export diagnostic hook.
- redacted diagnostic summary harness.
- backupKind and scopeLevel redaction.
- dev/test-only preflight diagnostic harness.
- export-adjacent metadata fixture adapter.
- source/import boundary audit coverage.
- no raw value leakage policy.
- no production runtime wiring.

## Explicit Non-goals

K-261 does not implement:

- production export preflight runtime wiring.
- export blocking.
- user-facing UI.
- console logging.
- default log writing.
- ZIP sidecar.
- `manifest.json` mutation.
- export result shape change.
- import/restore validation.
- restore preview/dry-run.
- restore blocking.
- attachment blob backup.
- provider-aware recovery.
- Supabase/Google Drive/OAuth behavior.
- persistence/network/blob behavior.
- store/schema/provider/runtime UI changes.
- package.json or Vite config changes.

## Deferred Future Lines

Each future line requires a separate plan before implementation.

### Production export preflight runtime wiring

Production export preflight runtime wiring is deferred. It must not be introduced without a separate UX/product plan, runtime plan, and migration/output-neutrality review.

### Restore preview / dry-run safety

Restore preview/dry-run safety is deferred. Import/restore behavior must not change without a separate dry-run/preview plan.

### Attachment blob backup policy

Attachment blob backup is deferred. Blob backup requires a separate policy for scope, storage, privacy, size, restore behavior, and provider boundaries.

### Data Safety / Backup Health UI

User-facing Data Safety / Backup Health UI is deferred. Any new UI that references backup safety must remain informational unless separately scoped.

### Provider-aware recovery

Provider-aware recovery is deferred. Supabase, Google Drive, OAuth, and provider session behavior must not change without a separate plan.

### attachmentMetadataOnly warning escalation

`attachmentMetadataOnly` warning escalation is deferred. The current behavior remains informational. Any future change that makes it warning-producing must be separately scoped and tested.

## Product Surface Return Decision

The backup/preflight safety foundation is stable enough to pause.

The recommended next direction is product/UI surface work. Product/UI work must not weaken backup/preflight guardrails. Any new UI that references backup safety must remain informational unless separately scoped.

Product surface work should favor existing Absinthe priorities:

- content-first workspace flow.
- calm desktop-first surfaces.
- Notes/Cosmos clarity.
- Health/Schedule/Archive/Settings polish where needed.
- no backup runtime expansion unless explicitly planned.

## Safety Guardrail Carry-forward

Future work must preserve:

- local-first source of truth.
- no destructive whole-vault restore as default.
- no raw token/secret/content/blob leakage.
- no silent provider/blob behavior changes.
- no ZIP/manifest/export shape changes without explicit migration plan.
- no production preflight blocking without explicit UX/product plan.
- no restore/import behavior changes without dry-run/preview plan.
- no user-facing backup safety claims that exceed implemented behavior.
- no provider-aware recovery claims without explicit provider/recovery plan.

## Runtime Boundary Confirmation

K-261 does not:

- call `exportVaultBackup`.
- call ZIP writers.
- call `importVaultBackup`.
- call `vaultRestorePipeline`.
- call the K-256 preflight harness from export runtime.
- call the K-259 export-adjacent adapter from export runtime.
- read/write localStorage.
- read/write IndexedDB.
- call fetch/network/provider APIs.
- read attachment blob payloads.
- expose diagnostics to UI/logs/ZIP/manifest/export result/import/restore.

## K-262 Recommendation

Recommended next milestone:

K-262: Product Surface Return Plan after Backup Preflight Foundation.

Alternative:

K-262: Notes/Cosmos Product Surface Planning after Backup Preflight Closure.

K-262 should be product/UI-focused, not backup runtime wiring. K-262 should be docs/plan only unless explicitly approved.

## Closure Statement

K-261 closes the K-235 through K-260 backup/preflight diagnostic foundation line.

The foundation is now complete enough to pause: boundary documentation exists, manifest validation exists, output-neutral diagnostic hooks exist, redacted diagnostic harnesses exist, preflight remains dev/test-only, export-adjacent metadata remains test/dev-only, and production runtime wiring remains deferred.

Future backup runtime, restore preview, attachment blob backup, provider-aware recovery, and Data Safety UI work must be planned separately. Product/UI surface work can resume while carrying these safety guardrails forward.
