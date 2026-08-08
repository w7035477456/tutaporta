import sharp from 'sharp';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatConsentWatermarkDateLine(recordedAt, clientIp) {
  const date = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  const timeLabel = date
    .toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\sAM/i, 'am')
    .replace(/\sPM/i, 'pm');
  const ip = String(clientIp ?? 'unknown').trim() || 'unknown';
  return `${month} ${day} ${year} ${timeLabel} IP ${ip}`;
}

export function formatConsentWatermarkText(recordedAt, clientIp, titleLine = 'Self-Report-Biography') {
  return `${titleLine}\n${formatConsentWatermarkDateLine(recordedAt, clientIp)}`;
}

/**
 * Overlay diagonal consent watermark: white fill, colored border, 45° angle, 25% fill opacity.
 */
export async function watermarkConsentImageBuffer(
  inputBuffer,
  { clientIp, recordedAt = new Date(), titleLine = 'Self-Report-Biography', strokeColor = '#ff0000', strokeWidthRatio = 0.08 } = {}
) {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1200;
  const height = metadata.height || 800;
  const lines = formatConsentWatermarkText(recordedAt, clientIp, titleLine).split('\n');
  const fontSize = Math.max(28, Math.round(Math.min(width, height) / 14));
  const strokeWidth = Math.max(1, Math.round(fontSize * strokeWidthRatio));
  const lineHeight = Math.round(fontSize * 1.15);
  const lineSpans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="50%" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="50%"
        transform="rotate(-45 ${width / 2} ${height / 2})"
        fill="#ffffff"
        fill-opacity="0.25"
        stroke="${escapeXml(strokeColor)}"
        stroke-opacity="1"
        stroke-width="${strokeWidth}"
        stroke-linejoin="round"
        paint-order="stroke fill"
        font-size="${fontSize}"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="700"
        text-anchor="middle"
        dominant-baseline="middle"
      >${lineSpans}</text>
    </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
