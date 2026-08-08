import useInlineNotificationBell from 'hooks/useInlineNotificationBell';
import useVettingMobileTopCluster from 'hooks/useVettingMobileTopCluster';
import Box from '@mui/material/Box';
import IdleWarningCountdownBadge from 'ui-component/IdleWarningCountdownBadge';
import NotificationSection from './NotificationSection';
import ProfileSection from './ProfileSection';

/** Region 2 right — notification bell + profile / theme menu. */
export default function HeaderRight({ iconsOnly = false }) {
  const vettingMobileTopCluster = useVettingMobileTopCluster();
  const inlineNotificationBell = useInlineNotificationBell();

  if (vettingMobileTopCluster && !iconsOnly) return null;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', overflow: 'visible', position: 'relative', zIndex: 2 }}>
      <IdleWarningCountdownBadge />
      {!inlineNotificationBell ? <NotificationSection /> : null}
      <ProfileSection />
    </Box>
  );
}
