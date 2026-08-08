/** Strip vendor/service names from text shown to end users. */
export function sanitizeUserFacingTechTerms(message) {
  if (message == null || message === '') return message;
  return String(message)
    .replace(/Amazon\s+Rekognition/gi, 'identity verification')
    .replace(/AWS\s+Rekognition/gi, 'identity verification')
    .replace(/\bRekognition\b/gi, 'identity verification')
    .replace(/\bAWS\b/g, 'the server')
    .replace(/REKOGNITION_[A-Z0-9_]+/gi, 'server settings')
    .replace(/VITE_REKOGNITION_[A-Z0-9_]+/gi, 'server settings')
    .replace(/\bAmazon\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
