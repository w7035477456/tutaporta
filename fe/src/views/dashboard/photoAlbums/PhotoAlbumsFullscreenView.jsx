import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { MY_PHOTO_ALBUMS_VIEW_PATH } from 'constants/myPhotoAlbumsRoute';
import PhotoAlbumsNoteEditor from './PhotoAlbumsNoteEditor';
import PhotoAlbumsTrafficWaitHost from './PhotoAlbumsTrafficWaitHost';
import { loadPhotoAlbumsPresentation } from './photoAlbumsPresentationSession';
import { reportPhotoAlbumsOverageThrottleDepleted } from 'utils/photoAlbumsOverageThrottleUi';

/**
 * Full screen / Full Slide album viewer — opened in a new tab from the editor.
 * No MainLayout chrome; the entire album page is fitted into the window.
 */
export default function PhotoAlbumsFullscreenView() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get('k') || '';

  const payload = useMemo(() => loadPhotoAlbumsPresentation(key), [key]);

  useEffect(() => {
    if (!payload) return undefined;
    return reportPhotoAlbumsOverageThrottleDepleted(Boolean(payload.overageThrottled));
  }, [payload]);

  if (!payload?.html) {
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          bgcolor: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          textAlign: 'center'
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
          Album view expired or unavailable. Close this tab and open Full screen again from the album editor.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        bgcolor: '#1a1a1a',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <PhotoAlbumsTrafficWaitHost />
      <PhotoAlbumsNoteEditor
        initialContent={payload.html}
        editable={false}
        noteId={payload.noteId != null && Number(payload.noteId) > 0 ? Number(payload.noteId) : null}
        storageType={payload.storageType || null}
        presentationMode
        presentationFullSlide={Boolean(payload.fullSlide)}
        presentationPageIndex={Math.max(0, Number(payload.pageIndex) || 0)}
        albumTitle={String(payload.albumTitle || '').trim()}
      />
    </Box>
  );
}

PhotoAlbumsFullscreenView.path = MY_PHOTO_ALBUMS_VIEW_PATH;
