import phrasesRaw from './liveFaceScanFavoriteBioScriptPhrases.txt?raw';

/**
 * Parse `liveFaceScanFavoriteBioScriptPhrases.txt` into structured phrase objects.
 * @returns {{ id: number, title: string, body: string }[]}
 */
export function parseLiveFaceScanFavoriteBioScriptPhrases(raw = phrasesRaw) {
  const text = String(raw ?? '');
  const blocks = text
    .split(/\n---\n/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith('#'));

  const phrases = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim());
    const headerLine = lines.find((line) => /^\d+\.\s/.test(line));
    if (!headerLine) continue;

    const match = headerLine.match(/^(\d+)\.\s*(.+)$/);
    if (!match) continue;

    const id = Number(match[1]);
    const title = String(match[2] ?? '').trim();
    const bodyStart = lines.indexOf(headerLine) + 1;
    const body = lines
      .slice(bodyStart)
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!body) continue;
    phrases.push({ id, title, body });
  }

  return phrases.sort((a, b) => a.id - b.id);
}

export const LIVE_FACE_SCAN_FAVORITE_BIO_SCRIPT_PHRASES = parseLiveFaceScanFavoriteBioScriptPhrases();
