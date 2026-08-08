import Box from '@mui/material/Box';

import { datingTopBannerBackgroundSx, datingTopBannerStripSx } from 'config/datingTopBanner';

/** Same faces strip image as the /allSingles app header (`topBannerNewBlur.png`). */
export default function ProfilesRecordsMemberBanner() {
  return (
    <Box
      sx={{
        ...datingTopBannerStripSx(),
        ...datingTopBannerBackgroundSx('left')
      }}
    />
  );
}
