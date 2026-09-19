/** Label under the RAG toolbar button (small line). */
export function formatRagModelButtonLabel(raw) {
  const name = String(raw || '').trim();
  if (!name) return '';
  if (name.length <= 16) return name;
  return `${name.slice(0, 15)}…`;
}
