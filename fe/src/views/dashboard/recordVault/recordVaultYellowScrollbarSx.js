/** Fixed yellow — `var(--theme-yellow-color)` maps to the (blue) secondary color in the minimal palette. */
const SCROLLBAR_THUMB_YELLOW = '#FFEB3B';
const SCROLLBAR_TRACK_BLACK = '#000000';

/** TutaNotes scrollbars: yellow thumb on a black track (vertical and horizontal). */
export const recordVaultYellowScrollbarSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: `${SCROLLBAR_THUMB_YELLOW} ${SCROLLBAR_TRACK_BLACK}`,
  '&::-webkit-scrollbar': {
    width: 14,
    height: 14
  },
  '&::-webkit-scrollbar-track': {
    bgcolor: SCROLLBAR_TRACK_BLACK
  },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: SCROLLBAR_THUMB_YELLOW,
    borderRadius: 7,
    border: '2px solid #000'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    filter: 'brightness(1.08)'
  }
};
