import { createWorker } from 'tesseract.js';

let workerRef = null;
let workerInitPromise = null;

async function getTesseractWorker() {
  if (workerRef) return workerRef;
  if (!workerInitPromise) {
    workerInitPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        logger: () => {}
      });
      workerRef = worker;
      return worker;
    })();
  }
  return workerInitPromise;
}

/**
 * Local OCR backup (not AWS). Returns one string per text line.
 * @param {Buffer|Uint8Array} imageBytes
 * @returns {Promise<string[]>}
 */
export async function detectTextLinesWithTesseract(imageBytes) {
  const worker = await getTesseractWorker();
  const buffer = Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes);
  const { data } = await worker.recognize(buffer);
  return String(data?.text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
