import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import seedBuddiesPostingImg from 'assets/images/seedBuddiesPosting.png';

/**
 * Optional explainer for seeded demo buddies (members write their own posts).
 * Not shown after drag-drop / first profile photo on My Album.
 */
export default function SeedBuddiesPostingPopup({ open, onContinue }) {
  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={onContinue}
      closeOnBackdrop={false}
      showCloseButton={false}
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      fillViewportHeight
      panelShellSx={{
        maxWidth: 'min(96vw, 1100px)',
        width: 'min(96vw, 1100px)'
      }}
    >
      <ColorTemplate16PopupCenterWide.Body
        spacing={1.5}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          overflow: 'hidden',
          py: 1
        }}
      >
        <Box
          component="img"
          src={seedBuddiesPostingImg}
          alt="Seeded buddies and self-intro posting"
          sx={{
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 7.5rem)',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 1,
            border: '2px solid #000'
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', pt: 0.5, pb: 1, flexShrink: 0 }}>
          <ColorTemplate16PopupCenterWide.ActionButton type="button" onClick={onContinue} sx={{ minWidth: 160, px: 3 }}>
            Continue
          </ColorTemplate16PopupCenterWide.ActionButton>
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

SeedBuddiesPostingPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onContinue: PropTypes.func.isRequired
};
