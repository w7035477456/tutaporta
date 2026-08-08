import Box from '@mui/material/Box';
import HeaderLeft from './HeaderLeft';
import HeaderRight from './HeaderRight';

export { default as HeaderLeft } from './HeaderLeft';
export { default as HeaderRight } from './HeaderRight';
export { default as HeaderLanding } from './HeaderLanding';

/** Legacy combined header (landing + mobile transform paths). */
export default function Header({ iconsOnly = false }) {
  if (iconsOnly) {
    return (
      <>
        <Box sx={{ flexGrow: 1 }} />
        <HeaderRight iconsOnly />
      </>
    );
  }

  return (
    <>
      <HeaderLeft />
      <Box sx={{ flexGrow: 1 }} />
      <HeaderRight />
    </>
  );
}
