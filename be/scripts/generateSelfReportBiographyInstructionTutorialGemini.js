/**
 * Gemini TTS bake for My Self-Report-Bio (/selfReportBiography) page-instruction audio.
 * Writes fe/src/assets/sound/self_report_biography_instruction_{Persona}.m4a
 *
 * Personas (AI_VOICE in themeConfig): Sora, Jessica, Michael
 * Gemini TTS prebuilt voices used under the hood:
 *   Sora → Sulafat, Jessica → Achernar, Michael → Enceladus
 *
 * Requires GEMINI_API_KEY in ~/.ssh/be/.env
 *
 * Usage (from be/):
 *   node scripts/generateSelfReportBiographyInstructionTutorialGemini.js
 *   node scripts/generateSelfReportBiographyInstructionTutorialGemini.js --voice=Sora
 *   node scripts/generateSelfReportBiographyInstructionTutorialGemini.js --all-voices
 *   node scripts/generateSelfReportBiographyInstructionTutorialGemini.js --force
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

/** Keep in sync with fe constants/selfReportBiographyInstructionText.js */
const COPY = {
  title: 'Current Context Tutorial',
  step: 'You are in My Self-Reporting-Biography page.',
  body: [
    'How it Works: Secure Bio Verification.',
    'Welcome to your Bio Verification control panel. To ensure maximum trust and safety while fully protecting your privacy, start with these two secure stages.',
    'Step 1 - Complete Your Profile Bios. Fill out the three biographical sections below: Brief Bio, Full Bio, and Miscellaneous Optional Bio. You have total control over what details you choose to self-report and reveal on your profile.',
    'Step 2 - Off-Site Secure Verification via 3rd-Party. Click the link to initiate your verification check with 3rd-Party, our reputable, nationwide third-party verification service.',
    "Complete Privacy: 3rd-Party will contact you directly via email. You will enter your sensitive personal information, such as your SSN and Date of Birth, securely on 3rd-Party's platform only.",
    'Zero Database Exposure: Our server never sees, collects, or has access to your sensitive PII.',
    'FCRA Protection: Once 3rd-Party completes their assessment, they transmit raw verification data to our secure server. Due to strict federal FCRA regulations, we never share or expose this raw data to anyone. We only use it internally to cross-check against the profile information you filled out on this page.'
  ].join(' ')
};

export const SELF_REPORT_BIOGRAPHY_INSTRUCTION_GEMINI_VOICES = ['Sora', 'Jessica', 'Michael'];
export const SELF_REPORT_BIOGRAPHY_INSTRUCTION_GEMINI_VOICE = 'Sora';

const PERSONA_TO_GEMINI_VOICE = {
  Sora: 'Sulafat',
  Jessica: 'Achernar',
  Michael: 'Enceladus',
  Sulafat: 'Sulafat',
  Achernar: 'Achernar',
  Enceladus: 'Enceladus'
};

function toPersona(voice) {
  const name = String(voice || '').trim();
  if (name === 'Sulafat') return 'Sora';
  if (name === 'Achernar') return 'Jessica';
  if (name === 'Enceladus') return 'Michael';
  if (SELF_REPORT_BIOGRAPHY_INSTRUCTION_GEMINI_VOICES.includes(name)) return name;
  return SELF_REPORT_BIOGRAPHY_INSTRUCTION_GEMINI_VOICE;
}

function toGeminiVoice(voice) {
  const persona = toPersona(voice);
  return PERSONA_TO_GEMINI_VOICE[persona] || PERSONA_TO_GEMINI_VOICE.Sora;
}

const MODEL = String(process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts').trim();

const STYLE =
  'Speak in a warm, soft, smooth, intimate adult female voice. Natural and appealing, not robotic. Clear diction, gentle pace.';

function speakText() {
  return `${COPY.title}. ${COPY.step} ${COPY.body}`.replace(/\s+/g, ' ').trim();
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
    if (res.status === 429 && attempt < 3) {
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
  let allVoices = false;
  let force = false;
  const known = [...SELF_REPORT_BIOGRAPHY_INSTRUCTION_GEMINI_VOICES, 'Sulafat', 'Achernar', 'Enceladus'];
  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (!arg) continue;
    if (arg === '--all-voices') {
      allVoices = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg.startsWith('--voice=')) {
      voices.push(toPersona(arg.slice('--voice='.length).trim()));
      continue;
    }
    if (known.includes(arg)) voices.push(toPersona(arg));
  }
  return {
    voices: allVoices || !voices.length ? [...SELF_REPORT_BIOGRAPHY_INSTRUCTION_GEMINI_VOICES] : voices,
    force
  };
}

async function main() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY missing in ~/.ssh/be/.env');

  const { voices, force } = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const text = speakText();
  console.log(`Model=${MODEL}`);
  console.log(`Personas: ${voices.join(', ')}`);
  console.log(`Text chars: ${text.length}`);

  let ok = 0;
  let skipped = 0;
  for (const voice of voices) {
    const persona = toPersona(voice);
    const geminiVoice = toGeminiVoice(persona);
    const m4aPath = path.join(OUT_DIR, `self_report_biography_instruction_${persona}.m4a`);
    if (!force && fs.existsSync(m4aPath) && fs.statSync(m4aPath).size > 10000) {
      skipped += 1;
      console.log(`[skip] ${persona}: already exists (${fs.statSync(m4aPath).size} bytes)`);
      continue;
    }

    let pcm;
    try {
      try {
        pcm = await synthesizeGenerateContent(apiKey, text, geminiVoice);
      } catch (err1) {
        console.warn(`[warn] generateContent ${persona} (${geminiVoice}): ${err1.message}`);
        pcm = await synthesizeInteractions(apiKey, text, geminiVoice);
      }

      const wavPath = path.join(OUT_DIR, `self_report_biography_instruction_${persona}.wav`);
      fs.writeFileSync(wavPath, pcmToWav(pcm));
      if (!convertWavToM4a(wavPath, m4aPath)) {
        throw new Error(`afconvert failed for ${m4aPath}`);
      }
      fs.unlinkSync(wavPath);
      ok += 1;
      console.log(`[ok ${ok}] ${persona} via ${geminiVoice} → ${m4aPath} (${fs.statSync(m4aPath).size} bytes)`);
    } catch (err) {
      console.error(`[fail] ${persona}: ${err?.message || err}`);
    }
    await sleep(15000);
  }

  console.log(`\nFiles written: ${ok}`);
  console.log(`Skipped existing: ${skipped}`);
}

main().catch((err) => {
  console.error('[generateSelfReportBiographyInstructionTutorialGemini]', err?.message || err);
  process.exit(1);
});
