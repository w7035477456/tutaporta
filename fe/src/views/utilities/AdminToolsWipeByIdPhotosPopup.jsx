import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_Z_INDEX } from 'config/colorTemplate7PopupLargeDark';
import ColorTemplate9TableData, { useColorTemplate9AutoFitColumnWidths } from 'ui-component/ColorTemplate9TableData';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  adminPhotoThumbnailUrl,
  deleteAdminWipeBySinglesIdPhoto,
  fetchAdminPhotoObjectUrl,
  fetchAdminWipeBySinglesIdPhotos
} from 'api/adminToolsFe';
import { themedConfirm } from 'utils/themedDialog';

const PHOTOS_GRID_MIN_WIDTHS_PX = [72, 88, 180, 104, 88];
const PHOTO_THUMB_PX = 96;
const lookupBodyTextSx = { whiteSpace: 'nowrap' };

const fileNameLinkSx = {
  cursor: 'pointer',
  textDecoration: 'underline',
  wordBreak: 'break-all',
  whiteSpace: 'normal',
  '&:hover': { color: '#ffd60a' }
};

function buildPhotosColumnTexts(photos) {
  return [
    ['photos_id', ...photos.map((p) => String(p.photosId))],
    ['type', ...photos.map((p) => String(p.photoType || 'uploaded'))],
    ['File Name', ...photos.map((p) => String(p.photoFileName || `photo_${p.photosId}`))],
    ['Thumb', ...photos.map(() => '')],
    ['Action', 'Delete', ...photos.map(() => 'Delete')]
  ];
}

function buildPhotosColumnButtons() {
  return [
    null,
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

export default function AdminToolsWipeByIdPhotosPopup({ open, singlesId, onClose, onPhotosChanged, onError }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState('');
  const [viewerPhotoLabel, setViewerPhotoLabel] = useState('');
  const [viewerPhotoLoading, setViewerPhotoLoading] = useState(false);
  const [viewerPhotoError, setViewerPhotoError] = useState('');
  const viewerPhotoBlobRef = useRef('');

  const showTable = !loading && !loadError && photos.length > 0;
  const columnTexts = useMemo(() => buildPhotosColumnTexts(photos), [photos]);
  const columnButtons = useMemo(() => buildPhotosColumnButtons(), []);
  const { gridTemplateColumns, minTableWidthPx } = useColorTemplate9AutoFitColumnWidths({
    columnTexts,
    columnButtons,
    minWidthsPx: PHOTOS_GRID_MIN_WIDTHS_PX,
    enabled: showTable
  });

  const revokeViewerPhotoBlob = useCallback(() => {
    if (viewerPhotoBlobRef.current) {
      URL.revokeObjectURL(viewerPhotoBlobRef.current);
      viewerPhotoBlobRef.current = '';
    }
  }, []);

  useEffect(() => () => revokeViewerPhotoBlob(), [revokeViewerPhotoBlob]);

  const resetViewer = useCallback(() => {
    revokeViewerPhotoBlob();
    setViewerPhotoUrl('');
    setViewerPhotoLabel('');
    setViewerPhotoError('');
    setViewerPhotoLoading(false);
  }, [revokeViewerPhotoBlob]);

  const handleClose = useCallback(() => {
    resetViewer();
    setPhotos([]);
    setLoadError('');
    setDeleteBusyId(null);
    onClose?.();
  }, [onClose, resetViewer]);

  useEffect(() => {
    if (!open || !singlesId) return;

    let cancelled = false;
    setLoading(true);
    setLoadError('');
    onError?.('');

    void (async () => {
      try {
        const data = await fetchAdminWipeBySinglesIdPhotos(singlesId);
        if (cancelled) return;
        const nextPhotos = Array.isArray(data?.photos) ? data.photos : [];
        setPhotos(nextPhotos);
      } catch (err) {
        if (cancelled) return;
        const message = err?.response?.data?.error || err?.message || 'Failed to load photos';
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

  const handleOpenPhoto = useCallback(
    async (photo) => {
      const photosId = Number(photo?.photosId);
      resetViewer();
      setViewerPhotoLabel(String(photo?.photoFileName || `photo_${photosId}`));
      setViewerPhotoLoading(true);

      try {
        const blobUrl = await fetchAdminPhotoObjectUrl(photosId);
        viewerPhotoBlobRef.current = blobUrl;
        setViewerPhotoUrl(blobUrl);
      } catch (err) {
        setViewerPhotoError(err?.response?.data?.error || err?.message || 'Failed to load photo');
      } finally {
        setViewerPhotoLoading(false);
      }
    },
    [resetViewer]
  );

  const handleDeletePhoto = useCallback(
    async (photo) => {
      const photosId = Number(photo?.photosId);
      if (!singlesId || !Number.isFinite(photosId) || photosId < 1 || deleteBusyId != null) return;

      const label = String(photo?.photoFileName || `photo_${photosId}`);
      if (
        !(await themedConfirm(
          `Delete photo ${photosId} (${label}) for singles_id = ${singlesId}?\n\nRemoves the DB row and on-disk file.`
        ))
      ) {
        return;
      }

      setDeleteBusyId(photosId);
      onError?.('');
      try {
        const data = await deleteAdminWipeBySinglesIdPhoto({ singlesId, photosId });
        const nextPhotos = Array.isArray(data?.photos) ? data.photos : [];
        setPhotos(nextPhotos);
        onPhotosChanged?.(data?.match_count ?? nextPhotos.length);
      } catch (err) {
        onError?.(err?.response?.data?.error || err?.message || 'Failed to delete photo');
      } finally {
        setDeleteBusyId(null);
      }
    },
    [deleteBusyId, onError, onPhotosChanged, singlesId]
  );

  const viewerOpen = Boolean(viewerPhotoLabel || viewerPhotoLoading || viewerPhotoUrl || viewerPhotoError);

  return (
    <>
      <ColorTemplate7PopupLargeDark
        open={open}
        onClose={handleClose}
        closeOnBackdrop
        closeButtonAriaLabel="Close photos list"
      >
        <ColorTemplate7PopupLargeDark.Title>Photos for singles_id {singlesId}</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          {loading ? (
            <ColorTemplate9TableData.EmptyText sx={{ textAlign: 'center' }}>Loading photos…</ColorTemplate9TableData.EmptyText>
          ) : null}
          {loadError ? (
            <ColorTemplate9TableData.EmptyText sx={{ textAlign: 'center', color: '#ffb4a9' }}>
              {loadError}
            </ColorTemplate9TableData.EmptyText>
          ) : null}
          {!loading && !loadError && photos.length === 0 ? (
            <ColorTemplate9TableData.EmptyText sx={{ textAlign: 'center' }}>No photos found.</ColorTemplate9TableData.EmptyText>
          ) : null}
          {showTable ? (
            <ColorTemplate9TableData.Table autoFitColumns minTableWidth={minTableWidthPx}>
              <ColorTemplate9TableData.HeaderRow gridTemplateColumns={gridTemplateColumns}>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>photos_id</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>type</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>File Name</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Thumb</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
                <ColorTemplate9TableData.HeaderCell>
                  <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>Action</ColorTemplate9TableData.BodyText>
                </ColorTemplate9TableData.HeaderCell>
              </ColorTemplate9TableData.HeaderRow>

              {photos.map((photo, index) => {
                const photosId = Number(photo.photosId);
                const busy = deleteBusyId === photosId;
                const fileName = String(photo.photoFileName || `photo_${photosId}`);
                return (
                  <ColorTemplate9TableData.BodyRow
                    key={photosId}
                    rowIndex={index}
                    gridTemplateColumns={gridTemplateColumns}
                  >
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>{photosId}</ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText sx={lookupBodyTextSx}>
                        {String(photo.photoType || 'uploaded')}
                      </ColorTemplate9TableData.BodyText>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell>
                      <ColorTemplate9TableData.BodyText
                        component="button"
                        type="button"
                        onClick={() => void handleOpenPhoto(photo)}
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
                      <Box
                        component="button"
                        type="button"
                        aria-label={`View photo ${photosId}`}
                        onClick={() => void handleOpenPhoto(photo)}
                        sx={{
                          border: 0,
                          p: 0,
                          m: 0,
                          width: PHOTO_THUMB_PX,
                          height: PHOTO_THUMB_PX,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          bgcolor: 'transparent'
                        }}
                      >
                        <Box
                          component="img"
                          src={adminPhotoThumbnailUrl(photosId)}
                          alt=""
                          loading="lazy"
                          sx={{
                            width: PHOTO_THUMB_PX,
                            height: PHOTO_THUMB_PX,
                            objectFit: 'cover',
                            display: 'block',
                            border: '1px solid var(--theme-primary-color)'
                          }}
                        />
                      </Box>
                    </ColorTemplate9TableData.BodyCell>
                    <ColorTemplate9TableData.BodyCell sx={{ justifyContent: 'center' }}>
                      <UnSelectedButtonTemplate
                        type="button"
                        fitLabelWidth
                        disabled={busy || deleteBusyId != null}
                        onClick={() => void handleDeletePhoto(photo)}
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
        open={viewerOpen}
        onClose={resetViewer}
        closeOnBackdrop
        closeButtonAriaLabel="Close photo viewer"
        overlaySx={{ zIndex: COLOR_TEMPLATE7_POPUP_Z_INDEX + 1 }}
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1}>
          {viewerPhotoLabel ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
              {viewerPhotoLabel}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {viewerPhotoLoading ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>Loading photo…</ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {viewerPhotoError ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', color: '#ffb4a9' }}>
              {viewerPhotoError}
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
          {viewerPhotoUrl ? (
            <Box
              component="img"
              src={viewerPhotoUrl}
              alt={viewerPhotoLabel || 'Photo'}
              sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}
