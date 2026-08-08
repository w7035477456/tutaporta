/** Show verbose identification-verification debug panel (dev or explicit env). */
export function isRekognitionDebugUiEnabled(statusFromApi) {
  if (statusFromApi?.rekognitionDebugUi === true) return true;
  const viteFlag = String(import.meta.env.VITE_REKOGNITION_DEBUG_UI || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(viteFlag)) return true;
  if (['0', 'false', 'no', 'off'].includes(viteFlag)) return false;
  return Boolean(import.meta.env.DEV);
}

export function formatDebugTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
