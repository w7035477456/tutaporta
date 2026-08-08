import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';

function digErrorField(obj, field, depth = 0) {
  if (!obj || depth > 5) return '';
  if (typeof obj === 'string') return '';
  const direct = obj[field];
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const nested = obj.error || obj.cause || obj.originalError;
  if (nested && nested !== obj) return digErrorField(nested, field, depth + 1);
  return '';
}

function collectErrorText(obj, depth = 0, out = []) {
  if (!obj || depth > 6) return out;
  if (typeof obj === 'string') {
    if (obj.trim()) out.push(obj.trim());
    return out;
  }
  if (typeof obj !== 'object') return out;
  for (const key of ['message', 'Message', 'errorMessage', 'errorDescription']) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  const response = obj.$response;
  if (response?.body && typeof response.body === 'string' && response.body.trim()) {
    out.push(response.body.trim());
  }
  for (const next of [obj.error, obj.cause, obj.originalError]) {
    if (next && next !== obj) collectErrorText(next, depth + 1, out);
  }
  return out;
}

/** User-facing copy when liveness confidence is below the configured minimum. */
export function formatLivenessConfidenceBelowMinimumMessage(confidence, min = 90) {
  const pct = Number(confidence);
  const display = Number.isFinite(pct) ? pct.toFixed(1) : '?';
  const minDisplay = Number.isFinite(Number(min)) ? Math.round(Number(min)) : 90;
  return `Confident ${display}% is below minimum ${minDisplay}%. Please try again or contact Support`;
}

export function isLiveScanConfidenceBelowMinimumMessage(text) {
  return /^Confident\s+[\d.]+%\s+is below minimum/i.test(String(text ?? '').trim());
}

/** @returns {{ confidence: number, minConfidence: number|null }|null} */
export function parseLiveScanConfidenceMessage(text) {
  const raw = String(text ?? '').trim();
  const belowMatch = raw.match(/^Confident\s+([\d.]+)%\s+is below minimum\s+([\d.]+)%/i);
  if (belowMatch) {
    return {
      confidence: parseFloat(belowMatch[1]),
      minConfidence: parseFloat(belowMatch[2])
    };
  }
  const confidentMatch = raw.match(/^Confident\s+([\d.]+)%/i);
  if (confidentMatch) {
    return {
      confidence: parseFloat(confidentMatch[1]),
      minConfidence: null
    };
  }
  return null;
}

export function isLiveScanConfidenceMessage(text) {
  return /^Confident\s+[\d.]+%/i.test(String(text ?? '').trim());
}

/** Map live scan / liveness API errors to user-facing copy. */
export function formatLiveFaceScanUserError(err, defaultMin = 90) {
  const apiError = err?.response?.data?.error;
  if (typeof apiError === 'string' && apiError.trim()) {
    const trimmed = apiError.trim();
    const confidenceMatch = trimmed.match(/confidence\s+([\d.]+)%\s+is below minimum\s+([\d.]+)%/i);
    if (confidenceMatch) {
      return formatLivenessConfidenceBelowMinimumMessage(
        parseFloat(confidenceMatch[1]),
        parseFloat(confidenceMatch[2])
      );
    }
    if (/^Confident\s+[\d.]+%\s+is below minimum/i.test(trimmed)) {
      return trimmed;
    }
    return sanitizeUserFacingTechTerms(trimmed);
  }

  const raw = String(err?.message || '').trim();
  const prefixed = raw.match(/confidence\s+([\d.]+)%\s+is below minimum\s+([\d.]+)%/i);
  if (prefixed) {
    return formatLivenessConfidenceBelowMinimumMessage(
      parseFloat(prefixed[1]),
      parseFloat(prefixed[2])
    );
  }
  if (/^Confident\s+[\d.]+%\s+is below minimum/i.test(raw)) {
    return raw;
  }
  if (raw.startsWith('Face liveness:')) {
    const reason = raw.split('—').slice(1).join('—').trim();
    if (reason) return formatLiveFaceScanUserError({ message: reason }, defaultMin);
  }

  const checkResult = err?.checkResult;
  if (
    checkResult?.confidence != null &&
    checkResult?.minConfidenceRequired != null &&
    Number(checkResult.confidence) < Number(checkResult.minConfidenceRequired)
  ) {
    return formatLivenessConfidenceBelowMinimumMessage(
      checkResult.confidence,
      checkResult.minConfidenceRequired
    );
  }
  if (checkResult?.passFailReason) {
    return formatLiveFaceScanUserError({ message: checkResult.passFailReason }, defaultMin);
  }

  return sanitizeUserFacingTechTerms(raw || 'Live face scan failed. Please try again or contact Support');
}

/** @param {unknown} event Amplify FaceLivenessDetector onError payload */
export function parseLivenessDetectorError(event) {
  const root = event && typeof event === 'object' ? event : { message: String(event || '') };
  const nested = root.error && typeof root.error === 'object' ? root.error : null;
  const errObj = nested || root;
  const name = digErrorField(errObj, 'name') || digErrorField(errObj, '__type') || digErrorField(root, 'name');
  const state = String(root.state || digErrorField(errObj, 'state') || '').trim().toUpperCase();
  const parts = collectErrorText(errObj).concat(collectErrorText(root));
  let message = parts.join(' ').replace(/^undefined\s+/i, '').trim();

  const combined = `${name} ${message}`.toLowerCase();

  if (
    name === 'SessionNotFoundException' ||
    combined.includes('session not found') ||
    (combined.includes('deserialization') && combined.includes('session'))
  ) {
    return (
      'This liveness session has ended (sessions are single-use). Close this window and click Live Scan again to start a new scan.'
    );
  }

  if (combined.includes('deserialization error')) {
    return (
      'The camera widget could not read the liveness service response (common after the scan finishes). If verification already passed, you can close this window.'
    );
  }

  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes('session not found') || lower.includes('invalid parameters')) {
      return (
        'This liveness scan session is no longer valid (sessions are single-use). Close this window and click Live Scan again to start a new scan.'
      );
    }
    if (lower.includes('access denied') || lower.includes('not authorized')) {
      return (
        'The site’s guest identity role cannot access face liveness. Unauthenticated access must be enabled ' +
        'on the Cognito identity pool and Rekognition Face Liveness permissions attached to that role.'
      );
    }
    if (lower.includes('server issue') || lower.includes('cannot complete check')) {
      return (
        'The live scan could not finish (the session may have expired). Click Start a new scan below, or close this window and click Live Scan again.'
      );
    }
    return sanitizeUserFacingTechTerms(message);
  }

  if (state === 'SERVER_ERROR' || state === 'CONNECTION_TIMEOUT') {
    return (
      'The face liveness service could not be reached, so the colored on-screen prompts never started. ' +
      'Check that REKOGNITION_COGNITO_IDENTITY_POOL_ID is set, unauthenticated access is enabled on that pool, ' +
      'the pool’s guest IAM role allows Rekognition Face Liveness, and AWS_REGION matches the pool region. ' +
      'Then click “Start a new scan”.'
    );
  }

  return 'Face liveness did not start. Click “Start a new scan” and try again.';
}

/** Widget errors that are harmless once the server already returned PASS. */
export function isBenignLivenessWidgetError(message, livenessAlreadyPassed) {
  if (livenessAlreadyPassed) return true;
  const lower = String(message || '').toLowerCase();
  return (
    lower.includes('session has ended') ||
    lower.includes('single-use') ||
    lower.includes('deserialization') ||
    lower.includes('session not found') ||
    lower.includes('scan finishes')
  );
}
