import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'ui-component/cards/MainCard';
import { useGetInterestedSingles } from 'api/interestedSinglesFe';
import api from 'api/axios';
import { isSelfIntroVideoPostingUrl, videoThumbnailUrlFromPostingUrl } from 'api/selfIntroVideoFe';
import { formatMemberLabel } from 'utils/memberLabel';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';

const PRIVATE_LOCKED_MESSAGE = 'Private photo visible after member have approved you to view brief or full bio';

function normalizeImageUrls(list) {
  if (!Array.isArray(list)) return [];
  const apiBase = getApiBaseUrl();
  const normalized = list
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => {
      const trimmed = String(url).trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (trimmed.startsWith('/api/')) return `${apiBase}${trimmed}`;
      return trimmed;
    });
  return [...new Set(normalized)];
}

export default function InterestedAlbumPage() {
  const location = useLocation();
  const targetSinglesId = Number(location.state?.targetSinglesId);
  const stateMemberLabel = typeof location.state?.memberLabel === 'string' ? location.state.memberLabel : '';
  const { interestedSingles, interestedSinglesLoading, interestedSinglesError } = useGetInterestedSingles();
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState('');
  const [publicImageUrls, setPublicImageUrls] = useState([]);
  const [privateImageUrls, setPrivateImageUrls] = useState([]);
  const [publicCount, setPublicCount] = useState(0);
  const [privateCount, setPrivateCount] = useState(0);
  const [canViewPrivateAlbum, setCanViewPrivateAlbum] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

  const targetPerson = useMemo(() => {
    if (!Array.isArray(interestedSingles) || !Number.isFinite(targetSinglesId)) return null;
    const found = interestedSingles.find((row) => Number(row?.singles_id_to) === targetSinglesId);
    if (!found) return null;
    return {
      singles_id: Number(found.singles_id_to),
      prefix: found.prefix ?? null,
      member_id: found.member_id ?? null,
      profile_image_url: found.profile_image_url,
      gallery_image_urls: Array.isArray(found.gallery_image_urls) ? found.gallery_image_urls : []
    };
  }, [interestedSingles, targetSinglesId]);

  const memberLabel = useMemo(() => {
    if (stateMemberLabel) return stateMemberLabel;
    if (!targetPerson) return 'Interested Album';
    return formatMemberLabel({
      alias: targetPerson.alias,
      singlesId: targetPerson.singles_id,
      prefix: targetPerson.prefix,
      memberId: targetPerson.member_id
    });
  }, [stateMemberLabel, targetPerson]);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
      setPublicImageUrls([]);
      setPrivateImageUrls([]);
      setPublicCount(0);
      setPrivateCount(0);
      setCanViewPrivateAlbum(false);
      setSelectedImageUrl('');
      return undefined;
    }

    setAlbumLoading(true);
    setAlbumError('');
    api
      .get(`/api/publicPrivateAlbum/${targetSinglesId}`)
      .then((res) => {
        if (cancelled) return;
        const publicUrls = normalizeImageUrls(res?.data?.publicImageUrls);
        const allowPrivate = res?.data?.canViewPrivateAlbum === true;
        const privateUrls = allowPrivate ? normalizeImageUrls(res?.data?.privateImageUrls) : [];
        const firstVisible = publicUrls[0] || privateUrls[0] || '';
        setPublicImageUrls(publicUrls);
        setPrivateImageUrls(privateUrls);
        setPublicCount(Number.isFinite(Number(res?.data?.publicCount)) ? Number(res.data.publicCount) : publicUrls.length);
        setPrivateCount(Number.isFinite(Number(res?.data?.privateCount)) ? Number(res.data.privateCount) : privateUrls.length);
        setCanViewPrivateAlbum(allowPrivate);
        setSelectedImageUrl((prev) => (prev && [...publicUrls, ...privateUrls].includes(prev) ? prev : firstVisible));
      })
      .catch((err) => {
        if (cancelled) return;
        setAlbumError(err?.response?.data?.error || err?.message || 'Failed to load public/private album.');
        setPublicImageUrls([]);
        setPrivateImageUrls([]);
        setPublicCount(0);
        setPrivateCount(0);
        setCanViewPrivateAlbum(false);
        setSelectedImageUrl('');
      })
      .finally(() => {
        if (!cancelled) setAlbumLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetSinglesId]);

  const hasAnyVisibleImage = publicImageUrls.length > 0 || privateImageUrls.length > 0;
  const selectedIsVideo = isSelfIntroVideoPostingUrl(selectedImageUrl);

  const renderAlbumThumb = (url, idx, prefix) => {
    const isVideo = isSelfIntroVideoPostingUrl(url);
    const isSelected = selectedImageUrl === url;
    return (
      <Box
        key={`${prefix}-${idx}-${url}`}
        component="button"
        type="button"
        onClick={() => setSelectedImageUrl(url)}
        sx={{
          border: isSelected ? '2px solid var(--theme-primary-color)' : '1px solid rgba(0,0,0,0.15)',
          borderRadius: 0.75,
          p: 0,
          m: 0,
          minWidth: 78,
          width: 78,
          height: 78,
          overflow: 'hidden',
          background: '#fff',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        {isVideo ? (
          <Box
            component="img"
            src={videoThumbnailUrlFromPostingUrl(url)}
            alt={`${prefix}-video-thumbnail-${idx + 1}`}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <Box component="img" src={url} alt={`${prefix}-thumbnail-${idx + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </Box>
    );
  };

  return (
    <MainCard
      title={memberLabel}
      headerSX={{
        '& .MuiCardHeader-title': {
          fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
          color: 'var(--theme-primary-color)'
        }
      }}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      contentSX={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}
    >
      {interestedSinglesLoading || albumLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {interestedSinglesError ? <Alert severity="error">Failed to load interested album.</Alert> : null}
      {albumError ? <Alert severity="error">{albumError}</Alert> : null}

      {!interestedSinglesLoading && !interestedSinglesError && !albumLoading && !albumError ? (
        <>
          {!hasAnyVisibleImage ? (
            <Alert severity="info">No photos available for this member.</Alert>
          ) : (
            <>
              <Typography sx={{ fontWeight: 700, color: 'var(--theme-primary-color)' }}>
                Public Album ({publicCount}/10)
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  overflowX: 'auto',
                  py: 0.5,
                  px: 0.25,
                  border: '1px solid var(--theme-primary-color)',
                  borderRadius: 1,
                  bgcolor: 'var(--theme-secondary-color)'
                }}
              >
                {publicImageUrls.map((url, idx) => renderAlbumThumb(url, idx, 'public'))}
              </Stack>

              <Typography sx={{ fontWeight: 700, color: 'var(--theme-primary-color)', mt: 0.5 }}>
                Private Album ({privateCount}/10)
              </Typography>
              {canViewPrivateAlbum ? (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    overflowX: 'auto',
                    py: 0.5,
                    px: 0.25,
                    border: '1px solid var(--theme-primary-color)',
                    borderRadius: 1,
                    bgcolor: 'var(--theme-secondary-color)'
                  }}
                >
                  {privateImageUrls.map((url, idx) => renderAlbumThumb(url, idx, 'private'))}
                </Stack>
              ) : (
                <Box
                  sx={{
                    border: '1px solid var(--theme-primary-color)',
                    borderRadius: 1,
                    bgcolor: 'var(--theme-secondary-color)',
                    px: 1.25,
                    py: 1
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'var(--theme-primary-color)' }}>
                    {PRIVATE_LOCKED_MESSAGE}
                  </Typography>
                </Box>
              )}

              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--theme-primary-color)',
                  borderRadius: 1,
                  bgcolor: 'var(--theme-secondary-color)',
                  p: 1
                }}
              >
                {selectedIsVideo ? (
                  <Box
                    component="video"
                    src={selectedImageUrl}
                    controls
                    autoPlay
                    playsInline
                    sx={{
                      width: '100%',
                      height: '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      bgcolor: '#000'
                    }}
                  />
                ) : (
                  <Box
                    component="img"
                    src={selectedImageUrl}
                    alt={memberLabel}
                    sx={{
                      width: '100%',
                      height: '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                )}
              </Box>
            </>
          )}
        </>
      ) : null}
    </MainCard>
  );
}
