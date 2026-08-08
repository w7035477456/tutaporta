import { parseApprovedViewingDurationMonths } from '../../utils/approvedViewingDurationConfig.js';
import { parseApprovalStayDurationDays } from '../../utils/approvalStayDurationConfig.js';

export async function getRequestsAboutMeSettings(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  return res.json({
    approved_viewing_duration_months: parseApprovedViewingDurationMonths(),
    approval_stay_duration_days: parseApprovalStayDurationDays()
  });
}
