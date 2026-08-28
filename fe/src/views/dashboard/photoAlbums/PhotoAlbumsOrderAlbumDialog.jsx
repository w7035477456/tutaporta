import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import GreenButton from 'ui-component/GreenButton';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  DEFAULT_ORDER_ALBUM_NAME,
  orderAlbumItemLabel
} from './photoAlbumsOrderAlbum';

const blackTextSx = {
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important'
};

/**
 * Lists items queued for For Order / print (print server later).
 * Album display name defaults to ForOrder.
 */
export default function PhotoAlbumsOrderAlbumDialog({
  open,
  items,
  albumName = DEFAULT_ORDER_ALBUM_NAME,
  onAlbumNameChange,
  onClose,
  onRemove,
  onOpenItem
}) {
  const list = Array.isArray(items) ? items : [];
  const [draftName, setDraftName] = useState(
    () => String(albumName || '').trim() || DEFAULT_ORDER_ALBUM_NAME
  );

  useEffect(() => {
    if (!open) return;
    setDraftName(String(albumName || '').trim() || DEFAULT_ORDER_ALBUM_NAME);
  }, [open, albumName]);

  const commitName = (next) => {
    const cleaned = String(next || '').trim() || DEFAULT_ORDER_ALBUM_NAME;
    setDraftName(cleaned);
    onAlbumNameChange?.(cleaned);
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      aria-labelledby="pa-order-album-title"
      PaperProps={{
        sx: {
          bgcolor: '#fff8e1',
          color: '#000000',
          WebkitTextFillColor: '#000000',
          borderRadius: 2,
          px: 2.5,
          py: 2,
          maxWidth: 480,
          width: '92vw',
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
          '& .MuiTypography-root': blackTextSx
        }
      }}
    >
      <Typography
        id="pa-order-album-title"
        component="h2"
        sx={{
          textAlign: 'center',
          fontWeight: 800,
          fontSize: '1.25rem',
          mb: 1,
          ...blackTextSx
        }}
      >
        For Order
      </Typography>
      <Typography
        sx={{
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '0.9rem',
          mb: 1.5,
          lineHeight: 1.4,
          ...blackTextSx
        }}
      >
        Pages and albums queued here can later be sent to a photo printing server.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5
        }}
      >
        <Box
          component="input"
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => commitName(draftName)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitName(draftName);
            }
          }}
          aria-label="Order album name"
          sx={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            border: '2px solid #000',
            borderRadius: 1,
            px: 1.25,
            py: 1,
            fontWeight: 700,
            fontSize: '1rem',
            bgcolor: '#fff',
            color: '#000',
            WebkitTextFillColor: '#000',
            outline: 'none'
          }}
        />
        <ColorTemplate7PopupLargeDark.ClearX
          aria-label="Reset order album name to ForOrder"
          onClick={() => commitName(DEFAULT_ORDER_ALBUM_NAME)}
        />
      </Box>

      {list.length ? (
        <Box sx={{ maxHeight: 320, overflow: 'auto', mb: 1.5 }}>
          {list.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 0.75,
                px: 1,
                mb: 0.5,
                border: '2px solid #000',
                borderRadius: 1,
                bgcolor: '#fff'
              }}
            >
              <Typography
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: typeof onOpenItem === 'function' ? 'pointer' : 'default',
                  ...blackTextSx
                }}
                title={
                  typeof onOpenItem === 'function'
                    ? `Open ${orderAlbumItemLabel(item)}`
                    : orderAlbumItemLabel(item)
                }
                onClick={() => {
                  if (typeof onOpenItem !== 'function') return;
                  onOpenItem(item);
                }}
              >
                {orderAlbumItemLabel(item)}
              </Typography>
              <Box
                component="button"
                type="button"
                aria-label={`Remove ${orderAlbumItemLabel(item)}`}
                {...guestDemoBlockProps()}
                onClick={() => onRemove?.(item.id)}
                sx={{
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  bgcolor: '#c62828',
                  color: '#fff',
                  WebkitTextFillColor: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                ×
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography sx={{ textAlign: 'center', fontWeight: 700, mb: 2, ...blackTextSx }}>
          {draftName || DEFAULT_ORDER_ALBUM_NAME} is empty. Use Order Print or Add Order Album to
          add the current page, or drag an album / album-set / shortcut onto For Order.
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <GreenButton
          type="button"
          onClick={() => {
            commitName(draftName);
            onClose?.();
          }}
          sx={{ minWidth: 96 }}
        >
          OK
        </GreenButton>
      </Box>
    </Dialog>
  );
}

PhotoAlbumsOrderAlbumDialog.propTypes = {
  open: PropTypes.bool,
  items: PropTypes.array,
  albumName: PropTypes.string,
  onAlbumNameChange: PropTypes.func,
  onClose: PropTypes.func,
  onRemove: PropTypes.func,
  onOpenItem: PropTypes.func
};
