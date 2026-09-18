export function getRecordVaultRagConfig() {
  const enabled = String(process.env.RAG_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
  const serviceUrl = String(process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
  return { enabled, serviceUrl };
}
