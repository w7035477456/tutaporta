/** TutaNotes scrollbars: yellow thumb on a black track (vertical and horizontal). */
export const recordVaultYellowScrollbarSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--theme-yellow-color) rgba(0,0,0,0.4)',
  '&::-webkit-scrollbar': {
    width: 14,
    height: 14
  },
  '&::-webkit-scrollbar-track': {
    bgcolor: 'rgba(0,0,0,0.4)'
  },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'var(--theme-yellow-color)',
    borderRadius: 7,
    border: '2px solid #000'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    filter: 'brightness(1.08)'
  }
};
