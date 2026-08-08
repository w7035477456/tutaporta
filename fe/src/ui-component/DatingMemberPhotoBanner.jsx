import { useMemo } from 'react';
import Box from '@mui/material/Box';

import { useGetAllSingles } from 'api/allSinglesFe';
import UserRound from 'assets/images/users/profile.jpeg';
import { DATING_TOP_BANNER_HEIGHT, datingTopBannerBackgroundSx, datingTopBannerStripSx } from 'config/datingTopBanner';

const BANNER_PHOTO_LIMIT = 48;

function collectMemberPhotoUrls(singles) {
  const urls = [];
  const seen = new Set();

  for (const person of singles ?? []) {
    const candidates = [
      String(person?.profile_image_url ?? '').trim(),
      ...(Array.isArray(person?.gallery_image_urls)
        ? person.gallery_image_urls.map((url) => String(url ?? '').trim())
        : [])
    ];

    for (const url of candidates) {
      if (!url || url === 'profile.jpeg' || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= BANNER_PHOTO_LIMIT) return urls;
    }
  }

  return urls;
}

/**
 * Horizontal member-photo strip (same source as All Singles gallery).
 * Falls back to the app-header faces image when no photos are loaded yet.
 */
export default function DatingMemberPhotoBanner() {
  const { singles } = useGetAllSingles();

  const bannerPhotoUrls = useMemo(() => collectMemberPhotoUrls(singles), [singles]);

  if (bannerPhotoUrls.length === 0) {
    return (
      <Box
        sx={{
          ...datingTopBannerStripSx(),
          bgcolor: 'transparent',
          ...datingTopBannerBackgroundSx('left')
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: DATING_TOP_BANNER_HEIGHT,
        overflow: 'hidden',
        borderBottom: '1px solid rgba(0,0,0,0.12)'
      }}
    >
      {bannerPhotoUrls.map((src, index) => (
        <Box
          key={`${src}-${index}`}
          component="img"
          src={src}
          alt=""
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = UserRound;
          }}
          sx={{
            flex: '1 1 0',
            minWidth: 36,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      ))}
    </Box>
  );
}
