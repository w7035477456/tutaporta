/**
 * One-time (or re-run when tutorial copy changes) AWS Polly bake for
 * fe/src/assets/sound/pa_context_tutorial_*.mp3
 *
 * Usage (from be/):
 *   node scripts/generatePhotoAlbumsContextTutorialPolly.js
 *
 * Prefers Generative Danielle; falls back to Neural Ruth / Joanna.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  DescribeVoicesCommand
} from '@aws-sdk/client-polly';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../fe/src/assets/sound');

dotenv.config({ path: path.join(os.homedir(), '.ssh', 'be', '.env'), override: true });

const COPY = {
  idle: {
    title: 'Current Context Tutorial:',
    body: [
      'You are in Album Create Mode',
      '• 1) Add Photos: Click Open Folder to select the photos you want to include. Use "Add All to Thumbnail Tray" or "Add selected to Thumbnail Tray" .',
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
      '• Locate & Import photos: Bottom Right click "Change" (change folder) and navigate to your photo folder. Next click "Add All to Thumbnail Tray."',
      '• Add photos to Album: Click "Auto Layout" on top left.',
      '• Edit Photos: Double-click any photo to open Add Text (captions, emoji, Pan Zoom / Rotate / Full / Zoom).',
      '• Rearrange or Remove: Drag a photo back to the Thumbnail Tray to remove it, or drag it to another slot on the page to swap locations.',
      '• Additional Features: While in View Mode, you can also:',
      '  • Zoom and Pan photo.',
      '  • Add Text and Emoji.',
      '  • Change the page orientation (Portrait/Landscape).',
      '  • Rotate Photo.',
      '  • Reset all changes.'
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

function speakText(entry) {
  return `${entry.title} ${entry.body}`.replace(/\s+/g, ' ').trim();
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function main() {
  const region = String(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1').trim();
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in ~/.ssh/be/.env');
  }

  const client = new PollyClient({ region });

  let engine = 'generative';
  let voiceId = 'Danielle';
  try {
    await client.send(
      new DescribeVoicesCommand({ Engine: 'generative', LanguageCode: 'en-US' })
    );
  } catch {
    engine = 'neural';
    voiceId = 'Ruth';
  }

  // Prefer warm generative female; neural Ruth is a solid fallback.
  const attempts = [
    { Engine: engine, VoiceId: voiceId },
    { Engine: 'generative', VoiceId: 'Ruth' },
    { Engine: 'neural', VoiceId: 'Ruth' },
    { Engine: 'neural', VoiceId: 'Joanna' },
    { Engine: 'neural', VoiceId: 'Danielle' }
  ];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalChars = 0;
  for (const [mode, entry] of Object.entries(COPY)) {
    const text = speakText(entry);
    totalChars += text.length;
    let audio = null;
    let used = null;
    let lastErr = null;
    for (const opts of attempts) {
      try {
        const res = await client.send(
          new SynthesizeSpeechCommand({
            Text: text,
            OutputFormat: 'mp3',
            SampleRate: '24000',
            TextType: 'text',
            Engine: opts.Engine,
            VoiceId: opts.VoiceId
          })
        );
        audio = await streamToBuffer(res.AudioStream);
        used = opts;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!audio) {
      throw lastErr || new Error(`Polly failed for mode=${mode}`);
    }
    const outMp3 = path.join(OUT_DIR, `pa_context_tutorial_${mode}.mp3`);
    fs.writeFileSync(outMp3, audio);
    // Remove older local bake if present.
    const oldM4a = path.join(OUT_DIR, `pa_context_tutorial_${mode}.m4a`);
    if (fs.existsSync(oldM4a)) fs.unlinkSync(oldM4a);
    console.log(
      `[ok] ${mode}: ${text.length} chars → ${outMp3} (${audio.length} bytes) via ${used.Engine}/${used.VoiceId}`
    );
  }

  const neuralCost = (totalChars / 1_000_000) * 16;
  const generativeCost = (totalChars / 1_000_000) * 30;
  console.log(`\nTotal characters: ${totalChars}`);
  console.log(`Est. one-time cost (Neural $16/1M): ~$${neuralCost.toFixed(4)}`);
  console.log(`Est. one-time cost (Generative $30/1M): ~$${generativeCost.toFixed(4)}`);
  console.log('Playback is local after this — no Polly per click.');
}

main().catch((err) => {
  console.error('[generatePhotoAlbumsContextTutorialPolly]', err?.message || err);
  process.exit(1);
});
