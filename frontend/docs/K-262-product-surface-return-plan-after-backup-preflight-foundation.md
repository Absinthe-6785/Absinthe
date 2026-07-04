# K-262 Product Surface Return Plan after Backup Preflight Foundation

Status: product/UI planning.

Scope: docs/plan plus audit test only.

Risk: Low.

K-262 plans the return from backup/preflight internals to product/UI surface work. K-262 makes no runtime behavior changes, does not implement UI, does not add routes, does not change Notes/Cosmos runtime behavior, and does not change backup/export/import/restore runtime behavior.

## Starting Point

K-235 through K-261 safely closed the local backup/preflight diagnostic foundation.

The completed safety foundation includes:

- local-first backup/restore boundary.
- manifest generator/validator foundation.
- output-neutral export diagnostic hook.
- redacted diagnostic harness.
- backupKind and scopeLevel redaction.
- dev/test-only preflight diagnostic harness.
- export-adjacent metadata adapter.
- preflight foundation closure decision.

K-261 decided:

- backup/preflight foundation is stable enough to pause.
- production export preflight runtime is deferred.
- export blocking is deferred.
- restore preview/dry-run is deferred.
- attachment blob backup is deferred.
- provider-aware recovery is deferred.
- Data Safety / Backup Health UI is deferred.
- product/UI surface return is recommended.

## Product Surface Return Decision

The next direction is product/UI surface planning, not deeper backup runtime wiring.

K-262 does not begin runtime implementation. It selects the safer product planning path after the backup/preflight foundation and carries the backup safety guardrails forward into future product work.

## Recommended Product/UI Direction

Recommended next product/UI line:

- Notes/Cosmos surface planning.
- Cosmos navigation and visual grammar planning.
- product surface information architecture.
- Pixel/Cosmos design grammar carry-forward.

This remains planning only. K-262 does not change runtime UI, Notes/Cosmos behavior, navigation, routes, panels, storage, backup runtime, or import/restore behavior.

The planning line should decide:

- which product surface to improve first.
- what user-facing concept should be visible.
- how Cosmos/pixel grammar should be applied.
- what remains static preview vs runtime.
- what implementation milestone should follow.

## Backup Guardrails Carry-forward

Product/UI work must preserve:

- local-first source of truth.
- no destructive whole-vault restore as default.
- no raw token/secret/content/blob leakage.
- no silent provider/blob behavior changes.
- no ZIP/manifest/export shape changes without explicit migration plan.
- no production preflight blocking without explicit UX/product plan.
- no restore/import behavior changes without dry-run/preview plan.
- no Data Safety UI claims before separate plan.
- no backup safety claims that exceed implemented behavior.

## Product/UI Non-goals

K-262 does not implement:

- runtime UI.
- routes.
- Notes/Cosmos navigation changes.
- Notes/Cosmos runtime behavior changes.
- panels.
- backup UI.
- Data Safety / Backup Health UI.
- production preflight wiring.
- export/import/restore behavior.
- provider/blob behavior.
- persistence/network behavior.
- stores.
- schemas.
- providers.
- package.json changes.
- Vite config changes.

## Deferred Backup Lines

The following remain deferred and require separate plans before implementation:

- production export preflight runtime wiring.
- export blocking.
- Data Safety / Backup Health UI.
- restore preview/dry-run.
- import/restore validation.
- restore blocking.
- attachment blob backup.
- provider-aware recovery.
- `attachmentMetadataOnly` warning escalation.

## Source Boundary Confirmation

K-262 must not be referenced from:

- `exportVaultBackup`.
- `vaultBackupZip`.
- `importVaultBackup`.
- `vaultRestorePipeline`.
- `localBackupExportAdjacentPreflightTestHarness`.
- `localBackupExportPreflightDiagnosticTestHarness`.

K-262 does not wire any product planning text into runtime code.

## K-263 Recommendation

Recommended next milestone:

K-263: Notes/Cosmos Product Surface Planning after Backup Foundation.

K-263 should remain docs/plan only unless explicitly approved.

K-263 should decide:

- which surface to improve first.
- what user-facing concept should be visible.
- how Cosmos/pixel grammar should be applied.
- what remains static preview vs runtime.
- what implementation milestone should follow.

K-263 should be product/UI planning, not backup runtime wiring.

## Closure Statement

K-262 returns the workstream from backup/preflight foundation building to product/UI planning.

The backup/preflight foundation remains intact and paused. Production export preflight, Data Safety UI, restore preview/dry-run, attachment blob backup, provider-aware recovery, and warning escalation remain deferred to separate future lines.

The next safe step is product/UI planning with backup guardrails carried forward.
