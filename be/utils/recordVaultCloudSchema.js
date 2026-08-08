/** Postgres undefined_column */
export function isRecordVaultCloudColumnMissingError(err) {
  const code = String(err?.code || '').trim();
  const message = String(err?.message || '');
  return (
    code === '42703' ||
    /record_notes_onedrive_.*does not exist/i.test(message) ||
    /record_vault_onedrive_.*does not exist/i.test(message)
  );
}

export function recordVaultCloudSchemaMigrationHint() {
  return 'Database migration missing on Postgres Primary. Run: psql -U test_user1 -d vsingles -f be/db/addSinglesRecordVaultCloud.sql then pm2 restart onlinemallwebsite. Verify with be/db/verifyRecordVaultCloudColumns.sql (expect 3 OneDrive columns). DDL must run on Primary, not a replica.';
}

export function recordVaultCloudSchemaErrorResponse(provider, err) {
  return {
    status: 503,
    body: {
      error: `${provider} cloud storage is not ready on this server (database columns missing).`,
      errorSecondary: recordVaultCloudSchemaMigrationHint(),
      code: 'RECORD_VAULT_CLOUD_SCHEMA_MISSING',
      detail: String(err?.message || '').trim() || null
    }
  };
}

const schemaMissingLogged = new Set();

/** Log schema-migration hint once per provider per process (avoids PM2 spam every 8s poll). */
export function logRecordVaultCloudSchemaMissingOnce(provider, err) {
  const key = String(provider || 'cloud');
  if (schemaMissingLogged.has(key)) return;
  schemaMissingLogged.add(key);
  return {
    provider: key,
    message: String(err?.message || err || 'column missing'),
    hint: recordVaultCloudSchemaMigrationHint()
  };
}
