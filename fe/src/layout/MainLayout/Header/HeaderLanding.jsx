import Box from '@mui/material/Box';
import HeaderRight from './HeaderRight';

/** Mall / landing header — icons only (region 2). */
export default function HeaderLanding() {
  return (
    <>
      <Box sx={{ flexGrow: 1 }} />
      <HeaderRight iconsOnly />
    </>
  );
}
