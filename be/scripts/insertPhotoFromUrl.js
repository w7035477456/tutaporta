/**
 * Insert a photo into helloworldjunktest.photos by PK and image URL.
 * Prompts for: helloworldjunktest.photos PK number, then image URL.
 * Downloads the image as blob and inserts into helloworldjunktest.photos.
 *
 * Usage (from project root): node be/scripts/insertPhotoFromUrl.js
 * Or from be/: node scripts/insertPhotoFromUrl.js
 */
import '../loadEnv.js';
import readline from 'readline';

const rl_AAAAA = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask_AAAAA(question_AAAAA) {
  return new Promise((resolve) => rl_AAAAA.question(question_AAAAA, resolve));
}

function toContentType_AAAAA(header_AAAAA) {
  if (!header_AAAAA) return 'image/jpeg';
  const m = String(header_AAAAA).trim().toLowerCase();
  if (m.startsWith('image/jpeg') || m.startsWith('image/jpg')) return 'image/jpeg';
  if (m.startsWith('image/png')) return 'image/png';
  if (m.startsWith('image/gif')) return 'image/gif';
  if (m.startsWith('image/webp')) return 'image/webp';
  return m.split(/[,;\s]/)[0] || 'image/jpeg';
}

async function main_AAAAA() {
  // Prompt for both inputs first so connection logs don't overwrite the prompts
  const pkInput_AAAAA = await ask_AAAAA('helloworldjunktest.photos table PK number input: ');
  const photosId_AAAAA = parseInt(pkInput_AAAAA, 10);
  if (Number.isNaN(photosId_AAAAA) || photosId_AAAAA < 1) {
    console.error('Invalid PK: must be a positive integer.');
    rl_AAAAA.close();
    process.exit(1);
  }

  const urlInput_AAAAA = await ask_AAAAA('Image URL (e.g. https://i.pravatar.cc/150?img=20): ');
  const url_AAAAA = urlInput_AAAAA.trim();
  if (!url_AAAAA) {
    console.error('URL is required.');
    rl_AAAAA.close();
    process.exit(1);
  }

  rl_AAAAA.close();

  // Load DB only after prompts so "Connected to PostgreSQL" etc. don't mix with prompts
  const { default: pool } = await import('../db/connection.js');

  let buffer_AAAAA;
  let contentType_AAAAA = 'image/jpeg';
  try {
    const res_AAAAA = await fetch(url_AAAAA);
    if (!res_AAAAA.ok) throw new Error(`HTTP ${res_AAAAA.status}: ${res_AAAAA.statusText}`);
    const contentTypeHeader_AAAAA = res_AAAAA.headers.get('content-type');
    contentType_AAAAA = toContentType_AAAAA(contentTypeHeader_AAAAA);
    const arrayBuffer_AAAAA = await res_AAAAA.arrayBuffer();
    buffer_AAAAA = Buffer.from(arrayBuffer_AAAAA);
  } catch (err_AAAAA) {
    console.error('Failed to download image:', err_AAAAA.message);
    process.exit(1);
  }

  try {
    await pool.query(
      `INSERT INTO helloworldjunktest.photos (photos_id, image_data, content_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (photos_id) DO UPDATE SET image_data = EXCLUDED.image_data, content_type = EXCLUDED.content_type`,
      [photosId_AAAAA, buffer_AAAAA, contentType_AAAAA]
    );
    console.log('Inserted/updated helloworldjunktest.photos row with photos_id =', photosId_AAAAA);
  } catch (err_AAAAA) {
    console.error('DB insert failed:', err_AAAAA.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main_AAAAA();
