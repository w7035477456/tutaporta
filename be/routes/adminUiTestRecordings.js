import pool from '../db/connection.js';
import { appendFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'helloworldjunktest';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOME_DIR = String(process.env.HOME ?? '').trim();
const TEST_RESULT_DIR = HOME_DIR
  ? path.resolve(HOME_DIR, 'code/main/be/logs')
  : path.resolve(__dirname, '../logs');
const TEST_RESULT_FILE = path.join(
  TEST_RESULT_DIR,
  `TEST_result_${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_')}.log`
);
const runMemoryTracker = new Map();
const TEST_RESULT_PREFIX = 'TEST_result_';
const TEST_RESULT_SUFFIX = '.log';

function resolveRecordingSinglesId(req) {
  const fromAuth = Number(req.auth?.singles_id);
  return Number.isFinite(fromAuth) && fromAuth > 0 ? fromAuth : 0;
}

/** Any active recording — shared across authenticated sessions. */
async function getActiveAdminRecording(client, recordingId) {
  const result = await client.query(
    `SELECT *
     FROM ${SCHEMA}.ui_test_recordings
     WHERE recording_id = $1 AND is_active = TRUE`,
    [recordingId]
  );
  return result.rows[0] ?? null;
}

/** Sync recording.run_status from active rows in ui_test_recording_runs. */
async function syncRecordingRunStatus(client, recordingId) {
  await client.query(
    `UPDATE ${SCHEMA}.ui_test_recordings r
     SET run_status = CASE
           WHEN EXISTS (
             SELECT 1
             FROM ${SCHEMA}.ui_test_recording_runs u
             WHERE u.recording_id = r.recording_id AND u.status = 'running'
           ) THEN 'running'
           ELSE 'idle'
         END,
         last_run_stopped_at = CASE
           WHEN EXISTS (
             SELECT 1
             FROM ${SCHEMA}.ui_test_recording_runs u
             WHERE u.recording_id = r.recording_id AND u.status = 'running'
           ) THEN r.last_run_stopped_at
           ELSE NOW()
         END
     WHERE r.recording_id = $1 AND r.is_active = TRUE`,
    [recordingId]
  );
}

function mapRecordingRow(row) {
  if (!row) return null;
  return {
    recordingId: Number(row.recording_id),
    singlesId: Number(row.singles_id),
    name: row.name,
    loopCount: Number(row.loop_count ?? 0),
    stepsCount: Number(row.steps_count ?? 0),
    durationSeconds: Number(row.duration_seconds ?? 0),
    stepIntervalMs: Number(row.step_interval_ms ?? 5000),
    targetPath: row.target_path ?? null,
    viewportWidth: row.viewport_width ?? null,
    viewportHeight: row.viewport_height ?? null,
    runStatus: row.run_status,
    recordStatus: row.record_status,
    isActive: row.is_active !== false,
    recordingStartedAt: row.recording_started_at,
    recordingStoppedAt: row.recording_stopped_at,
    lastRunStartedAt: row.last_run_started_at,
    lastRunStoppedAt: row.last_run_stopped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function readMemorySnapshotMb() {
  const mem = process.memoryUsage?.();
  if (!mem) return null;
  const toMb = (bytes) => Math.round((Number(bytes || 0) / (1024 * 1024)) * 100) / 100;
  return {
    rssMb: toMb(mem.rss),
    heapTotalMb: toMb(mem.heapTotal),
    heapUsedMb: toMb(mem.heapUsed),
    externalMb: toMb(mem.external),
    arrayBuffersMb: toMb(mem.arrayBuffers)
  };
}

function formatTimestampEt(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(d);
  const pick = (type) => fmt.find((p) => p.type === type)?.value ?? '';
  const month = pick('month');
  const day = pick('day');
  const year = pick('year');
  const hour = pick('hour');
  const minute = pick('minute');
  const dayPeriod = (pick('dayPeriod') || '').toLowerCase();
  return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod} ET`;
}

function assessLeakForRun(runId, memorySnapshotMb, loopCount = null) {
  if (!Number.isFinite(runId) || runId < 1 || !memorySnapshotMb) {
    return { leakStatus: 'No leak detected', leakDetected: false, leakDetail: 'insufficient data' };
  }
  const heapUsedMb = Number(memorySnapshotMb.heapUsedMb ?? 0);
  const rssMb = Number(memorySnapshotMb.rssMb ?? 0);
  const prior = runMemoryTracker.get(runId);
  if (!prior) {
    runMemoryTracker.set(runId, {
      baselineHeapUsedMb: heapUsedMb,
      baselineRssMb: rssMb,
      maxHeapUsedMb: heapUsedMb,
      maxRssMb: rssMb,
      lastLoopCount: Number.isFinite(loopCount) ? loopCount : null
    });
    return { leakStatus: 'No leak detected', leakDetected: false, leakDetail: 'baseline established' };
  }

  prior.maxHeapUsedMb = Math.max(Number(prior.maxHeapUsedMb || 0), heapUsedMb);
  prior.maxRssMb = Math.max(Number(prior.maxRssMb || 0), rssMb);
  prior.lastLoopCount = Number.isFinite(loopCount) ? loopCount : prior.lastLoopCount;
  runMemoryTracker.set(runId, prior);

  const heapGrowthMb = Number((prior.maxHeapUsedMb - Number(prior.baselineHeapUsedMb || 0)).toFixed(2));
  const rssGrowthMb = Number((prior.maxRssMb - Number(prior.baselineRssMb || 0)).toFixed(2));
  const leakDetected = heapGrowthMb >= 40 || rssGrowthMb >= 80;
  return {
    leakStatus: leakDetected ? 'Leak detected' : 'No leak detected',
    leakDetected,
    leakDetail: `heap+${heapGrowthMb}MB rss+${rssGrowthMb}MB`
  };
}

async function appendUiTestLoopLog(entry) {
  try {
    await mkdir(TEST_RESULT_DIR, { recursive: true });
    const now = new Date();
    const timestamp = now.toISOString();
    const timestampHuman = formatTimestampEt(now);
    const leakStatus = entry?.leakStatus;
    const { leakStatus: _ignoredLeakStatus, ...entryWithoutLeakStatus } = entry ?? {};
    const row = leakStatus == null
      ? { timestamp, timestampHuman, ...entryWithoutLeakStatus }
      : { timestamp, leakStatus, timestampHuman, ...entryWithoutLeakStatus };
    await appendFile(TEST_RESULT_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  } catch (err) {
    console.error('[appendUiTestLoopLog] failed:', err?.message ?? err);
  }
}

async function appendUiTestRunEndLog(entry) {
  try {
    await mkdir(TEST_RESULT_DIR, { recursive: true });
    const now = new Date();
    const row = {
      timestamp: now.toISOString(),
      timestampHuman: formatTimestampEt(now),
      ...entry
    };
    await appendFile(TEST_RESULT_FILE, `${JSON.stringify(row)}\n`, 'utf8');
  } catch (err) {
    console.error('[appendUiTestRunEndLog] failed:', err?.message ?? err);
  }
}

async function listTestResultFilesNewestFirst() {
  try {
    const names = await readdir(TEST_RESULT_DIR);
    return names
      .filter((name) => name.startsWith(TEST_RESULT_PREFIX) && name.endsWith(TEST_RESULT_SUFFIX))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

function parseLogLines(raw) {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
}

function mapStepRow(row) {
  return {
    stepId: Number(row.step_id),
    recordingId: Number(row.recording_id),
    stepOrder: Number(row.step_order),
    actionType: row.action_type,
    selector: row.selector,
    selectorFallback: row.selector_fallback,
    x: row.x == null ? null : Number(row.x),
    y: row.y == null ? null : Number(row.y),
    valueText: row.value_text,
    valueJson: row.value_json,
    delayMs: Number(row.delay_ms ?? 5000)
  };
}

function parseRunStartOptions(body) {
  const durationRaw = body?.durationMinutes ?? body?.duration_minutes ?? body?.duration;
  const durationTrim = durationRaw == null ? '' : String(durationRaw).trim();
  let replayMode = 'infinite';
  let requestedMinutes = null;
  if (durationTrim && durationTrim.toLowerCase() !== 'infinite') {
    const mins = Number(durationTrim);
    if (Number.isFinite(mins) && mins > 0) {
      replayMode = 'duration';
      requestedMinutes = Math.trunc(mins);
    }
  }

  const delayRaw = body?.delaySec ?? body?.delay_sec ?? body?.delay;
  const delaySec = Math.max(1, Math.round(Number(delayRaw ?? 5)));
  const stepIntervalMs = Number.isFinite(delaySec) ? delaySec * 1000 : 5000;

  return { replayMode, requestedMinutes, stepIntervalMs };
}

function normalizeStepsPayload(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((step, index) => {
      const actionType = String(step?.actionType ?? step?.action_type ?? 'click').trim().toLowerCase();
      const delayMs = Number(step?.delayMs ?? step?.delay_ms ?? 5000);
      return {
        stepOrder: Number(step?.stepOrder ?? step?.step_order ?? index + 1),
        actionType: actionType || 'click',
        selector: step?.selector ? String(step.selector).trim() : null,
        selectorFallback: step?.selectorFallback ?? step?.selector_fallback
          ? String(step.selectorFallback ?? step.selector_fallback).trim()
          : null,
        x: step?.x == null ? null : Math.round(Number(step.x)),
        y: step?.y == null ? null : Math.round(Number(step.y)),
        valueText: step?.valueText ?? step?.value_text ?? null,
        valueJson: step?.valueJson ?? step?.value_json ?? null,
        delayMs: Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 5000
      };
    })
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step, index) => ({ ...step, stepOrder: index + 1 }));
}

/**
 * GET /api/admin/ui-test-recordings
 */
export async function listGraphicalTestRecordings(req, res) {
  try {
    const result = await pool.query(
      `SELECT *
       FROM ${SCHEMA}.ui_test_recordings
       WHERE is_active = TRUE
       ORDER BY recording_id ASC`
    );
    return res.json({ recordings: result.rows.map(mapRecordingRow) });
  } catch (err) {
    console.error('[listGraphicalTestRecordings]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to list UI test recordings' });
  }
}

/**
 * POST /api/admin/ui-test-recordings
 * Body: { name? }
 */
export async function createGraphicalTestRecording(req, res) {
  const singlesId = resolveRecordingSinglesId(req);
  if (!singlesId) return res.status(401).json({ error: 'Authentication required' });

  const name = String(req.body?.name ?? 'New test').trim() || 'New test';

  try {
    const result = await pool.query(
      `INSERT INTO ${SCHEMA}.ui_test_recordings (singles_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [singlesId, name]
    );
    return res.status(201).json({ recording: mapRecordingRow(result.rows[0]) });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'A recording with this name already exists' });
    }
    console.error('[createGraphicalTestRecording]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to create recording' });
  }
}

/**
 * PATCH /api/admin/ui-test-recordings/:recordingId
 * Body: { name? }
 */
export async function patchGraphicalTestRecording(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  const name = req.body?.name != null ? String(req.body.name).trim() : null;
  if (name != null && !name) return res.status(400).json({ error: 'Name cannot be empty' });

  try {
    if (name == null) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const result = await pool.query(
      `UPDATE ${SCHEMA}.ui_test_recordings
       SET name = $2
       WHERE recording_id = $1 AND is_active = TRUE
       RETURNING *`,
      [recordingId, name]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Recording not found' });
    return res.json({ recording: mapRecordingRow(result.rows[0]) });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'A recording with this name already exists' });
    }
    console.error('[patchGraphicalTestRecording]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update recording' });
  }
}

/**
 * DELETE /api/admin/ui-test-recordings/:recordingId
 */
export async function deleteGraphicalTestRecording(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE ${SCHEMA}.ui_test_recording_runs
         SET status = 'stopped', finished_at = NOW()
         WHERE recording_id = $1 AND status = 'running'`,
        [recordingId]
      );
      const result = await client.query(
        `UPDATE ${SCHEMA}.ui_test_recordings
         SET is_active = FALSE, run_status = 'idle', record_status = 'idle'
         WHERE recording_id = $1 AND is_active = TRUE
         RETURNING recording_id`,
        [recordingId]
      );
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Recording not found' });
      }
      await client.query('COMMIT');
      return res.status(204).send();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[deleteGraphicalTestRecording]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to delete recording' });
  }
}

/**
 * POST /api/admin/ui-test-recordings/:recordingId/loop/reset
 */
export async function postGraphicalTestRecordingResetLoop(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  try {
    const result = await pool.query(
      `UPDATE ${SCHEMA}.ui_test_recordings
       SET loop_count = 0
       WHERE recording_id = $1 AND is_active = TRUE
       RETURNING *`,
      [recordingId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Recording not found' });
    return res.json({ recording: mapRecordingRow(result.rows[0]) });
  } catch (err) {
    console.error('[postGraphicalTestRecordingResetLoop]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to reset loop count' });
  }
}

/**
 * GET /api/admin/ui-test-recordings/:recordingId/steps
 */
export async function getGraphicalTestRecordingSteps(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  try {
    const owned = await getActiveAdminRecording(pool, recordingId);
    if (!owned) return res.status(404).json({ error: 'Recording not found' });

    const stepsResult = await pool.query(
      `SELECT *
       FROM ${SCHEMA}.ui_test_recording_steps
       WHERE recording_id = $1
       ORDER BY step_order ASC`,
      [recordingId]
    );
    return res.json({
      recording: mapRecordingRow(owned),
      steps: stepsResult.rows.map(mapStepRow)
    });
  } catch (err) {
    console.error('[getGraphicalTestRecordingSteps]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load recording steps' });
  }
}

/**
 * POST /api/admin/ui-test-recordings/:recordingId/record/start
 */
export async function postGraphicalTestRecordingStart(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE ${SCHEMA}.ui_test_recordings
       SET record_status = 'recording',
           run_status = 'idle',
           recording_started_at = NOW(),
           recording_stopped_at = NULL
       WHERE recording_id = $1 AND is_active = TRUE
       RETURNING *`,
      [recordingId]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recording not found' });
    }
    await client.query('COMMIT');
    return res.json({ recording: mapRecordingRow(result.rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[postGraphicalTestRecordingStart]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to start recording' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/ui-test-recordings/:recordingId/record/stop
 * Body: { steps, durationSeconds, targetPath?, viewportWidth?, viewportHeight? }
 */
export async function postGraphicalTestRecordingStop(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  const steps = normalizeStepsPayload(req.body?.steps);
  const durationSeconds = Math.max(0, Math.round(Number(req.body?.durationSeconds ?? req.body?.duration_seconds ?? 0)));
  const targetPath = req.body?.targetPath ?? req.body?.target_path ?? null;
  const viewportWidth = req.body?.viewportWidth ?? req.body?.viewport_width ?? null;
  const viewportHeight = req.body?.viewportHeight ?? req.body?.viewport_height ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owned = await getActiveAdminRecording(client, recordingId);
    if (!owned) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recording not found' });
    }

    await client.query(`DELETE FROM ${SCHEMA}.ui_test_recording_steps WHERE recording_id = $1`, [recordingId]);

    for (const step of steps) {
      await client.query(
        `INSERT INTO ${SCHEMA}.ui_test_recording_steps (
           recording_id, step_order, action_type, selector, selector_fallback,
           x, y, value_text, value_json, delay_ms
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          recordingId,
          step.stepOrder,
          step.actionType,
          step.selector,
          step.selectorFallback,
          step.x,
          step.y,
          step.valueText,
          step.valueJson ? JSON.stringify(step.valueJson) : null,
          step.delayMs
        ]
      );
    }

    const updateResult = await client.query(
      `UPDATE ${SCHEMA}.ui_test_recordings
       SET record_status = 'idle',
           recording_stopped_at = NOW(),
           steps_count = $2,
           duration_seconds = $3,
           target_path = COALESCE($4, target_path),
           viewport_width = COALESCE($5, viewport_width),
           viewport_height = COALESCE($6, viewport_height)
       WHERE recording_id = $1
       RETURNING *`,
      [recordingId, steps.length, durationSeconds, targetPath, viewportWidth, viewportHeight]
    );

    await client.query('COMMIT');
    return res.json({
      recording: mapRecordingRow(updateResult.rows[0]),
      steps: steps.map((s, i) => ({ ...s, recordingId, stepId: i + 1 }))
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[postGraphicalTestRecordingStop]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to save recording' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/ui-test-recordings/:recordingId/run/start
 */
export async function postGraphicalTestRunStart(req, res) {
  const singlesId = resolveRecordingSinglesId(req);
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  if (!Number.isFinite(recordingId) || recordingId < 1) {
    return res.status(400).json({ error: 'Invalid recording id' });
  }

  const { replayMode, requestedMinutes, stepIntervalMs } = parseRunStartOptions(req.body ?? {});

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const owned = await getActiveAdminRecording(client, recordingId);
    if (!owned) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recording not found' });
    }

    const stepsResult = await client.query(
      `SELECT * FROM ${SCHEMA}.ui_test_recording_steps WHERE recording_id = $1 ORDER BY step_order ASC`,
      [recordingId]
    );
    if (!stepsResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No steps recorded yet' });
    }

    const runInsert = await client.query(
      `INSERT INTO ${SCHEMA}.ui_test_recording_runs (
         recording_id, singles_id, replay_mode, requested_minutes, status
       ) VALUES ($1, $2, $3, $4, 'running')
       RETURNING run_id`,
      [recordingId, singlesId > 0 ? singlesId : owned.singles_id, replayMode, requestedMinutes]
    );

    await client.query(
      `UPDATE ${SCHEMA}.ui_test_recordings
       SET record_status = 'idle',
           step_interval_ms = $2,
           last_run_started_at = NOW(),
           last_run_stopped_at = NULL
       WHERE recording_id = $1`,
      [recordingId, stepIntervalMs]
    );
    await syncRecordingRunStatus(client, recordingId);

    const updateResult = await client.query(
      `SELECT * FROM ${SCHEMA}.ui_test_recordings WHERE recording_id = $1`,
      [recordingId]
    );

    await client.query('COMMIT');
    return res.json({
      recording: mapRecordingRow(updateResult.rows[0]),
      steps: stepsResult.rows.map(mapStepRow),
      runId: Number(runInsert.rows[0]?.run_id),
      replayMode,
      requestedMinutes,
      stepIntervalMs
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[postGraphicalTestRunStart]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to start replay' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/ui-test-recordings/:recordingId/run/stop
 */
export async function postGraphicalTestRunStop(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  const runId = Number(req.body?.runId ?? req.body?.run_id);
  const endReason = String(req.body?.endReason ?? req.body?.end_reason ?? 'manual').trim().toLowerCase();
  const endError = String(req.body?.endError ?? req.body?.end_error ?? '').trim() || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const owned = await getActiveAdminRecording(client, recordingId);
    if (!owned) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (Number.isFinite(runId) && runId > 0) {
      await client.query(
        `UPDATE ${SCHEMA}.ui_test_recording_runs
         SET status = 'stopped', finished_at = NOW()
         WHERE run_id = $1 AND recording_id = $2 AND status = 'running'`,
        [runId, recordingId]
      );
    } else {
      await client.query(
        `UPDATE ${SCHEMA}.ui_test_recording_runs
         SET status = 'stopped', finished_at = NOW()
         WHERE recording_id = $1 AND status = 'running'`,
        [recordingId]
      );
    }

    await syncRecordingRunStatus(client, recordingId);

    const result = await client.query(
      `SELECT * FROM ${SCHEMA}.ui_test_recordings WHERE recording_id = $1`,
      [recordingId]
    );

    const recording = mapRecordingRow(result.rows[0]);
    const memorySnapshotMb = readMemorySnapshotMb();
    const endedAt = new Date().toISOString();
    const endedAtHuman = formatTimestampEt(endedAt);
    const runSummary = {
      event: 'run_end',
      endedAt,
      endedAtHuman,
      recordingId,
      runId: Number.isFinite(runId) && runId > 0 ? runId : null,
      endReason,
      endError,
      loopCount: recording?.loopCount ?? null,
      runStatus: recording?.runStatus ?? null,
      memorySnapshotMb
    };
    const leakScan = assessLeakForRun(runSummary.runId, memorySnapshotMb, runSummary.loopCount);
    runSummary.leakStatus = leakScan.leakStatus;
    runSummary.leakDetected = leakScan.leakDetected;
    runSummary.leakDetail = leakScan.leakDetail;
    await appendUiTestRunEndLog(runSummary);
    if (Number.isFinite(runSummary.runId) && runSummary.runId > 0) {
      runMemoryTracker.delete(runSummary.runId);
    }
    console.info('[postGraphicalTestRunStop] run end', {
      ...runSummary,
      logFile: TEST_RESULT_FILE
    });

    await client.query('COMMIT');
    return res.json({ recording, runSummary, logFile: TEST_RESULT_FILE });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[postGraphicalTestRunStop]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to stop replay' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/admin/ui-test-recordings/:recordingId/run/loop-complete
 */
export async function postGraphicalTestRunLoopComplete(req, res) {
  const recordingId = Number.parseInt(req.params.recordingId, 10);
  const runId = Number(req.body?.runId ?? req.body?.run_id);

  if (!Number.isFinite(runId) || runId < 1) {
    return res.status(400).json({ error: 'runId is required' });
  }

  try {
    const runResult = await pool.query(
      `UPDATE ${SCHEMA}.ui_test_recording_runs
       SET loops_completed = loops_completed + 1
       WHERE run_id = $1 AND recording_id = $2 AND status = 'running'
       RETURNING run_id`,
      [runId, recordingId]
    );
    if (!runResult.rows.length) {
      return res.status(404).json({ error: 'Run not found or not running' });
    }

    const result = await pool.query(
      `UPDATE ${SCHEMA}.ui_test_recordings
       SET loop_count = loop_count + 1
       WHERE recording_id = $1 AND is_active = TRUE
       RETURNING *`,
      [recordingId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Recording not found' });

    const recording = mapRecordingRow(result.rows[0]);
    const memorySnapshotMb = readMemorySnapshotMb();
    const loopLeakScan = assessLeakForRun(runId, memorySnapshotMb, recording?.loopCount);
    await appendUiTestLoopLog({
      event: 'loop_complete',
      recordingId,
      runId,
      loopCount: recording?.loopCount,
      memorySnapshotMb,
      ...loopLeakScan
    });
    console.info('[postGraphicalTestRunLoopComplete] loop complete', {
      recordingId,
      runId,
      loopCount: recording?.loopCount,
      memorySnapshotMb,
      logFile: TEST_RESULT_FILE
    });

    const loopSummary = {
      event: 'loop_complete',
      endedAt: new Date().toISOString(),
      endedAtHuman: formatTimestampEt(),
      recordingId,
      runId,
      loopCount: recording?.loopCount ?? null,
      memorySnapshotMb
    };
    loopSummary.leakStatus = loopLeakScan.leakStatus;
    loopSummary.leakDetected = loopLeakScan.leakDetected;
    loopSummary.leakDetail = loopLeakScan.leakDetail;
    return res.json({ recording, memorySnapshotMb, loopSummary, logFile: TEST_RESULT_FILE });
  } catch (err) {
    console.error('[postGraphicalTestRunLoopComplete]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update loop count' });
  }
}

/**
 * GET /api/admin/ui-test-recordings/logs
 */
export async function getGraphicalTestLogs(_req, res) {
  try {
    const files = await listTestResultFilesNewestFirst();
    if (!files.length) {
      return res.json({
        logFile: null,
        filesCount: 0,
        entries: []
      });
    }
    const newest = files[0];
    const newestPath = path.join(TEST_RESULT_DIR, newest);
    const raw = await readFile(newestPath, 'utf8');
    const entries = parseLogLines(raw);
    return res.json({
      logFile: newestPath,
      filesCount: files.length,
      entries
    });
  } catch (err) {
    console.error('[getGraphicalTestLogs]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to read UI test logs' });
  }
}

/**
 * POST /api/admin/ui-test-recordings/logs/reset
 */
export async function postGraphicalTestLogsReset(_req, res) {
  try {
    await mkdir(TEST_RESULT_DIR, { recursive: true });
    const files = await listTestResultFilesNewestFirst();
    const deleted = [];
    for (const name of files) {
      const filePath = path.join(TEST_RESULT_DIR, name);
      await unlink(filePath);
      deleted.push(filePath);
    }
    runMemoryTracker.clear();
    return res.json({
      success: true,
      deletedCount: deleted.length,
      deletedFiles: deleted
    });
  } catch (err) {
    console.error('[postGraphicalTestLogsReset]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to reset UI test logs' });
  }
}
