import PropTypes from 'prop-types';
import WorkspaceVideoTutorialPair from 'components/WorkspaceVideoTutorialPair';
/**
 * TutaDates menu page header: orange two-row "Video Tutorial" (per-page ENV URL) + orange two-row
 * "Text Tutorial" button that opens the page instruction popup.
 */
export default function PageVideoTextTutorialPair({ pageKey, onTutorialClick, sx }) {
  return (
    <WorkspaceVideoTutorialPair
      pageKey={pageKey}
      onTutorialClick={onTutorialClick}
      tutorialAriaLabel="Open text tutorial for this page"
      tutorialTitle="Text tutorial for this page"
      sx={{ ml: 0, mt: { xs: 1, sm: 1.5 }, ...sx }}
    />
  );
}

PageVideoTextTutorialPair.propTypes = {
  pageKey: PropTypes.string,
  onTutorialClick: PropTypes.func,
  sx: PropTypes.object
};
