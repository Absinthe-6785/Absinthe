# K-320 Recovery Export Package

K-320 is a read-only preservation format. It does not restore, reconcile, migrate, authenticate,
or synchronize data. Recovery mode remains active while this tooling is used.

## Commands

From `frontend/`:

```text
npm run recovery:export -- --input <vault-backup.json> --output <new-empty-directory>
npm run recovery:verify -- --package <directory-or-zip>
```

Export refuses to overwrite existing package files. Input is read once and is never modified.
The verifier prints codes and counts only; it does not print record contents or owner identifiers.

## Format

Every archive uses the fixed `absinthe-recovery-export/` root. Schema version 2 contains:

- `manifest.json` — derived completeness, per-dataset availability and counts
- `checksums.sha256` — SHA-256 for every other expected file
- `notes/` — physically separate active Notes and tombstones, folders, relationships
- `health/`, `recipes/`, `planning/` — active and tombstone arrays per domain
- `attachments/` — metadata inventory and reference relationships; no blob bytes
- `metadata/` — sanitized provenance inventory, informational sync state, warning codes, conflicts

Canonical JSON uses sorted keys, stable record ordering, and LF line endings. ZIP entry order,
timestamps, permissions, platform metadata, and compression settings are fixed.

## Availability and completeness

Dataset availability is one of:

`source_not_provided`, `present_empty`, `present_records`, `absent_confirmed`, `unavailable`,
`unsupported`, `parse_failed`, or `permission_denied`.

Only `present_empty` may authoritatively contain empty arrays. Non-data states contain `null`.
Package completeness is derived—not adapter-controlled—and is one of `complete`,
`complete_for_supplied_sources`, `partial`, or `invalid`.

## Source adapters and privacy

The dedicated VaultBackupManifest adapter preserves Notes, folders, relationships, extension data,
scope, tombstones when present, and attachment references. Optional cloud data is retained only as
aggregate provenance metadata. Unknown section names become sanitized warning codes; their payloads
are not copied into diagnostics.

Local adapters use read methods only. Attachment export reads metadata only and never opens or
copies blobs. Provenance accepts logical labels or filenames; paths, credentials, query strings,
tokens, cookies, and authorization values are removed or rejected.

### Supported and unsupported sources

| Source type | Export support | Verification support | Notes |
|---|---|---|---|
| VaultBackupManifest JSON | Supported | Supported | Primary CLI export input |
| Supplied JSON record arrays | Library adapter | Package verification | Only for explicitly mapped domains |
| localStorage arrays/preferences/prefixes | Read-only library adapter | Package verification | No writes or cursor changes |
| Supplied attachment metadata | Metadata only | Supported | No blob reads or downloads |
| Recovery package directory | Not an export source | Supported | Fixed expected paths only |
| Standard non-ZIP64 recovery package ZIP | Not an export source | Supported | Central/local names must agree; duplicate, unsafe, and colliding entries are rejected before assignment |
| ZIP64 | Unsupported | Unsupported | Rejected explicitly with `zip64_unsupported` |
| Encrypted or multi-disk ZIP | Unsupported | Unsupported | Rejected explicitly; K-320 never decrypts or combines archive volumes |
| Direct Supabase/database dump | Unsupported | Unsupported | No production connection in K-320 |
| Browser profile or live IndexedDB crawl | Unsupported | Unsupported | No profile inspection in K-320 |
| Production attachment blobs | Unsupported | Unsupported | Metadata references only |
| Unsupported legacy backup variants | Unsupported | Unsupported | Must be converted by a separately reviewed adapter |
| Restore/import/reconciliation/migration/outbox/sync | Unsupported | Unsupported | Outside preservation scope |

The CLI export boundary is limited to the documented supplied VaultBackupManifest format. This
package is a preservation artifact, not a restore package, migration package, or canonically
reconciled dataset.

Unsupported ZIP and legacy archive variants fail closed. They are not partially parsed, assigned,
or imported. InBody records without an intrinsic `id` require a sanitized adapter-supplied storage
key in per-record provenance (`sourceId`). The supported InBody JSON and localStorage adapters use
the source-confirmed `date` field (the backend uniqueness key is `user_id,date`) and emit
`date:YYYY-MM-DD`; missing or unsafe dates remain unresolved rather than falling back to array
position. ProteinProfile is verified with a domain singleton
identity. These external identities remain separate from the preserved source payload.

## Verification

Verification independently parses expected files, hashes bytes, recomputes dataset and partition
counts, derives completeness, and recomputes deterministic conflict diagnostics. Missing,
unexpected, unsafe, or structurally inconsistent paths fail verification. Conflicts are reported
without choosing a winner and without exposing Note, Health, Recipe, token, or session content.
