import { formatAdminImpersonationBannerLabel, isImpersonationSession } from 'utils/adminSession';

/** Solid red header strip when admin impersonates a member (replaces dating photo banner). */
export const ADMIN_IMPERSONATION_HEADER_BG = '#d32f2f';

/** Center slot in the app header — wide enough for one-line impersonation label between chrome icons. */
export const adminImpersonationHeaderCenterWrapSx = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  px: 1,
  width: 'max-content',
  maxWidth: 'calc(100% - 11rem)',
  display: 'flex',
  justifyContent: 'center',
  zIndex: 2,
  '& > *': {
    pointerEvents: 'auto'
  }
};

/** @returns {{ bannerSx: object, label: string } | null} */
export function getAdminImpersonationHeaderState(user) {
  if (!isImpersonationSession(user)) return null;
  return {
    bannerSx: {
      bgcolor: ADMIN_IMPERSONATION_HEADER_BG,
      backgroundColor: ADMIN_IMPERSONATION_HEADER_BG,
      backgroundImage: 'none'
    },
    label: formatAdminImpersonationBannerLabel(user)
  };
}
