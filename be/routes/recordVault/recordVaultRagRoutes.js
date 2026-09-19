import { requireVaultSession } from '../../utils/recordVaultUsb/vaultSession.js';
import { collectRecordVaultNotesForRag } from '../../utils/recordVaultRagCollect.js';
import { getRecordVaultRagConfig } from '../../utils/recordVaultRagConfig.js';
import { sendRecordVaultError } from '../../utils/recordVaultRouteErrors.js';

/** GET /api/recordVault/rag/status — proxy health from Python RAG service. */
export async function getRecordVaultRagStatus(req, res) {
  const { enabled, serviceUrl } = getRecordVaultRagConfig();
  if (!enabled) {
    return res.json({ enabled: false, status: 'disabled' });
  }

  try {
    const resp = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(8000) });
    const data = await resp.json().catch(() => ({}));
    const pythonModel = data?.ollama?.configured_model
      ? String(data.ollama.configured_model)
      : null;
    const envModel = process.env.OLLAMA_MODEL ? String(process.env.OLLAMA_MODEL).trim() : null;
    const configuredModel = envModel || pythonModel;
    const ragModelMismatch =
      Boolean(envModel && pythonModel) &&
      envModel !== pythonModel &&
      !pythonModel.startsWith(`${envModel}:`) &&
      envModel !== pythonModel.split(':')[0];
    return res.json({
      enabled: true,
      serviceUrl,
      status: data?.status || (resp.ok ? 'ok' : 'error'),
      modelReady: Boolean(data?.model_ready),
      configuredModel: configuredModel || null,
      ragModelMismatch,
      activeRagServiceModel: pythonModel,
      ollama: data?.ollama || null,
      error: data?.error || null
    });
  } catch (err) {
    return res.json({
      enabled: true,
      serviceUrl,
      status: 'unreachable',
      error: err?.message || 'RAG service unreachable'
    });
  }
}

/** POST /api/recordVault/rag/keep-model — { enabled: boolean } warm-load or revert keep_alive. */
export async function postRecordVaultRagKeepModel(req, res) {
  const { enabled: ragEnabled, serviceUrl } = getRecordVaultRagConfig();
  if (!ragEnabled) {
    return res.status(503).json({ error: 'RAG is disabled on this server (RAG_ENABLED=false).' });
  }

  const pinModel = Boolean(req.body?.enabled);
  try {
    const resp = await fetch(`${serviceUrl}/keep-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: pinModel }),
      signal: AbortSignal.timeout(180000)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const detail = data?.detail || data?.error || resp.statusText || 'Keep-model request failed';
      const message = Array.isArray(detail)
        ? detail.map((d) => d?.msg || String(d)).join('; ')
        : String(detail);
      return res.status(resp.status >= 400 && resp.status < 600 ? resp.status : 502).json({ error: message });
    }
    return res.json({
      ok: true,
      enabled: pinModel,
      keepAlive: data.keep_alive,
      model: data.model
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.code === 'ABORT_ERR') {
      return res.status(504).json({ error: 'Keep-model request timed out while loading Ollama.' });
    }
    if (String(err?.cause?.code || err?.code || '') === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'RAG service is not running. Start it with scripts/start-rag-service.sh.'
      });
    }
    return sendRecordVaultError(res, err, 'Keep-model request failed', {
      route: 'postRecordVaultRagKeepModel',
      singlesId: req.auth?.singles_id
    });
  }
}

/** POST /api/recordVault/rag/query — { noteIds: number[], prompt: string, keepModelInMemory?: boolean } */
export async function postRecordVaultRagQuery(req, res) {
  const session = await requireVaultSession(req, res);
  if (!session) return;

  const { enabled, serviceUrl } = getRecordVaultRagConfig();
  if (!enabled) {
    return res.status(503).json({ error: 'RAG is disabled on this server (RAG_ENABLED=false).' });
  }

  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const noteIds = Array.isArray(req.body?.noteIds) ? req.body.noteIds : [];
  if (!noteIds.length) {
    return res.status(400).json({
      error: 'Select at least one note using the RAG checkboxes before asking a question.'
    });
  }

  try {
    const { notes, skipped, meta: ragCollectMeta } = collectRecordVaultNotesForRag(session, noteIds);
    const keepModelInMemory = req.body?.keepModelInMemory === true;
    const resp = await fetch(`${serviceUrl}/query-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        notes,
        keep_model_in_memory: keepModelInMemory
      }),
      signal: AbortSignal.timeout(180000)
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const detail = data?.detail || data?.error || resp.statusText || 'RAG query failed';
      const message = Array.isArray(detail)
        ? detail.map((d) => d?.msg || String(d)).join('; ')
        : String(detail);
      return res.status(resp.status >= 400 && resp.status < 600 ? resp.status : 502).json({
        error: message
      });
    }

    return res.json({
      answer: data.answer,
      sourceNotes: data.source_notes || [],
      model: data.model,
      chunksUsed: data.chunks_used,
      modelLoadMs: Number(data.model_load_ms) || 0,
      skippedNotes: skipped,
      ragCollectMeta: ragCollectMeta || null,
      extractionWarnings: data.extraction_warnings || [],
      pdfNotesWithText: Number(data.pdf_notes_with_text) || 0,
      pdfAttachmentsInRequest: Number(data.pdf_attachments_in_request) || 0,
      pdfDebug: Array.isArray(data.pdf_debug) ? data.pdf_debug : []
    });
  } catch (err) {
    if (err?.code === 'RAG_NO_NOTES' || err?.code === 'RAG_INNER_LOCKED') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err?.name === 'TimeoutError' || err?.code === 'ABORT_ERR') {
      return res.status(504).json({ error: 'RAG request timed out. Try fewer notes or a shorter question.' });
    }
    if (String(err?.cause?.code || err?.code || '') === 'ECONNREFUSED') {
      return res.status(503).json({
        error:
          'RAG service is not running. Start it with scripts/start-rag-service.sh and ensure Ollama is up.'
      });
    }
    return sendRecordVaultError(res, err, 'RAG query failed', {
      route: 'postRecordVaultRagQuery',
      singlesId: req.auth?.singles_id
    });
  }
}
