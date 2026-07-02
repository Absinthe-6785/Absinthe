# K-250 Local Backup Manifest Diagnostic Harness Integration Boundary Plan

K-250 plans diagnostic harness integration boundaries. K-250 is docs/plan plus audit test only.

K-250 does not integrate the helper anywhere, does not change helper behavior, does not expose diagnostics, does not change UI/logging/ZIP/manifest/export/import/restore behavior, and chooses the K-251 next path.

## Purpose

- K-250 plans diagnostic harness integration boundaries.
- K-250 is docs/plan plus audit test only.
- K-250 does not integrate the helper anywhere.
- K-250 does not change helper behavior.
- K-250 does not expose diagnostics.
- K-250 does not add UI/logging implementation.
- K-250 does not change ZIP output.
- K-250 does not change `manifest.json`.
- K-250 does not add sidecar output.
- K-250 does not change export result shape.
- K-250 does not change import/restore validation.
- K-250 chooses K-251 next path.

## Current State Summary

- K-248 diagnostic harness/helper exists.
- K-248 backupKind redaction patch is merged.
- K-249 closure audit is complete.
- The helper remains pure/isolated.
- Diagnostic summary is not runtime-wired.
- Diagnostic summary is not shown in UI.
- Diagnostic summary is not logged.
- Diagnostic summary is not written to ZIP.
- Diagnostic summary is not written to `manifest.json`.
- Diagnostic summary is not sidecar output.
- Diagnostic summary is not returned in export result shape.
- Diagnostic summary is not connected to import/restore validation.
- Local runtime data remains source of truth.
- Remote systems remain support layers.

## Current Helper Contract

- backupKind allowlist:
  - `diagnostic-manifest`
  - `core-data`
- unknown/future/adversarial backupKind becomes `unknown`.
- raw backupKind echo path is closed.
- `scopeSummary.backupKind` may be always present as `diagnostic-manifest | core-data | unknown`.
- helper remains pure/isolated.
- no UI/logging/ZIP/manifest/export/import/restore exposure exists.

## scopeLevel Boundary Question

`scopeLevel` appears in summary today.

K-249 did not block on it. K-250 decides that `scopeLevel` should be hardened before broader integration.

### Option A: Keep Current scopeLevel Behavior Until Future Integration

- lowest immediate change.
- acceptable if helper remains test-only/internal.
- risk: future summary consumers may over-trust raw or unexpected scopeLevel.

### Option B: Plan A K-251 scopeLevel Sanitizer Patch

- scopeLevel must be number-only.
- allowed values should be 0 and 1 for current harness.
- future levels 2/3/4 should summarize as `unknown` or hard-fail, matching current non-claim stance.
- malformed/non-number/string/object values should summarize as `unknown`.
- recommended before any broader integration.

### Option C: Treat scopeLevel As Validation-Only And Remove It From Public Summary Later

- avoids surface.
- may reduce diagnostic usefulness.
- requires helper behavior change in a future patch.

Recommendation: prefer K-251 scopeLevel sanitizer patch before any integration or visibility.

## Integration Surface Options

### Option A: Keep Harness Test-Only/Internal

- no runtime exposure.
- no UI/logging/export artifact changes.
- safest.

### Option B: Dev/Test-Only Diagnostic API

- helper can be called from tests or developer-only harness.
- no production UI.
- no ZIP/manifest output.
- no export result shape change.
- requires redaction/scopeLevel hardening first.

### Option C: Export-Adjacent Diagnostic Validation

- use helper near export diagnostics.
- must be output-neutral.
- no ZIP/manifest/sidecar/export shape change.
- higher risk; only after scopeLevel hardening.

### Option D: Maintenance/Diagnostics UI

- user/developer-facing surface.
- requires separate UX/privacy plan.
- not recommended now.

### Option E: Console/Logging

- risks sensitive leakage.
- not recommended now.

### Option F: ZIP Sidecar / manifest.json Extension

- artifact-level exposure.
- compatibility/privacy risk.
- not recommended now.

### Option G: Import/Restore Validation

- mutation-adjacent.
- requires separate restore safety plan.
- not recommended now.

K-250 chooses Option A as the primary near-term path, with Option B only after K-251 scopeLevel hardening if developer-only visibility is still useful. Do not proceed to Option C, D, E, F, or G until scopeLevel and redaction boundaries are fully closed.

## Chosen Near-Term Boundary

The diagnostic harness remains internal/test-only for now.

- Do not connect to UI/logging/ZIP/manifest/export result/import/restore.
- Before any integration, run K-251 scopeLevel sanitizer patch or equivalent test hardening.
- After K-251, consider a developer-only diagnostic harness if needed.

## Forbidden Integration Surfaces

These surfaces remain forbidden:

- user UI
- developer panel
- console logging
- file/log output
- export result shape
- public API
- ZIP artifact
- `manifest.json`
- sidecar JSON
- import validation
- restore validation
- restore mutation
- background sync/backup/restore
- Supabase/Google Drive/OAuth provider surfaces
- attachment blob export/provider-aware recovery

## Visibility/Redaction Rules For Any Future Integration

Any future integration must follow these rules:

- category-only summaries.
- count-only where possible.
- known allowlist labels only.
- `unknown` for malformed/untrusted input.
- no raw user content.
- no raw note content.
- no raw attachment content.
- no raw backupKind unknown values.
- no unsafe scopeLevel values.
- no tokens/secrets/provider credentials.
- no raw manifest JSON in logs.
- errors must identify safe category/path only, not sensitive values.

## scopeLevel Sanitizer Future Requirements

K-251 should define and implement scopeLevel summary hardening.

Requirements:

- allowed current scope levels:
  - `0`
  - `1`
- future levels 2/3/4 should not be summarized as supported by current harness.
- non-number values become `unknown`.
- string values become `unknown`.
- NaN/Infinity become `unknown`.
- negative numbers become `unknown`.
- objects/arrays/null/undefined become `unknown`.
- raw input must not appear in summary/errors/warnings.
- scopeLevel summary should not imply Level 3 blob support.
- tests should cover adversarial values.

## Export/Import/ZIP Boundary

- no ZIP output change.
- no `manifest.json` change.
- no sidecar.
- no export result shape change.
- no `importVaultBackup` change.
- no `vaultRestorePipeline` change.
- no `backupBeforeRestore` change.
- no restore/import validation.
- no destructive whole-vault restore.
- per-item `skip`, `duplicate`, and `replace` remains separate from whole-vault destructive restore.

## Attachment/Provider Boundary

- no attachment blob export claim.
- no Level 3 support claim.
- no `full-content-with-blobs` support claim in current harness integration.
- no provider-aware recovery claim.
- no blob movement/copy/upload/download.
- no attachment sync change.
- Google Drive appDataFolder QA remains separate and externally blocked.
- no Google Drive QA work.

## K-251 Recommendation

Recommended next milestone:

K-251 Local Backup Manifest Diagnostic Harness scopeLevel Redaction Patch

Scope:

- narrow helper/test patch.
- sanitize scopeLevel summary.
- allow only current supported scope levels 0 and 1.
- `unknown` for malformed/future/adversarial values.
- no runtime/UI/logging/export/ZIP/import/restore changes.

Alternatives:

- K-251 Local Backup Manifest Diagnostic Harness Integration Closure Audit if the team decides scopeLevel is sufficiently safe while harness remains test-only.
- K-251 Local Backup Manifest Developer Harness Plan, docs/plan only, after scopeLevel boundary is accepted.

Not recommended yet:

- UI visibility.
- console logging.
- export result metadata.
- ZIP sidecar.
- `manifest.json` extension.
- import/restore validation.

## Non-Goals

- no helper behavior change in K-250.
- no scopeLevel sanitizer implementation in K-250.
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

K-250 plans integration boundaries but does not integrate the harness.

Diagnostic harness remains internal/test-only. backupKind redaction remains closed. scopeLevel should be hardened before broader integration. UI/logging/ZIP/manifest/export result/import/restore surfaces remain forbidden.

Any future visibility or integration requires a separate milestone. Local runtime data remains source of truth. Remote systems remain support layers.
