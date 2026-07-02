# K-247 Local Backup Manifest Diagnostic Harness Plan

K-247 defines a safe diagnostic harness plan for local backup manifest diagnostics.

K-247 is plan/docs plus audit test only. It does not implement runtime visibility, user UI, developer console logging, export output, ZIP sidecars, `manifest.json` changes, export result shape changes, import/restore validation, persistence, network, remote provider calls, or blob behavior.

## Harness Purpose

The harness is developer/test-only.

It is not a user-facing UI, not console logging, not export output, not a ZIP sidecar, not `manifest.json`, not import/restore validation, and not persistence.

The purpose is to let future tests or developer-only tooling summarize local backup manifest diagnostics in a redacted, category/count-only way. It should help prove diagnostic health without exposing private data or changing backup artifacts.

## Harness Input Boundary

A future harness may consume the internal diagnostic result shape from the K-241/K-244 path conceptually:

- `hardFailure`
- `hardFailureReasons`
- `warnings`
- diagnostic `validation` status
- diagnostic `manifest` metadata when present
- source counts such as notes, folders, and relations
- scope summary such as `diagnostic-manifest` / `0` or `core-data` / `1`

Input must remain constrained.

The harness may consume category-level hard failure and warning information. It must not consume or expose raw values, raw note content, raw record content, raw attachment blob payloads, provider session data, raw OAuth material, raw Supabase keys, local file contents, or raw diagnostic object dumps.

The harness must not require reading attachment blobs. It must not call network/provider APIs. It must not read/write IndexedDB or localStorage. It must not invoke import/restore paths.

## Harness Output Boundary

Allowed future output is a redacted summary only:

- `status`: `pass` / `warning` / `blocked`
- `hardFailureCount`
- `warningCount`
- `hardFailureCategories`
- `warningCategories`
- scope summary
- source counts such as notes/folders/relations
- attachment metadata-only status
- compatibility summary

Forbidden output:

- raw token values
- raw secret values
- raw credential strings
- raw note content
- raw record content
- raw attachment blob payloads
- provider session data
- raw diagnostic object dumps
- file paths if sensitive
- stack traces containing sensitive values
- raw manifest JSON
- raw ZIP payloads

## Category/Count Policy

Harness categories must remain category-level and redacted.

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

K-248 may rename categories if existing code has a better taxonomy, but the output must remain category-level and value-free.

Counts are allowed when they do not reveal private content. Examples include hard failure count, warning count, source note count, source folder count, relation count, and attachment metadata-only marker count.

## Hard Failure Versus Warning Display Policy

Hard failures may produce `blocked` status in future harness summaries.

Warnings may produce `warning` status.

`pass` status should require no hard failures and no warnings unless K-248 explicitly documents a narrower rule. If warnings are present, the summary should not imply a clean pass.

Hard failures and warnings must never include raw values. They may include safe category names, safe counts, and safe high-level paths only.

## Test-Only / Developer-Only Guardrail

K-247 does not implement the harness.

If K-248 implements a harness, it should be pure and side-effect-free:

- no localStorage writes
- no IndexedDB writes
- no fetch/network
- no provider API calls
- no logs by default
- no UI by default
- no route/navigation changes
- no export/import behavior changes

The harness should be callable from tests or developer-only code paths only. Production backup artifacts and user-visible surfaces must remain unchanged.

## Export Artifact Boundary

Future harness work must not:

- write into ZIP
- change `manifest.json`
- add sidecar
- change export return shape
- affect import/restore compatibility
- write a local-first manifest artifact
- replace `VaultBackupManifest` v3 as the artifact contract

Any future ZIP sidecar, manifest extension, or wrapper package requires a separate artifact-evolution plan.

## Import/Restore Boundary

Future harness work must not connect import/restore validation.

It must not change `importVaultBackup`, `vaultRestorePipeline`, `backupBeforeRestore`, restore previews, per-item skip/duplicate/replace behavior, or destructive restore policy.

The harness may summarize compatibility categories for tests, but it must not authorize restore behavior.

## Privacy/Redaction Boundary

The harness must be redacted by default.

Do not expose raw diagnostic values, note content, tokens, secrets, credentials, provider session data, Supabase keys, OAuth material, attachment blob payloads, raw blob data URLs, generated HTML/dev-test artifact content, raw manifest JSON, or stack traces that include sensitive values.

Summaries should use categories, counts, and safe compatibility labels only.

## K-248 Recommendation

Recommended next milestone: K-248 Local Backup Manifest Diagnostic Harness Prototype.

K-248 should be:

- pure helper or test-only harness
- redacted category/count summary only
- developer/test-only
- no UI
- no console logging
- no ZIP output change
- no `manifest.json` change
- no sidecar
- no export result shape change
- no import/restore validation
- no persistence/network/provider/blob behavior

The K-248 prototype should prove that safe summary construction is possible before any user-visible, artifact-visible, or logging-visible milestone is considered.

## Non-Goals

- no runtime visibility in K-247
- no user UI
- no developer console logging
- no export output
- no ZIP output change
- no ZIP `manifest.json` change
- no sidecar output
- no export result shape change
- no import/restore validation
- no import/restore path change
- no persistence changes
- no localStorage writes
- no IndexedDB writes
- no network/provider calls
- no remote/blob behavior changes
- no raw diagnostic values
- no raw note content
- no tokens/secrets/credentials
- no provider session data
- no attachment blob payloads
- no K-244 hook behavior change
- no package.json or Vite config change
- no dependencies
- no assets/fonts/routes/stores/schemas/providers changes

## Closure Statement

K-247 defines the harness plan but does not implement the harness.

Diagnostics remain internal/ignored. Any future harness must be developer/test-only, pure, side-effect-free, redacted, and category/count-only. Backup artifacts, ZIP `manifest.json`, sidecars, export result shape, import/restore paths, UI, logs, persistence, network, remote systems, and blob behavior remain unchanged.
