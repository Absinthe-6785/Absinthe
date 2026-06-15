/** Absinthe app version embedded in vault backups. */
export const ABSINTHE_APP_VERSION = '1.0.0';

export const VAULT_BACKUP_SCHEMA_VERSION = 2;

export const VAULT_BACKUP_FORMATS_DOC = `
Supported export formats:
1. Single note — Markdown (.md) via note menu
2. All notes — individual Markdown files via sidebar export
3. Vault backup JSON — manifest with folders, notes, metadata
4. Vault backup ZIP — manifest.json + notes/*.md + README.txt
5. Health data — CSV date-range export via Settings
`;
