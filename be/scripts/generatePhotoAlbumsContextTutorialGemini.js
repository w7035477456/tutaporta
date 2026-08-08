/**
 * Gemini TTS bake for photo-albums context tutorial audio.
 * Writes fe/src/assets/sound/pa_context_tutorial_{mode}_{Persona}.m4a
 *
 * Personas (AI_VOICE in themeConfig): Sora, Jessica, Michael
 * Gemini TTS prebuilt voices used under the hood:
 *   Sora → Sulafat, Jessica → Achernar, Michael → Enceladus
 *
 * Requires GEMINI_API_KEY in ~/.ssh/be/.env
 *
 * Usage (from be/):
 *   node scripts/generatePhotoAlbumsContextTutorialGemini.js
 *   node scripts/generatePhotoAlbumsContextTutorialGemini.js view
 *   node scripts/generatePhotoAlbumsContextTutorialGemini.js --voice=Sora view
 *   node scripts/generatePhotoAlbumsContextTutorialGemini.js --all-voices
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../fe/src/assets/sound');

dotenv.config({ path: path.join(os.homedir(), '.ssh', 'be', '.env'), override: true });

const COPY = {
  idle: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Create Mode',
      '• 1) Add Photos: Click Open Folder to select the photos you want to include. Use "Add All to Thumbnail Tray" or "Add selected to Thumbnail Tray".  ',
      '• 2A) Auto: Click Auto Layout above the thumbnail tray. AI will choose the best template (portrait vs landscape) and number of photos per page.',
      '• 2B) Manual: Click Template to create your first page layout, then drag photos into the different photo slots on the template.',
      '• 2C) Hybrid: Use Auto Layout 1 to auto-layout one page at a time so you can manually edit before proceeding.',
      '• 3) Once one or more photos exist on the album, proceed to Album Edit Mode by double-clicking any photo.'
    ].join('\n')
  },
  view: {
    title: 'Current Context Tutorial:',
    body: [
      'You are currently in Album View Mode.',
      '• Choose a Layout: Click the Template button to select a layout for your new album page.',
      '• Add Photos: If your chosen template has an empty slot, simply drag and drop a photo from the Thumbnail Tray into the space.',
      '• Edit Photos: Double-click any photo and select "Edit Video" on popup to enter Album Edit Mode. To exit, click anywhere on the album page outside of the selected photo.',
      '• Rearrange or Remove: Drag a photo back to the Thumbnail Tray to remove it, or drag it to another slot on the page to swap locations.',
      '• Additional Features: While in View Mode, you can also:',
      '  • Play a Photo or Album Slideshow.',
      '  • Mark the current album for print ordering.',
      '  • Change the page orientation (Portrait/Landscape).',
      '  • Auto-resize images.',
      '  • Reset (blank out) the entire album page.'
    ].join('\n')
  },
  edit: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Edit Mode (Pan & Zoom is OFF).',
      '• Rearrange: Drag and drop photos back to the thumbnail tray or onto another slot to swap them.',
      '• Actions: Click any green button to make edits.',
      '• Switch Modes: Click the Pan & Zoom button to activate it.',
      '• Exit: Click anywhere on the album outside the active photo.'
    ].join('\n')
  },
  editPanZoom: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Edit Mode (Pan & Zoom is ON).',
      '• Pan: Drag the photo to reposition it.',
      '• Resize: Drag the yellow slider at the bottom of the photo.',
      '• Switch Modes: Click the Pan & Zoom button again to turn it off.',
      '• Exit: Click anywhere on the album outside the active photo.'
    ].join('\n')
  }
};

/** Same list as fe themeConfig AI_VOICE_OPTIONS (display personas). */
export const PHOTO_ALBUMS_CONTEXT_TUTORIAL_GEMINI_VOICES = ['Sora', 'Jessica', 'Michael'];
export const PHOTO_ALBUMS_CONTEXT_TUTORIAL_GEMINI_VOICE = 'Sora';

/** Display persona → Gemini TTS prebuilt voiceName. */
const PERSONA_TO_GEMINI_VOICE = {
  Sora: 'Sulafat',
  Jessica: 'Achernar',
  Michael: 'Enceladus',
  // Accept legacy / raw Gemini ids as CLI args too.
  Sulafat: 'Sulafat',
  Achernar: 'Achernar',
  Enceladus: 'Enceladus'
};

/** Normalize CLI / stored voice to a filename persona. */
function toPersona(voice) {
  const name = String(voice || '').trim();
  if (name === 'Sulafat') return 'Sora';
  if (name === 'Achernar') return 'Jessica';
  if (name === 'Enceladus') return 'Michael';
  if (PHOTO_ALBUMS_CONTEXT_TUTORIAL_GEMINI_VOICES.includes(name)) return name;
  return PHOTO_ALBUMS_CONTEXT_TUTORIAL_GEMINI_VOICE;
}

function toGeminiVoice(voice) {
  const persona = toPersona(voice);
  return PERSONA_TO_GEMINI_VOICE[persona] || PERSONA_TO_GEMINI_VOICE.Sora;
}

const MODEL = String(process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts').trim();

const STYLE =
  'Speak in a warm, soft, smooth, intimate adult female voice. Natural and appealing, not robotic. Clear diction, gentle pace.';

function speakText(entry) {
  return `${entry.title} ${entry.body}`
    .replace(/[•●]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pcmToWav(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
}

function extractInlineAudioBase64(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      const b64 = p?.inlineData?.data || p?.inline_data?.data;
      if (b64) return b64;
    }
  }
  if (data?.output_audio?.data) return data.output_audio.data;
  if (data?.outputAudio?.data) return data.outputAudio.data;
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMsFromMessage(message, fallbackMs = 60000) {
  const m = String(message || '').match(/retry in\s+([\d.]+)\s*s/i);
  if (!m) return fallbackMs;
  const sec = Number(m[1]);
  if (!Number.isFinite(sec) || sec <= 0) return fallbackMs;
  return Math.ceil(sec * 1000) + 1500;
}

async function synthesizeGenerateContent(apiKey, text, voice, attempt = 1) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        parts: [{ text: `${STYLE}\n\nRead exactly this text:\n${text}` }]
      }
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice
          }
        }
      }
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json).slice(0, 400);
    if (res.status === 429 && attempt < 6) {
      const waitMs = retryAfterMsFromMessage(msg, 60000);
      console.warn(`[rate-limit] attempt ${attempt}: waiting ${Math.ceil(waitMs / 1000)}s…`);
      await sleep(waitMs);
      return synthesizeGenerateContent(apiKey, text, voice, attempt + 1);
    }
    throw new Error(`generateContent ${res.status}: ${msg}`);
  }
  const b64 = extractInlineAudioBase64(json);
  if (!b64) throw new Error('generateContent: no audio in response');
  return Buffer.from(b64, 'base64');
}

async function synthesizeInteractions(apiKey, text, voice) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const body = {
    model: 'gemini-3.1-flash-tts-preview',
    input: `${STYLE}\n\nRead exactly this text:\n${text}`,
    response_format: { type: 'audio' },
    generation_config: {
      speech_config: [{ voice }]
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json).slice(0, 400);
    throw new Error(`interactions ${res.status}: ${msg}`);
  }
  const b64 = extractInlineAudioBase64(json);
  if (!b64) throw new Error('interactions: no audio in response');
  return Buffer.from(b64, 'base64');
}

function convertWavToM4a(wavPath, m4aPath) {
  const af = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac', wavPath, m4aPath], { encoding: 'utf8' });
  return af.status === 0 && fs.existsSync(m4aPath);
}

function parseArgs(argv) {
  const voices = [];
  const modes = [];
  let allVoices = false;
  const known = [
    ...PHOTO_ALBUMS_CONTEXT_TUTORIAL_GEMINI_VOICES,
    'Sulafat',
    'Achernar',
    'Enceladus'
  ];
  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (!arg) continue;
    if (arg === '--all-voices') {
      allVoices = true;
      continue;
    }
    if (arg.startsWith('--voice=')) {
      voices.push(toPersona(arg.slice('--voice='.length).trim()));
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(COPY, arg)) {
      modes.push(arg);
      continue;
    }
    if (known.includes(arg)) {
      voices.push(toPersona(arg));
    }
  }
  return {
    voices: allVoices || !voices.length ? [...PHOTO_ALBUMS_CONTEXT_TUTORIAL_GEMINI_VOICES] : voices,
    modes: modes.length ? modes : Object.keys(COPY)
  };
}

async function main() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY missing in ~/.ssh/be/.env');

  const { voices, modes } = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Model=${MODEL}`);
  console.log(`Personas: ${voices.join(', ')}`);
  console.log(`Modes: ${modes.join(', ')}`);
  console.log(`Jobs: ${voices.length * modes.length}`);

  let totalChars = 0;
  let ok = 0;
  let skipped = 0;
  for (const voice of voices) {
    const persona = toPersona(voice);
    const geminiVoice = toGeminiVoice(persona);
    for (const mode of modes) {
      const m4aPath = path.join(OUT_DIR, `pa_context_tutorial_${mode}_${persona}.m4a`);
      if (fs.existsSync(m4aPath) && fs.statSync(m4aPath).size > 10000) {
        skipped += 1;
        console.log(`[skip] ${persona}/${mode}: already exists (${fs.statSync(m4aPath).size} bytes)`);
        continue;
      }
      const entry = COPY[mode];
      const text = speakText(entry);
      totalChars += text.length;
      let pcm;
      try {
        pcm = await synthesizeGenerateContent(apiKey, text, geminiVoice);
      } catch (err1) {
        console.warn(`[warn] generateContent ${persona}/${mode} (${geminiVoice}): ${err1.message}`);
        pcm = await synthesizeInteractions(apiKey, text, geminiVoice);
      }

      const wavPath = path.join(OUT_DIR, `pa_context_tutorial_${mode}_${persona}.wav`);
      fs.writeFileSync(wavPath, pcmToWav(pcm));
      if (!convertWavToM4a(wavPath, m4aPath)) {
        throw new Error(`afconvert failed for ${m4aPath}`);
      }
      fs.unlinkSync(wavPath);
      // Remove legacy unscoped / old Gemini-id filenames if present.
      for (const legacyName of [
        `pa_context_tutorial_${mode}.m4a`,
        `pa_context_tutorial_${mode}_Sulafat.m4a`,
        `pa_context_tutorial_${mode}_Achernar.m4a`,
        `pa_context_tutorial_${mode}_Enceladus.m4a`
      ]) {
        const legacy = path.join(OUT_DIR, legacyName);
        if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
      }
      ok += 1;
      console.log(
        `[ok ${ok}] ${persona}/${mode} via ${geminiVoice}: ${text.length} chars → ${m4aPath} (${fs.statSync(m4aPath).size} bytes)`
      );
      // Pace free-tier TTS (often ~10 req/min).
      await sleep(7000);
    }
  }

  console.log(`\nTotal characters billed (approx): ${totalChars}`);
  console.log(`Files written: ${ok}`);
  console.log(`Skipped existing: ${skipped}`);
  console.log('AI_VOICE options: Sora | Jessica | Michael (default Sora)');
}

main().catch((err) => {
  console.error('[generatePhotoAlbumsContextTutorialGemini]', err?.message || err);
  process.exit(1);
});
