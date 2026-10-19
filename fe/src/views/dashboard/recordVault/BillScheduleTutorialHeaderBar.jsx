import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import WorkspaceVideoTutorialPair from 'components/WorkspaceVideoTutorialPair';

/**
 * Bill Schedule Monthly / Yearly — centered VIDEO TUTORIALS + orange Tutorial
 * (yellow-dashed placement in mockup: middle of content header, above bill table).
 * `rightAction` (e.g. the expand / focus-view toggle) sits at the top-right corner.
 */
export default function BillScheduleTutorialHeaderBar({
  videoTutorialUrl = '',
  onTutorialClick,
  disabled = false,
  rightAction = null
}) {
  return (
    <Box
      sx={{
        position: 'relative',
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
        sx={{ ml: 0 }}
      />
      {rightAction ? <Box sx={{ position: 'absolute', top: 0, right: 0 }}>{rightAction}</Box> : null}
    </Box>
  );
}

BillScheduleTutorialHeaderBar.propTypes = {
  videoTutorialUrl: PropTypes.string,
  onTutorialClick: PropTypes.func,
  disabled: PropTypes.bool,
  rightAction: PropTypes.node
};
