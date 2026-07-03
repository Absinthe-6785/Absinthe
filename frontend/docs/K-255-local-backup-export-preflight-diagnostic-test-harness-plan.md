# K-255 Local Backup Export Preflight Diagnostic Test Harness Plan

K-255 plans a dev/test-only export preflight diagnostic test harness.

K-255 is docs/plan plus audit test only. K-255 does not implement the harness, does not wire anything into production export runtime, does not expose diagnostics, does not change UI/logging/ZIP/manifest/export/import/restore behavior, and chooses the K-256 next path.

## Purpose

- K-255 plans a dev/test-only export preflight diagnostic test harness.
- K-255 is docs/plan plus audit test only.
- K-255 does not implement the harness.
- K-255 does not wire anything into production export runtime.
- K-255 does not expose diagnostics.
- K-255 does not add UI/logging implementation.
- K-255 does not change ZIP output.
- K-255 does not change `manifest.json`.
- K-255 does not add sidecar output.
- K-255 does not change export result shape.
- K-255 does not change import/restore validation.
- K-255 chooses the K-256 next path.

## Current State Summary

- K-244 output-neutral export diagnostic hook exists.
- K-245 closed the hook.
- K-248 diagnostic harness/helper exists.
- K-249 closed backupKind redaction.
- K-251 hardened scopeLevel.
- K-252 closed scopeLevel redaction.
- K-253 closed consolidated harness hardening.
- K-254 selected dev/test-only preflight first.
- Diagnostic harness summary is redacted category/count-only.
- backupKind is `diagnostic-manifest` / `core-data` / `unknown`.
- scopeLevel is numeric `0` / `1` / `unknown`.
- Level 2 / 3 / 4 remain unsupported.
- Diagnostic result is not shown in UI.
- Diagnostic result is not logged.
- Diagnostic result is not written to ZIP.
- Diagnostic result is not written to `manifest.json`.
- Diagnostic result is not sidecar output.
- Diagnostic result is not returned in export result shape.
- Diagnostic result is not connected to import/restore validation.
- Local runtime data remains source of truth.
- Remote systems remain support layers.

## Harness Definition

The planned harness is a dev/test-only preflight diagnostic wrapper around the existing redacted diagnostic summary helper.

It accepts synthetic or export-adjacent metadata input. It returns an ephemeral redacted status object. It computes pass / warning / hard-failure status.

It does not write files. It does not create ZIPs. It does not mutate export payloads. It does not call production export runtime automatically. It does not change import/restore. It does not perform network/provider/blob work. It does not imply full backup/restore safety.

## Harness Input Plan

### Option A: Synthetic fixture input

- safest.
- uses deterministic test fixtures.
- no production export data.
- ideal first prototype.

### Option B: Export-adjacent metadata object

- may mirror current manifest/count metadata.
- must be passed explicitly from tests.
- no automatic export runtime call.
- useful for future parity.

### Option C: Direct production export payload

- not recommended.
- too close to artifact mutation risk.

### Option D: Live local runtime data

- not recommended.
- risks persistence and privacy surface.

Chosen input:

- Prefer Option A first.
- Allow Option B only as explicitly constructed test input.
- Do not use Option C or D in K-256.

## Harness Output Plan

The planned redacted output shape:

- status: `"pass" | "warning" | "hard-fail"`
- summary:
  - backupKind: `"diagnostic-manifest" | "core-data" | "unknown"`
  - scopeLevel: `0 | 1 | "unknown"`
  - domainCounts: redacted count-only fields if available
- hardFailures: array of category-only codes
- warnings: array of category-only codes
- metadata:
  - generatedFor: `"test-harness"`
  - persisted: `false`
  - artifactWritten: `false`
  - exportRuntimeWired: `false`

Rules:

- no raw messages.
- no raw note content.
- no raw attachment content.
- no raw manifest JSON.
- no raw backupKind unknown values.
- no raw scopeLevel malformed values.
- no paths/stacks.
- no tokens/secrets.
- no provider credentials.

## Status Decision Plan

Pass:

- no hard failures.
- no warnings or only explicitly accepted non-blocking warnings.

Warning:

- no hard failures.
- one or more warning categories.

Hard-fail:

- privacy/security/scope escalation categories only.

Hard-fail categories:

- credentials/tokens/secrets detected.
- `destructiveWholeVaultReplaceAllowed` true.
- invalid backupKind/scopeLevel.
- unsupported Level 2/3/4 escalation.
- raw blob payload embedded.
- generated/dev-test artifacts included.
- unsafe override escalation.
- raw backupKind/scopeLevel echo regression.

Warnings:

- checksums not computed.
- optional domain gaps.
- attachment blob payload not included under diagnostic/core-data scope.
- provider metadata unresolved.
- schema/app version unknown.
- domain counts incomplete.
- Level 3/4 not supported.
- provider-aware recovery not supported.

## Lifecycle and Storage Plan

- harness result is ephemeral.
- not persisted to IndexedDB.
- not persisted to localStorage.
- not written to files.
- not logged.
- not written to ZIP.
- not written to `manifest.json`.
- not written as sidecar.
- not returned from production export.
- not stored in app state.
- may exist only in test memory or explicit dev/test harness return value.

## Output-Neutrality Plan

- no ZIP output change.
- no `manifest.json` change.
- no sidecar.
- no export result shape change.
- no export payload mutation.
- no import/restore behavior change.
- no persistence mutation.
- no network/provider/blob behavior.
- no UI/logging.

## Relationship to Existing Export Hook

- K-244 export diagnostic hook remains output-neutral and internal/ignored.
- K-255 harness plan does not change K-244 hook.
- K-256 harness, if implemented, should not automatically call production export runtime.
- The harness may reuse the same diagnostic summary helper, not duplicate redaction logic.
- Production export preflight remains future work requiring separate approval.

## Relationship to Import/Restore

- no import/restore validation in K-256.
- no restore preview changes.
- no restore blocking.
- no restore mutation.
- `importVaultBackup` remains unchanged.
- `vaultRestorePipeline` remains unchanged.
- `backupBeforeRestore` remains unchanged.
- per-item `skip`, `duplicate`, and `replace` remains distinct from destructive whole-vault restore.

## Attachment/Provider Boundary

- no attachment blob export claim.
- no Level 3 support claim.
- no `full-content-with-blobs` support claim.
- no `provider-aware-recovery` support claim.
- no blob movement/copy/upload/download.
- no attachment sync change.
- no Supabase behavior change.
- no Google Drive/OAuth behavior change.
- Google Drive appDataFolder QA remains separate and externally blocked.
- no Google Drive QA work.

## Test Plan for K-256

Expected K-256 prototype tests:

- synthetic pass fixture returns status pass.
- synthetic warning fixture returns warning with category-only warning codes.
- synthetic hard-fail fixture returns hard-fail with category-only hard failure codes.
- backupKind diagnostic-manifest/core-data pass through.
- backupKind future/adversarial values become unknown.
- scopeLevel 0/1 pass through.
- scopeLevel string `"0"` / `"1"`, 2 / 3 / 4, malformed values become unknown.
- raw values absent from stringified harness output.
- no ZIP entries created.
- no `manifest.json` written.
- no sidecar created.
- no export result shape change.
- no import/restore function imported.
- no fetch/network/localStorage/indexedDB calls.
- no Supabase/GoogleDrive/OAuth imports.
- no UI/logging imports.

## K-256 Recommendation

Recommended next milestone:

K-256 Local Backup Export Preflight Diagnostic Test Harness Prototype

Scope:

- pure/dev-test-only implementation.
- synthetic fixture input first.
- explicit test-only output.
- no production export runtime wiring.
- no UI/logging.
- no ZIP/manifest/sidecar/export-shape changes.
- no import/restore validation.
- requires Codex 5.5 high.

Alternatives:

- K-256 Local Backup Export Preflight Diagnostic Harness Plan Closure Audit, docs/audit only, if implementation should be delayed.
- K-256 Local Backup Export Preflight Diagnostic Test Fixture Spec, docs/spec plus test fixture only, if fixture/input shape needs one more lock before prototype.

Not recommended yet:

- production export preflight.
- user-facing UI.
- logging/console output.
- export result metadata.
- ZIP sidecar.
- `manifest.json` extension.
- import/restore validation.

## Non-Goals

- no preflight harness implementation in K-255.
- no production export runtime wiring.
- no helper behavior change.
- no diagnostic exposure.
- no UI implementation.
- no developer console/logging implementation.
- no export result shape change.
- no public API change.
- no ZIP output change.
- no `manifest.json` replacement/change.
- no local-first diagnostic written to ZIP.
- no ZIP sidecar.
- no `VaultBackupManifest` type change.
- no backup/export payload changes.
- no restore/import validation.
- no restore/import mutation.
- no `importVaultBackup` change.
- no `vaultRestorePipeline` change.
- no `backupBeforeRestore` change.
- no schema migration.
- no IndexedDB migration.
- no Supabase sync changes.
- no Google Drive changes.
- no OAuth changes.
- no attachment remote upload/recovery changes.
- no attachment blob movement.
- no background sync/upload.
- no auto backup.
- no destructive whole-vault restore.
- no conflict resolver.
- no route/navigation changes.
- no Health/Schedule behavior changes.
- no Notes/Cosmos changes.
- no assets/fonts/dependencies.
- no Google Drive QA work.

## Closure Statement

K-255 plans a dev/test-only preflight diagnostic harness but does not implement it.

The first harness should use synthetic fixture input and explicit test-only output. Diagnostics remain unexposed to UI/logs/ZIP/manifest/export result/import/restore. Output-neutrality, no-raw-value policy, and local-first boundaries remain required.

Any future production preflight, UI, visibility, or artifact evolution requires a separate milestone. Local runtime data remains source of truth. Remote systems remain support layers.
