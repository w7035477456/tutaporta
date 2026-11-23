import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PropTypes from 'prop-types';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import BillScheduleTutorialHeaderBar from './BillScheduleTutorialHeaderBar';
import { BILL_SCHEDULE_INK, billSchedulePanelRootSx } from './billScheduleTheme';

/** Placeholder panel for Bill Schedule → ToDo (table/API TBD). */
export default function BillScheduleTodoPanel({
  videoTutorialUrl = '',
  onBillScheduleTutorialClick,
  headerRightAction = null
}) {
  return (
    <Box
      sx={{
        ...billSchedulePanelRootSx,
        fontFamily: MAIN_FONT_FAMILY
      }}
    >
      <BillScheduleTutorialHeaderBar
        videoTutorialUrl={videoTutorialUrl}
        onTutorialClick={onBillScheduleTutorialClick}
        rightAction={headerRightAction}
      />
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: '1.35rem',
          color: BILL_SCHEDULE_INK,
          mb: 1
        }}
      >
        ToDo
      </Typography>
      <Typography sx={{ color: BILL_SCHEDULE_INK, opacity: 0.85 }}>
        ToDo list coming soon.
      </Typography>
    </Box>
  );
}

BillScheduleTodoPanel.propTypes = {
  videoTutorialUrl: PropTypes.string,
  onBillScheduleTutorialClick: PropTypes.func,
  headerRightAction: PropTypes.node
};
