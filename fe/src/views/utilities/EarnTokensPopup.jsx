import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocation, useNavigate } from 'react-router-dom';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import GreenButton from 'ui-component/GreenButton';
import {
  PROFILES_RECORDS_PATH,
  PROFILES_RECORDS_TAB_INVITE_FRIENDS,
  PROFILES_RECORDS_TAB_POST_FB
} from 'constants/profilesRecordsRoute';
import { defaultEarnTokensAppId, EARN_TOKENS_APPS } from 'constants/earnTokensApps';
import { requestOpenVaultProfilesRecords } from 'utils/vaultProfilesRecordsGate';

const selectedAppButtonSx = {
  outline: '3px solid var(--theme-yellow-color, #ffd700)',
  outlineOffset: 2
};

export default function EarnTokensPopup({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedAppId, setSelectedAppId] = useState(() => defaultEarnTokensAppId(location.pathname));

  useEffect(() => {
    if (!open) return;
    setSelectedAppId(defaultEarnTokensAppId(location.pathname));
  }, [open, location.pathname]);

  const goToProfilesTab = (openTab) => {
    onClose();
    const state = {
      openTab,
      earnTokensApp: selectedAppId,
      returnTo: location.pathname
    };
    if (requestOpenVaultProfilesRecords(state)) return;
    navigate(PROFILES_RECORDS_PATH, { state });
  };

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: 22000 }}
      closeButtonAriaLabel="Close earn tokens popup"
    >
      <ColorTemplate16PopupCenterWide.Title>Two ways to earn free Tokens</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={1.5} sx={{ textAlign: 'left' }}>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.45 }}>
          Click Buy Token in &quot;Profiles &amp; Records=&gt;Buy Tokens&quot; or Earn Free Tokens (below):
        </Typography>

        <Typography sx={{ fontWeight: 800, lineHeight: 1.45 }}>
          You like to Invite or Post which app below:
        </Typography>
        <Stack spacing={1} alignItems="stretch" sx={{ width: '100%', maxWidth: 420 }}>
          {EARN_TOKENS_APPS.map((app) => {
            const selected = app.id === selectedAppId;
            return (
              <GreenButton
                key={app.id}
                type="button"
                onClick={() => setSelectedAppId(app.id)}
                sx={selected ? selectedAppButtonSx : undefined}
              >
                {app.label}
              </GreenButton>
            );
          })}
        </Stack>

        <Typography sx={{ fontWeight: 800, lineHeight: 1.45, mt: 0.5 }}>
          Which posting you want perform:
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.25,
            alignItems: 'center'
          }}
        >
          <GreenButton type="button" onClick={() => goToProfilesTab(PROFILES_RECORDS_TAB_INVITE_FRIENDS)}>
            Click to Email Friends
          </GreenButton>
          <GreenButton type="button" onClick={() => goToProfilesTab(PROFILES_RECORDS_TAB_POST_FB)}>
            Click to Post FB
          </GreenButton>
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

EarnTokensPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
