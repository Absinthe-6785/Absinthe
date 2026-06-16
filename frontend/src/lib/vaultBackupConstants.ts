/** Absinthe app version embedded in vault backups. */
export const ABSINTHE_APP_VERSION = '1.0.0';

/** Current portable vault export schema (v3). v2 remains importable. */
export const VAULT_BACKUP_SCHEMA_VERSION = 3;

/** Legacy schema — import-only. */
export const VAULT_BACKUP_SCHEMA_VERSION_V2 = 2;

export const VAULT_EXPORT_KIND = 'absinthe-vault-export' as const;

export const VAULT_EXTENSIONS_SCHEMA_VERSION = 1;
export const VAULT_CLOUD_SCHEMA_VERSION = 1;

export const VAULT_BACKUP_FORMATS_DOC = `
Supported export formats:
1. Single note — Markdown (.md) via note menu
2. All notes — individual Markdown files via sidebar export
3. Vault backup JSON — manifest v3 (notes, folders, extensions, optional cloud)
4. Vault backup ZIP — manifest.json + notes/*.md + optional cloud/*.csv + README.txt
5. Health data — CSV date-range export via Settings (legacy; cloud data also in v3 vault)
`;

export const VAULT_SCOPE_DOC = `
Portable vault export includes local knowledge core, workspace extensions, and health-local state.
Cloud planner/health data is embedded when authenticated at export time.
Derived indexes, session UI, and snapshot payloads are excluded by design.
`;
