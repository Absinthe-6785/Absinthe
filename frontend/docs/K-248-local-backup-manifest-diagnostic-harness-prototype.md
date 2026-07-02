# K-248 Local Backup Manifest Diagnostic Harness Prototype

K-248 implements a pure developer/test-only harness prototype for local backup manifest diagnostics.

The prototype converts a narrow diagnostic-like input into a redacted category/count summary only. It does not expose diagnostics to users, backup artifacts, import/restore flows, logs, or runtime UI.

## Implementation

New helper:

- `frontend/src/lib/localBackupManifestDiagnosticHarness.ts`
- `createLocalBackupManifestDiagnosticSummary`

The helper is pure:

- no side effects
- no UI
- no console logging
- no storage writes
- no fetch/network/provider calls
- no attachment blob reads
- no ZIP writes
- no import/restore calls
- no input mutation

## Output Shape

The summary is redacted category/count output only:

- `status`
- `hardFailureCount`
- `warningCount`
- `hardFailureCategories`
- `warningCategories`
- `scopeSummary`
- `sourceCounts`
- `attachmentSummary`
- `compatibilitySummary`

The helper never returns raw diagnostic messages.

## Status Semantics

K-248 uses conservative status semantics:

- `blocked` for hard failures
- `warning` for warnings only
- `pass` only for no hard failures and no warnings

In plain terms: blocked for hard failures, warning for warnings only, and pass only for no hard failures and no warnings.

Warnings should never imply a clean pass.

## Redaction Boundary

raw values/content/tokens/secrets/blob payloads/provider data are forbidden.

The helper must not return:

- raw token values
- raw secret values
- raw credential strings
- raw note content
- raw record content
- raw attachment blob payloads
- provider session data
- raw diagnostic object dumps
- sensitive file paths
- sensitive stack traces
- raw manifest JSON
- raw ZIP payloads

Hostile or raw-looking input strings are categorized internally and reduced to safe categories/counts.

## Category Policy

Safe category examples:

- `privacy`
- `credentialLeak`
- `forbiddenField`
- `rawBlobPayload`
- `destructiveRestoreFlag`
- `unsupportedScope`
- `compatibility`
- `checksumGap`
- `attachmentMetadataOnly`
- `optionalDomainMissing`
- `unknown`

Categories are deduplicated while counts preserve the number of input hard failure and warning items.

## Boundaries

K-248 makes no runtime/output changes:

- no UI
- no console logging
- no ZIP output
- no `manifest.json` change
- no sidecar
- no export result shape change
- no import/restore wiring
- no persistence/network/remote/blob behavior
- no K-244 export diagnostic hook behavior change
- no backup/export/import/restore runtime output change

The harness file does not import export, ZIP, import, restore, persistence, provider, attachment blob, UI, store, schema, route, or router modules.

## Verification

The K-248 tests cover:

- pass / warning / blocked status
- hard failure counts
- warning counts
- category deduplication
- source note/folder/relation counts
- metadata-only attachment summary
- `blobPayloadIncluded: false`
- hostile token/secret/note/blob/provider/path/stack/manifest/ZIP strings are not returned
- no input mutation
- no console logging
- source/import boundary assertions

## K-249 Recommendation

K-249 should be a closure audit or harness integration boundary plan, not UI yet unless explicitly approved.

Recommended next milestone: K-249 Local Backup Manifest Diagnostic Harness Closure Audit.

Alternative: K-249 Local Backup Manifest Diagnostic Harness Integration Boundary Plan if the team wants to decide whether the helper should remain test-only or become dev-tool-only later.
