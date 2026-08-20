import { APPROVAL_STATUS, normalizeApprovalStatus } from 'utils/approvalStatusEnum';

const MEMBER_DIAGONAL_SASH_BASE_SX = {
  position: 'absolute',
  zIndex: 100,
  top: '14%',
  left: '-38%',
  width: '100%',
  py: '0.2rem',
  color: '#000000',
  WebkitTextFillColor: '#000000',
  WebkitTextStroke: '0.45px #000000',
  paintOrder: 'stroke fill',
  textShadow: `
    -0.5px -0.5px 0 #000000,
     0.5px -0.5px 0 #000000,
    -0.5px  0.5px 0 #000000,
     0.5px  0.5px 0 #000000
  `,
  fontFamily: 'inherit',
  fontSize: { xs: '0.92rem', sm: '1.02rem' },
  fontWeight: 800,
  letterSpacing: 0.12,
  lineHeight: 1.15,
  textAlign: 'center',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  transform: 'rotate(-45deg)',
  transformOrigin: 'center',
  pointerEvents: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
  border: '1.5px solid #000000',
  boxSizing: 'border-box'
};

/** Yellow sash — black text (Buddies / Acquaintance on Picks & Acquaint. left-rail avatars). */
export const MEMBER_RELATIONSHIP_RIBBON_SX = {
  ...MEMBER_DIAGONAL_SASH_BASE_SX,
  bgcolor: '#FFEB3B'
};

/** Received Bio Req — Approved sash (black on green). */
export const MEMBER_INCOMING_APPROVED_SASH_SX = {
  ...MEMBER_DIAGONAL_SASH_BASE_SX,
  bgcolor: '#66BB6A'
};

/** Received Bio Req — Requested sash (black on orange). */
export const MEMBER_INCOMING_REQUESTED_SASH_SX = {
  ...MEMBER_DIAGONAL_SASH_BASE_SX,
  bgcolor: '#FF9800'
};

/** Photo + relationship tag column (Picks, Acquaint. & Buddies, Received Bio Req). */
export const MEMBER_PHOTO_STACK_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%'
};

/** Rectangular Buddies / Acquaintance tag under left-rail photos. */
export const MEMBER_RELATIONSHIP_TAG_SX = {
  mt: 0.4,
  px: 1.4,
  py: 0.3,
  bgcolor: '#FFEB3B',
  color: '#000000',
  WebkitTextFillColor: '#000000',
  border: '1.5px solid #000000',
  borderRadius: 0.5,
  fontWeight: 800,
  fontSize: { xs: '1.44rem', sm: '1.64rem' },
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
  textAlign: 'center',
  boxSizing: 'border-box',
  pointerEvents: 'none'
};

function isApproved(value) {
  return normalizeApprovalStatus(value) === APPROVAL_STATUS.APPROVE;
}

function isRequested(value) {
  return String(value ?? '').trim().toLowerCase() === 'requested';
}

/**
 * @returns {'buddies' | 'acquaintance' | null}
 */
export function memberRelationshipRibbonKind(row) {
  if (!row) return null;
  if (isApproved(row.full_bio_request_approval)) return 'buddies';
  if (isApproved(row.brief_bio_request_approval)) return 'acquaintance';
  return null;
}

export function memberRelationshipRibbonLabel(kind) {
  if (kind === 'buddies') return 'Buddies';
  if (kind === 'acquaintance') return 'Acquaintance';
  return '';
}

/**
 * Incoming Received Bio Req photo sash.
 * @returns {'approved' | 'requested' | null}
 */
export function incomingBioPhotoSashKind(row) {
  if (!row) return null;
  if (isApproved(row.full_bio_request_approval) || isApproved(row.brief_bio_request_approval)) {
    return 'approved';
  }
  if (isRequested(row.brief_bio_request) || isRequested(row.full_bio_request)) {
    return 'requested';
  }
  return null;
}
