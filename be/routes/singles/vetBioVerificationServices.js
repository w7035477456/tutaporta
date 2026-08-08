import { isAdminAuth, isAdminImpersonationSession } from '../../utils/adminAuth.js';
import {
  VERIFICATION_CHANNEL_COLUMNS,
  VERIFICATION_STATUS_VALUES,
  finalizeIdVerificationDateOnClose,
  loadVetBioVerificationServices,
  normalizeVerificationStatus,
  setVetBioVerificationStatus,
  verificationStatusLabel
} from '../../utils/vetBioVerificationServices.js';

const SERVICE_META = [
  {
    key: 'id',
    step: 1,
    label: 'Identification Search',
    column: 'id_verification',
    dateColumn: 'id_verification_date'
  },
  {
    key: 'work',
    step: 2,
    label: 'Work Email Domain Search',
    column: 'work_verification',
    dateColumn: 'work_verification_date'
  },
  {
    key: 'education',
    step: 3,
    label: 'Academic Record Search',
    column: 'education_verification',
    dateColumn: 'education_verification_date'
  },
  {
    key: 'linkedin',
    step: 4,
    label: 'LinkedIn Search',
    column: 'linkedin_verification',
    dateColumn: 'linkedin_verification_date'
  }
];

function buildServicesPayload(statusRow) {
  return SERVICE_META.map((meta) => {
    const status = normalizeVerificationStatus(statusRow?.[meta.column]);
    return {
      ...meta,
      status,
      statusLabel: verificationStatusLabel(status),
      verificationDate: statusRow?.[meta.dateColumn] ?? null
    };
  });
}

/**
 * GET /api/vet-bio/verification-services
 */
export async function getVetBioVerificationServices(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const statusRow = await loadVetBioVerificationServices(singlesId);
    return res.json({
      columnsAvailable: statusRow.columnsAvailable !== false,
      services: buildServicesPayload(statusRow)
    });
  } catch (error) {
    console.error('[vetBioVerificationServices:get]', error?.message || error);
    return res.status(500).json({ error: 'Failed to load verification services' });
  }
}

/**
 * PATCH /api/vet-bio/verification-services
 * Body: { id_verification?, work_verification?, education_verification?, linkedin_verification? }
 */
export async function patchVetBioVerificationServices(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isAdminAuth(req.auth)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const updates = [];
  for (const [key, column] of Object.entries(VERIFICATION_CHANNEL_COLUMNS)) {
    if (!Object.prototype.hasOwnProperty.call(body, column)) continue;
    const status = normalizeVerificationStatus(body[column]);
    if (!VERIFICATION_STATUS_VALUES.includes(status)) {
      return res.status(400).json({ error: `Invalid status for ${column}` });
    }
    updates.push({ key, status });
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No verification status fields provided' });
  }

  try {
    for (const { key, status } of updates) {
      const ok = await setVetBioVerificationStatus(singlesId, key, status);
      if (!ok) {
        return res.status(500).json({
          error: 'Verification status columns are not available on vet_bio. Run addVetBioVerificationStatusColumns.sql.'
        });
      }
    }

    const statusRow = await loadVetBioVerificationServices(singlesId);
    return res.json({
      message: 'Verification services updated.',
      services: buildServicesPayload(statusRow)
    });
  } catch (error) {
    console.error('[vetBioVerificationServices:patch]', error?.message || error);
    return res.status(500).json({ error: 'Failed to update verification services' });
  }
}

/**
 * POST /api/vet-bio/id-verification-date-on-close
 * Body: { verificationComplete?: boolean }
 */
/**
 * POST /api/vet-bio/reset-id-verification
 * Member-initiated reset when changing profile photo (Make this Profile).
 */
export async function postResetIdVerification(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (isAdminImpersonationSession(req.auth)) {
    return res.status(403).json({ error: 'Identification verification cannot be reset during admin impersonation' });
  }

  try {
    const ok = await setVetBioVerificationStatus(singlesId, 'id', 'notstarted');
    if (!ok) {
      return res.status(500).json({
        error: 'Verification status columns are not available on vet_bio. Run addVetBioVerificationStatusColumns.sql.'
      });
    }
    const statusRow = await loadVetBioVerificationServices(singlesId);
    return res.json({
      message: 'Identification verification reset.',
      services: buildServicesPayload(statusRow)
    });
  } catch (error) {
    console.error('[vetBioVerificationServices:resetIdVerification]', error?.message || error);
    return res.status(500).json({ error: 'Failed to reset identification verification' });
  }
}

export async function postIdVerificationDateOnClose(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const verificationComplete = body.verificationComplete === true;

  try {
    const outcome = await finalizeIdVerificationDateOnClose(singlesId, { verificationComplete });
    if (!outcome.applied) {
      return res.status(500).json({
        error: 'id_verification_date column is not available on vet_bio. Run addVetBioVerificationDateColumns.sql.'
      });
    }
    return res.json({
      idVerificationDate: outcome.idVerificationDate,
      message: outcome.idVerificationDate ? 'Identification verification date recorded.' : 'Identification verification date cleared.'
    });
  } catch (error) {
    console.error('[vetBioVerificationServices:idVerificationDateOnClose]', error?.message || error);
    return res.status(500).json({ error: 'Failed to update identification verification date' });
  }
}
