import api from './axios';

/** Max candidates per request (BE scores one batch per Ollama call). */
export const AI_MATCH_BATCH_SIZE = 8;

/** Opposite-gender members the AI Filter may score → { viewerGender: 'M'|'F'|null, candidateIds: number[] }. */
export async function fetchAiMatchCandidates({ signal } = {}) {
  const { data } = await api.get('/api/allSingles/aiMatch/candidates', { signal });
  return {
    viewerGender: data?.viewerGender ?? null,
    candidateIds: Array.isArray(data?.candidateIds) ? data.candidateIds.map(Number) : []
  };
}

/** All Singles "AI Filter": score up to 8 candidates on the picked categories → [{ singles_id, score, reason }]. */
export async function postAiMatchBatch({ categories, candidateIds, signal }) {
  const { data } = await api.post('/api/allSingles/aiMatch', { categories, candidateIds }, { signal, timeout: 0 });
  return Array.isArray(data?.results) ? data.results : [];
}
