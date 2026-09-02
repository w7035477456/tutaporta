import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import WorkspaceVideoTutorialPair from 'components/WorkspaceVideoTutorialPair';

/**
 * Bill Schedule Monthly / Yearly — centered VIDEO TUTORIALS + orange Tutorial
 * (yellow-dashed placement in mockup: middle of content header, above bill table).
 */
export default function BillScheduleTutorialHeaderBar({
  videoTutorialUrl = '',
  onTutorialClick,
  disabled = false
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        width: '100%',
        py: 0.25
      }}
    >
      <WorkspaceVideoTutorialPair
        videoTutorialUrl={videoTutorialUrl}
        onTutorialClick={onTutorialClick}
        tutorialDisabled={disabled}
        tutorialVariant="orange"
        tutorialAriaLabel="Open Bill Schedule tutorial"
        tutorialTitle="Open Bill Schedule tutorial"
        iconHeight={{ xs: 36, sm: 42 }}
        sx={{ ml: 0 }}
      />
    </Box>
  );
}

BillScheduleTutorialHeaderBar.propTypes = {
  videoTutorialUrl: PropTypes.string,
  onTutorialClick: PropTypes.func,
  disabled: PropTypes.bool
};
