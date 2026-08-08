import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_Z_INDEX } from 'config/colorTemplate7PopupLargeDark';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  deleteAdminWipeBySinglesIdVideo,
  fetchAdminVideoObjectUrl,
  fetchAdminWipeBySinglesIdVideos,
  adminVideoThumbnailUrl
} from 'api/adminToolsFe';
import { themedConfirm } from 'utils/themedDialog';

const VIDEOS_GRID_MIN_WIDTHS_PX = [72, 72, 180, 88];
const lookupBodyTextSx = { whiteSpace: 'nowrap' };

const fileNameLinkSx = {
  cursor: 'pointer',
  textDecoration: 'underline',
  wordBreak: 'break-all',
  whiteSpace: 'normal',
  '&:hover': { color: '#ffd60a' }
};

const videoThumbSx = {
  width: 56,
  height: 56,
  objectFit: 'cover',
  display: 'block',
  border: '1px solid rgba(255,255,255,0.35)',
  bgcolor: '#111',
  cursor: 'pointer'
};

function buildVideosColumnTexts(videos) {
  return [
    ['Video_id', ...videos.map((v) => String(v.videoId))],
    ['Thumb', ...videos.map(() => '')],
    ['File Name', ...videos.map((v) => String(v.videoFileName || `video_${v.videoId}`))],
    ['Action', 'Delete', ...videos.map(() => 'Delete')]
  ];
}

function buildVideosColumnButtons() {
  return [
    null,
    null,
    null,
    {
      labels: ['Delete', 'Deleting…'],
      variant: 'colorTemplate9',
      minWidthPx: 88
    }
  ];
}

export default function AdminToolsWipeByIdVideosPopup({ open, singlesId, onClose, onVideosChanged, onError }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [playerVideoUrl, setPlayerVideoUrl] = useState('');
  const [playerVideoLabel, setPlayerVideoLabel] = useState('');
  const [playerVideoLoading, setPlayerVideoLoading] = useState(false);
  const [playerVideoError, setPlayerVideoError] = useState('');
  const playerVideoBlobRef = useRef('');

  const showTable = !loading && !loadError && videos.length > 0;
  const columnTexts = useMemo(() => buildVideosColumnTexts(videos), [videos]);
  const columnButtons = useMemo(() => buildVideosColumnButtons(), []);
  const { gridTemplateColumns, minTableWidthPx } = useColorTemplate9AutoFitColumnWidths({
    columnTexts,
    columnButtons,
    minWidthsPx: VIDEOS_GRID_MIN_WIDTHS_PX,
    extraWidthsPx: [0, 72, 0, 0],
    enabled: showTable
  });

  const revokePlayerVideoBlob = useCallback(() => {
    if (playerVideoBlobRef.current) {
      URL.revokeObjectURL(playerVideoBlobRef.current);
      playerVideoBlobRef.current = '';
    }
  }, []);

  useEffect(() => () => revokePlayerVideoBlob(), [revokePlayerVideoBlob]);

  const resetPlayer = useCallback(() => {
    revokePlayerVideoBlob();
    setPlayerVideoUrl('');
    setPlayerVideoLabel('');
    setPlayerVideoError('');
    setPlayerVideoLoading(false);
  }, [revokePlayerVideoBlob]);

  const handleClose = useCallback(() => {
    resetPlayer();
    setVideos([]);
    setLoadError('');
    setDeleteBusyId(null);
    onClose?.();
  }, [onClose, resetPlayer]);

  useEffect(() => {
    if (!open || !singlesId) return;

    let cancelled = false;
    setLoading(true);
    setLoadError('');
    onError?.('');

    void (async () => {
      try {
        const data = await fetchAdminWipeBySinglesIdVideos(singlesId);
        if (cancelled) return;
        const nextVideos = Array.isArray(data?.videos) ? data.videos : [];
        setVideos(nextVideos);
      } catch (err) {
        if (cancelled) return;
        const message = err?.response?.data?.error || err?.message || 'Failed to load videos';
        setLoadError(message);
        onError?.(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, onError, singlesId]);

  const handleOpenVideo = useCallback(
    async (video) => {
      const videoId = Number(video?.videoId);
      resetPlayer();
      setPlayerVideoLabel(String(video?.videoFileName || `video_${videoId}`));
      setPlayerVideoLoading(true);

      try {
        const blobUrl = await fetchAdminVideoObjectUrl(videoId);
        playerVideoBlobRef.current = blobUrl;
        setPlayerVideoUrl(blobUrl);
      } catch (err) {
        setPlayerVideoError(err?.response?.data?.error || err?.message || 'Failed to load video');
      } finally {
        setPlayerVideoLoading(false);
      }
    },
    [resetPlayer]
  );

  const handleDeleteVideo = useCallback(
    async (video) => {
      const videoId = Number(video?.videoId);
      if (!singlesId || !Number.isFinite(videoId) || videoId < 1 || deleteBusyId != null) return;

      const label = String(video?.videoFileName || `video_${videoId}`);
      if (
        !(await themedConfirm(
          `Delete video ${videoId} (${label}) for singles_id = ${singlesId}?\n\nRemoves the DB row and on-disk file.`
        ))
      ) {
        return;
      }

      setDeleteBusyId(videoId);
      onError?.('');
      try {
        const data = await deleteAdminWipeBySinglesIdVideo({ singlesId, videoId });
        const nextVideos = Array.isArray(data?.videos) ? data.videos : [];
        setVideos(nextVideos);
        onVideosChanged?.(data?.match_count ?? nextVideos.length);
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to delete video');
      } finally {
        setDeleteBusyId(null);
      }
    },
    [deleteBusyId, onError, onVideosChanged, singlesId]
  );

  const playerOpen = Boolean(playerVideoLabel || playerVideoLoading || playerVideoUrl || playerVideoError);

  return (
    <>
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={handleClose}
        closeOnBackdrop
        closeButtonAriaLabel="Close videos list"
      >
        <ColorTemplate7PopupLargeDark.Title>Videos for singles_id {singlesId}</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          {loading ? (
            <ColorTemplate9TableData.EmptyText sx={{ textAlign: 'center' }}>Loading videos…</ColorTemplate9TableData.EmptyText>
          ) : null}
          {loadError ? (
            <ColorTemplate9TableData.EmptyText sx={{ textAlign: 'center', color: '#ffb4a9' }}>
              {loadError}
            </ColorTemplate9TableData.EmptyText>
          ) : null}
          {!loading && !loadError && videos.length === 0 ? (
            <ColorTemplate9TableData.EmptyText sx={{ textAlign: 'center' }}>No videos found.</ColorTemplate9TableData.EmptyText>
          ) : null}
          {showTable ? (
            <ColorTemplate9TableData.Table autoFitColumns minTableWidth={minTableWidthPx}>
              <ColorTemplate9TableData.HeaderRow gridTemplateColumns={gridTemplateColumns}>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Video_id</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Thumb</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>File Name</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Action</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
              </ColorTemplate9TableData.HeaderRow>

              {videos.map((video, index) => {
                const videoId = Number(video.videoId);
                const busy = deleteBusyId === videoId;
                const fileName = String(video.videoFileName || `video_${videoId}`);
                return (
                  <ColorTemplate9TableData.BodyRow
                    key={videoId}
                    rowIndex={index}
                    gridTemplateColumns={gridTemplateColumns}
                  >
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>{videoId}</ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell>
                      <Box
                        component="button"
                        type="button"
                        aria-label={`Play ${fileName}`}
                        onClick={() => void handleOpenVideo(video)}
                        sx={{
                          p: 0,
                          m: 0,
                          border: 0,
                          bgcolor: 'transparent',
                          cursor: 'pointer',
                          lineHeight: 0
                        }}
                      >
                        <Box
                          component="img"
                          src={adminVideoThumbnailUrl(videoId)}
                          alt=""
                          loading="lazy"
                          sx={videoThumbSx}
                        />
                      </Box>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText
                        component="button"
                        type="button"
                        onClick={() => void handleOpenVideo(video)}
                        sx={{
                          ...lookupBodyTextSx,
                          ...fileNameLinkSx,
                          bgcolor: 'transparent',
                          border: 0,
                          p: 0,
                          font: 'inherit',
                          textAlign: 'left'
                        }}
                      >
                        {fileName}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                      <UnSelectedButtonTemplate
                        type="button"
                        fitLabelWidth
                        disabled={busy || deleteBusyId != null}
                        onClick={() => void handleDeleteVideo(video)}
                      >
                        {busy ? 'Deleting…' : 'Delete'}
                      </UnSelectedButtonTemplate>
                    </ColorTemplate9TableData.BodyCell>
                  </ColorTemplate9TableData.BodyRow>
                );
              })}
            </ColorTemplate9TableData.Table>
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={playerOpen}
        onClose={resetPlayer}
        closeOnBackdrop
        closeButtonAriaLabel="Close video player"
        overlaySx={{ zIndex: COLOR_TEMPLATE7_POPUP_Z_INDEX + 1 }}
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1}>
          {playerVideoLabel ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
              {playerVideoLabel}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {playerVideoLoading ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>Loading video…</ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {playerVideoError ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', color: '#ffb4a9' }}>
              {playerVideoError}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {playerVideoUrl ? (
            <Box
              component="video"
              src={playerVideoUrl}
              controls
              autoPlay
              playsInline
              sx={{ width: '100%', maxHeight: '70vh' }}
            />
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}
