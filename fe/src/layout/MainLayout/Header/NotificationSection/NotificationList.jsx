import PropTypes from 'prop-types';

// material-ui
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { formatTimeAgo, picksPostNotificationAlias } from 'utils/picksPostNotifications';
import { useUserTimeZoneProfile } from 'hooks/useUserTimeZoneProfile';
import { formatTextEmbeddedDateTimes } from 'utils/userTimeZone';
import { buttonFontSizeHalfResponsive } from 'config/buttonFontEnv';

function formatBellNotificationTimeAgo(isoDate, userTimeZoneProfile) {
  const raw = formatTimeAgo(isoDate, userTimeZoneProfile);
  if (!raw) return '';
  if (raw === 'just now') return 'Just now';
  return raw.replace(/\bsec ago\b/i, 'Sec ago');
}

function balanceNotificationDescription(row, userTimeZoneProfile) {
  const raw = String(row.description ?? '').trim();
  if (!raw) return 'Balance History update';
  const formatted = formatTextEmbeddedDateTimes(raw, userTimeZoneProfile, row.created_at);
  if (formatted.length <= 88) return formatted;
  return `${formatted.slice(0, 85)}...`;
}

function notificationLines(row, userTimeZoneProfile) {
  const when = formatBellNotificationTimeAgo(row.created_at, userTimeZoneProfile);
  const timeLine = when ? `(${when})` : null;

  if (row.notification_type === 'balance') {
    const detail = balanceNotificationDescription(row, userTimeZoneProfile);
    return {
      primaryLine: detail || 'Balance History update',
      timeLine
    };
  }
  if (row.notification_type === 'bio_request') {
    const message = String(row.message ?? '').trim() || 'Bio request';
    return { primaryLine: message, timeLine };
  }
  const alias = picksPostNotificationAlias(row);
  const isChat = row.notification_type === 'chat';
  const kind = isChat ? 'New Chat' : 'New Posting';
  return {
    primaryLine: `${kind} from ${alias}`,
    timeLine
  };
}

function NotificationListItem({ children, onClick }) {
  return (
    <SelectedButtonTemplate
      fullWidth
      onClick={onClick}
      sx={{
        display: 'block',
        textAlign: 'center',
        px: 2,
        py: 1.5,
        minHeight: 0,
        whiteSpace: 'normal'
      }}
    >
      {children}
    </SelectedButtonTemplate>
  );
}

NotificationListItem.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func
};

// ==============================|| Picks & Posts NOTIFICATION LIST ||============================== //

export default function NotificationList({ notifications, loading, error, onSelectNotification }) {
  const userTimeZoneProfile = useUserTimeZoneProfile();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Alert severity="error" sx={{ py: 0.5 }}>
          Failed to load notifications.
        </Alert>
      </Box>
    );
  }

  if (!notifications.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: 'center' }}>
        No notifications yet.
      </Typography>
    );
  }

  return (
    <Stack sx={{ width: 'max-content', minWidth: '100%', py: 0.5, px: 1, gap: 0.5, mx: 'auto' }}>
      {notifications.map((row) => (
        <NotificationListItem
          key={row.notification_key}
          onClick={onSelectNotification ? () => onSelectNotification(row) : undefined}
        >
          {(() => {
            const { primaryLine, timeLine } = notificationLines(row, userTimeZoneProfile);
            return (
              <Box
                sx={{
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: 420,
                  mx: 'auto',
                  fontSize: buttonFontSizeHalfResponsive,
                  lineHeight: 1.35,
                  color: 'inherit'
                }}
              >
                <Typography
                  sx={{
                    color: 'inherit',
                    WebkitTextFillColor: 'inherit',
                    fontWeight: 600,
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {primaryLine}
                </Typography>
                {timeLine ? (
                  <Typography
                    sx={{
                      color: 'inherit',
                      WebkitTextFillColor: 'inherit',
                      fontWeight: 600,
                      fontSize: 'inherit',
                      lineHeight: 'inherit',
                      mt: 0.25
                    }}
                  >
                    {timeLine}
                  </Typography>
                ) : null}
              </Box>
            );
          })()}
        </NotificationListItem>
      ))}
    </Stack>
  );
}

NotificationList.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      notification_key: PropTypes.string.isRequired,
      notification_type: PropTypes.oneOf(['post', 'chat', 'balance', 'bio_request']),
      message: PropTypes.string,
      payment_id: PropTypes.number,
      description: PropTypes.string,
      content: PropTypes.string,
      created_at: PropTypes.string,
      author_singles_id: PropTypes.number.isRequired,
      prefix: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      member_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      alias: PropTypes.string
    })
  ).isRequired,
  loading: PropTypes.bool,
  error: PropTypes.object,
  onSelectNotification: PropTypes.func
};
