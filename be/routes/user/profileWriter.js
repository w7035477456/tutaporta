/**
 * "Let's write your profile together" (/myStory) — turns the member's picked words plus one custom
 * line into a short first-person profile paragraph with the local Ollama model. Stateless: the FE
 * sends the picks every time, and "Try Another Version" passes the previous text so the model
 * writes something different.
 */
const LOG = '[profileWriter]';
const MAX_WORDS = 20;
const MAX_WORD_CHARS = 40;
const MAX_CUSTOM_CHARS = 200;
const MAX_PREVIOUS_CHARS = 1500;

function getProfileWriterConfig(env = process.env) {
  const timeout = Number(env.PROFILE_WRITER_LLM_TIMEOUT_MS);
  return {
    ollamaBaseUrl: String(env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
    ollamaModel: String(env.PROFILE_WRITER_OLLAMA_MODEL || env.OLLAMA_MODEL || 'qwen3:30b-a3b').trim(),
    llmTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 120000
  };
}

const SYSTEM_PROMPT = `You write dating and friendship profile intros for members of a social website.
Write ONE paragraph in the first person ("I", "me", "my"), 80 to 120 words.
Sound warm, relaxed and natural, like a real person talking to a friend - not salesy, not a
résumé, no clichés like "partner in crime" or "love to laugh".
Do NOT list the keywords or copy them word for word; weave the ideas into small, concrete,
believable details and a sense of personality. Use the member's own line naturally if given.
If the member mentions what they are looking for, end with a light, inviting line about it.
No title, no hashtags, no emojis, no quotation marks around the paragraph. Output only the paragraph.`;

function cleanText(value, maxChars) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function cleanParagraph(raw) {
  const s = String(raw || '');
  const thinkEnd = s.toLowerCase().lastIndexOf('</think>');
  return (thinkEnd >= 0 ? s.slice(thinkEnd + '</think>'.length) : s)
    .replace(/<think>[\s\S]*$/i, '')
    .replace(/^\s*["“]|["”]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const wordCount = (text) => (String(text).match(/\S+/g) || []).length;

async function generateParagraph({ words, custom, previous }, cfg) {
  const lines = [`Words that describe me: ${words.join(', ')}.`];
  if (custom) lines.push(`One thing people should know about me: ${custom}`);
  if (previous) {
    lines.push(
      `Here is a version I didn't love. Write a clearly different one (new opening, new details, different rhythm):\n${previous}`
    );
  }
  const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.ollamaModel,
      stream: false,
      think: false,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || '10m',
      options: { temperature: previous ? 1.0 : 0.8 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${lines.join('\n\n')}\n\n/no_think` }
      ]
    }),
    signal: AbortSignal.timeout(cfg.llmTimeoutMs)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
  return cleanParagraph(JSON.parse(text)?.message?.content);
}

/** POST /api/myStory/profileWriter { words: string[], custom?: string, previous?: string } → { paragraph } */
export async function postProfileWriterGenerate(req, res) {
  if (!req.auth?.singles_id) return res.status(401).json({ error: 'Authentication required' });
  const words = [
    ...new Set((Array.isArray(req.body?.words) ? req.body.words : []).map((w) => cleanText(w, MAX_WORD_CHARS)).filter(Boolean))
  ].slice(0, MAX_WORDS);
  if (!words.length) return res.status(400).json({ error: 'Pick some words that sound like you first.' });
  const custom = cleanText(req.body?.custom, MAX_CUSTOM_CHARS);
  const previous = cleanText(req.body?.previous, MAX_PREVIOUS_CHARS);
  const cfg = getProfileWriterConfig();
  try {
    let paragraph = await generateParagraph({ words, custom, previous }, cfg);
    const n = wordCount(paragraph);
    if (n < 60 || n > 150) paragraph = (await generateParagraph({ words, custom, previous }, cfg)) || paragraph;
    if (!paragraph) throw new Error('empty reply');
    return res.status(200).json({ paragraph });
  } catch (err) {
    console.error(`${LOG} generate failed for singles_id=${req.auth.singles_id}:`, err?.message || err);
    return res.status(503).json({ error: 'Our AI writer is busy right now. Please try again in a moment.' });
  }
}
