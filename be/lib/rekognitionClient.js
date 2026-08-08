import {
  RekognitionClient,
  CompareFacesCommand,
  DetectFacesCommand,
  DetectTextCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand
} from '@aws-sdk/client-rekognition';

let cachedClient;

export function getRekognitionConfig() {
  const region = String(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1').trim();
  const enabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.REKOGNITION_ENABLED ?? 'true').trim().toLowerCase());
  const faceMatchThreshold = Math.min(
    100,
    Math.max(0, Number.parseFloat(String(process.env.REKOGNITION_FACE_MATCH_THRESHOLD ?? '90')) || 90)
  );
  const livenessMinConfidence = Math.min(
    100,
    Math.max(0, Number.parseFloat(String(process.env.REKOGNITION_LIVENESS_MIN_CONFIDENCE ?? '90')) || 90)
  );
  const requireLiveness = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.REKOGNITION_REQUIRE_LIVENESS ?? 'true').trim().toLowerCase()
  );
  const skipLiveFaceScan = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.SKIP_LIVE_FACE_SCAN ?? 'false').trim().toLowerCase()
  );
  const skipDlPassportCheck = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.SKIP_DL_PASSPORT_CHECK ?? 'false').trim().toLowerCase()
  );
  const identityPoolId = String(process.env.REKOGNITION_COGNITO_IDENTITY_POOL_ID ?? '').trim();
  const rekognitionDebugUi = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.REKOGNITION_DEBUG_UI ?? '').trim().toLowerCase()
  );
  const liveScanCooldownMinutes = parseLiveScanCooldownMinutes(process.env);
  return {
    enabled,
    region,
    faceMatchThreshold,
    livenessMinConfidence,
    requireLiveness,
    skipLiveFaceScan,
    skipDlPassportCheck,
    identityPoolId: identityPoolId || null,
    livenessConfigured: Boolean(identityPoolId),
    rekognitionDebugUi,
    liveScanCooldownMinutes
  };
}

/** Minutes to wait before a new liveness scan after FAIL (`LIVE_SCAN_COOLDOWN`). Default 5. */
export function parseLiveScanCooldownMinutes(env = process.env) {
  const raw = String(env.LIVE_SCAN_COOLDOWN ?? '').trim();
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 5;
  return parsed;
}

/** Whether Identification Search must run AWS face liveness before final verify. */
export function isLivenessEnforcedForVerification(cfg = getRekognitionConfig()) {
  return Boolean(cfg.requireLiveness && cfg.livenessConfigured && !cfg.skipLiveFaceScan);
}

function formatLivenessConfidenceBelowMinimumMessage(confidence, min) {
  const pct = Number(confidence);
  const display = Number.isFinite(pct) ? pct.toFixed(1) : '?';
  const minDisplay = Number.isFinite(Number(min)) ? Math.round(Number(min)) : 90;
  return `Confident ${display}% is below minimum ${minDisplay}%. Please try again or contact Support`;
}

/** @param {{ status?: string|null, confidence?: number|null }} results */
export function evaluateLivenessSession(results, minConfidence) {
  const statusRaw = results?.status ?? null;
  const statusNormalized = String(statusRaw || '').trim().toUpperCase() || null;
  const confidence = Number(results?.confidence);
  const min = Number(minConfidence);
  const statusOk = statusNormalized === 'SUCCEEDED';
  const confidenceOk = Number.isFinite(confidence) && confidence >= min;
  const passed = statusOk && confidenceOk;

  let passFailLabel = 'FAIL';
  let passFailReason = '';
  if (!statusNormalized) {
    passFailReason = 'No status from liveness session yet. Finish the video check, wait a few seconds, then tap “Check liveness status”.';
  } else if (!statusOk) {
    passFailReason = `Status is "${statusRaw}" (required: SUCCEEDED). Start a new scan and complete the full video check.`;
  } else if (!Number.isFinite(confidence)) {
    passFailLabel = 'FAIL';
    passFailReason = 'Status SUCCEEDED but confidence score is not available yet. Wait a few seconds and try again.';
  } else if (!confidenceOk) {
    passFailLabel = 'FAIL';
    passFailReason = formatLivenessConfidenceBelowMinimumMessage(confidence, min);
  } else {
    passFailLabel = 'PASS';
    passFailReason = `Status SUCCEEDED and confidence ${confidence}% ≥ minimum ${min}%.`;
  }

  return {
    passed,
    passFailLabel,
    passFailReason,
    statusRaw,
    statusNormalized,
    confidence: Number.isFinite(confidence) ? confidence : null,
    minConfidenceRequired: min
  };
}

export function isRekognitionConfigured() {
  const cfg = getRekognitionConfig();
  return cfg.enabled;
}

function getClient() {
  if (cachedClient) return cachedClient;
  const { region } = getRekognitionConfig();
  cachedClient = new RekognitionClient({ region });
  return cachedClient;
}

export async function compareFaces(sourceBytes, targetBytes, similarityThreshold) {
  const client = getClient();
  const response = await client.send(
    new CompareFacesCommand({
      SourceImage: { Bytes: sourceBytes },
      TargetImage: { Bytes: targetBytes },
      SimilarityThreshold: similarityThreshold
    })
  );
  const best = (response.FaceMatches || [])[0];
  return {
    matched: Boolean(best),
    similarity: best?.Similarity ?? null,
    unmatchedFaces: response.UnmatchedFaces?.length ?? 0
  };
}

export async function detectSingleFace(bytes) {
  const client = getClient();
  const response = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: bytes },
      Attributes: []
    })
  );
  const faces = response.FaceDetails || [];
  return { faceCount: faces.length, faces };
}

export async function detectTextDetections(bytes) {
  const client = getClient();
  const response = await client.send(
    new DetectTextCommand({
      Image: { Bytes: bytes }
    })
  );
  const detections = response.TextDetections || [];
  const lines = detections
    .filter((item) => item.Type === 'LINE' && item.DetectedText)
    .map((item) => String(item.DetectedText).trim())
    .filter(Boolean);
  return { lines, detections };
}

export async function detectTextLines(bytes) {
  const { lines } = await detectTextDetections(bytes);
  return lines;
}

export async function createFaceLivenessSession() {
  const client = getClient();
  const response = await client.send(new CreateFaceLivenessSessionCommand({}));
  return {
    sessionId: response.SessionId ?? null
  };
}

export async function getFaceLivenessSessionResults(sessionId) {
  const client = getClient();
  const response = await client.send(
    new GetFaceLivenessSessionResultsCommand({
      SessionId: sessionId
    })
  );
  return {
    status: response.Status ?? null,
    confidence: response.Confidence ?? null,
    referenceImageBytes: response.ReferenceImage?.Bytes ?? null
  };
}
