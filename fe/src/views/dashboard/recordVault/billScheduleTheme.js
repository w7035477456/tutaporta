/** Bill Schedule — ink/surface follow theme daynight + inverse (light ↔ dark). */

export const BILL_SCHEDULE_SURFACE = 'var(--theme-daynight-color)';
export const BILL_SCHEDULE_INK = 'var(--theme-inverse-daynight-color)';
export const BILL_SCHEDULE_TABLE_HEAD_BG = 'var(--theme-daynight2-color)';

export const billScheduleInkTypographySx = {
  color: `${BILL_SCHEDULE_INK} !important`,
  WebkitTextFillColor: `${BILL_SCHEDULE_INK} !important`
};

export const billSchedulePanelRootSx = {
  bgcolor: BILL_SCHEDULE_SURFACE,
  color: BILL_SCHEDULE_INK,
  fontFamily: 'inherit',
  '& .MuiTypography-root': billScheduleInkTypographySx
};

export const billScheduleNavBtnSx = {
  border: `2px solid ${BILL_SCHEDULE_INK}`,
  borderRadius: 1,
  bgcolor: BILL_SCHEDULE_SURFACE,
  color: BILL_SCHEDULE_INK,
  WebkitTextFillColor: BILL_SCHEDULE_INK,
  px: 1,
  py: 0.25,
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: '1.1rem',
  lineHeight: 1
};

export const billScheduleInputSx = {
  '& .MuiInputBase-input': {
    py: 0.5,
    px: 0.75,
    fontSize: '0.95rem',
    color: BILL_SCHEDULE_INK,
    WebkitTextFillColor: BILL_SCHEDULE_INK,
    '&::placeholder': { color: BILL_SCHEDULE_INK, opacity: 0.5 }
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BILL_SCHEDULE_INK },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: BILL_SCHEDULE_INK },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: BILL_SCHEDULE_INK },
  '& .MuiInputBase-root': {
    color: BILL_SCHEDULE_INK,
    WebkitTextFillColor: BILL_SCHEDULE_INK
  }
};

export const billScheduleSelectSx = {
  ...billScheduleInputSx,
  bgcolor: BILL_SCHEDULE_SURFACE,
  color: BILL_SCHEDULE_INK,
  '& .MuiSelect-select': { py: 0.5, px: 0.75, color: BILL_SCHEDULE_INK, WebkitTextFillColor: BILL_SCHEDULE_INK },
  '& .MuiSelect-icon': { color: BILL_SCHEDULE_INK }
};

export const billScheduleTableSx = {
  width: '100%',
  borderCollapse: 'collapse',
  flexShrink: 0,
  color: BILL_SCHEDULE_INK,
  '& th, & td': {
    border: `2px solid ${BILL_SCHEDULE_INK}`,
    px: 0.75,
    py: 0.5,
    verticalAlign: 'middle',
    fontSize: '0.95rem',
    color: BILL_SCHEDULE_INK
  },
  '& th': {
    bgcolor: BILL_SCHEDULE_TABLE_HEAD_BG,
    color: BILL_SCHEDULE_INK,
    fontWeight: 800,
    textAlign: 'left'
  }
};

export const billScheduleBorderedBoxSx = {
  border: `2px solid ${BILL_SCHEDULE_INK}`,
  borderRadius: 1,
  bgcolor: BILL_SCHEDULE_SURFACE,
  boxSizing: 'border-box',
  ...billScheduleInkTypographySx
};
