import { useState } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import PageInstructionButton from 'ui-component/PageInstructionButton';
import EarnTokensButton from 'ui-component/EarnTokensButton';
import EarnTokensPopup from 'views/utilities/EarnTokensPopup';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

/** Upper-right page header: instruction button with Earn Tokens directly underneath. */
export default function PageInstructionEarnTokensAction({ onInstructionClick }) {
  const [earnOpen, setEarnOpen] = useState(false);

  return (
    <>
      <Stack alignItems="flex-end" spacing={0.75} sx={{ flexShrink: 0 }} {...guestDemoAllowProps()}>
        <PageInstructionButton onClick={onInstructionClick} />
        <EarnTokensButton onClick={() => setEarnOpen(true)} />
      </Stack>
      <EarnTokensPopup open={earnOpen} onClose={() => setEarnOpen(false)} />
    </>
  );
}

PageInstructionEarnTokensAction.propTypes = {
  onInstructionClick: PropTypes.func
};
