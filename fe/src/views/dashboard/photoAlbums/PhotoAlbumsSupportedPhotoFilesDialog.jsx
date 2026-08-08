import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';

/** Exact album-tray photo format matrix (priority order from product list). */
export const PHOTO_ALBUMS_SUPPORTED_PHOTO_ROWS = [
  { n: 1, formats: '.png' },
  { n: 2, formats: '.jpg .jpeg .jpe .jif .jfif .jfi' },
  { n: 3, formats: '.svg .svgz' },
  { n: 4, formats: '.webp' },
  { n: 5, formats: '.gif' },
  { n: 6, formats: '.avif' },
  { n: 7, formats: '.ico' },
  { n: 8, formats: '.bmp .dib' },
  { n: 9, formats: '.tiff .tif' },
  { n: 10, formats: '.apng' },
  { n: 11, formats: '.mp4', note: 'Video — drag to tray, place on album pages, click to play' },
  { n: 12, formats: '.heic .heif' }
];

export const PHOTO_ALBUMS_UNSUPPORTED_PHOTO_ROWS = [
  { n: 13, formats: '.jxl', why: 'No decoder in our sharp/libvips build' },
  {
    n: 14,
    formats: '.raw .arw .cr2 .cr3 .nef .nrw .orf .pef .rw2 .sr2 .srf .dng .x3f',
    why: 'Camera RAW needs libraw; sharp "raw" is pixel buffers only'
  },
  { n: 15, formats: '.pdf', why: 'Not an image; would need PDF rasterizer' },
  { n: 16, formats: '.psd', why: 'No reliable browser/sharp preview' },
  { n: 17, formats: '.ai', why: 'Illustrator; not decodable here' },
  { n: 18, formats: '.eps', why: 'PostScript; not decodable here' },
  { n: 19, formats: '.indd .ind .indt', why: 'InDesign; proprietary' },
  { n: 20, formats: '.jp2 .j2k .jpf .jpx .jpm .mj2', why: 'Needs OpenJPEG (not in this sharp build)' },
  { n: 21, formats: '.tga', why: 'Not in this sharp build' },
  { n: 22, formats: '.wmf', why: 'Windows metafile; no decoder' },
  { n: 23, formats: '.pcx', why: 'No decoder' },
  { n: 24, formats: '.pict', why: 'Legacy Mac; no decoder' },
  { n: 25, formats: '.xcf', why: 'GIMP; no decoder' }
];

const cellSx = {
  color: 'inherit',
  WebkitTextFillColor: 'inherit',
  borderColor: 'rgba(255,255,255,0.22)',
  py: 0.55,
  px: 1,
  fontSize: { xs: '0.78rem', sm: '0.88rem' },
  verticalAlign: 'top',
  lineHeight: 1.35
};

const headCellSx = {
  ...cellSx,
  fontWeight: 800,
  borderBottomWidth: 2
};

/**
 * Dark popup: Supported + Not supported photo file tables for the album tray.
 */
export default function PhotoAlbumsSupportedPhotoFilesDialog({ open, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark open={Boolean(open)} onClose={onClose} maxWidth="720px">
      <ColorTemplate7PopupLargeDark.Title>Photo file types for the album tray</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body bodyTextAlignLeft spacing={2}>
        <Box>
          <Typography
            component="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1rem', sm: '1.1rem' },
              mb: 0.75,
              color: 'inherit',
              WebkitTextFillColor: 'inherit'
            }}
          >
            Supported
          </Typography>
          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 48 }}>#</TableCell>
                <TableCell sx={headCellSx}>Formats</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PHOTO_ALBUMS_SUPPORTED_PHOTO_ROWS.map((row) => (
                <TableRow key={`sup-${row.n}`}>
                  <TableCell sx={cellSx}>{row.n}</TableCell>
                  <TableCell sx={{ ...cellSx, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                    {row.formats}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Box>
          <Typography
            component="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1rem', sm: '1.1rem' },
              mb: 0.75,
              color: 'inherit',
              WebkitTextFillColor: 'inherit'
            }}
          >
            Not supported for
          </Typography>
          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 48 }}>#</TableCell>
                <TableCell sx={{ ...headCellSx, width: '42%' }}>Formats</TableCell>
                <TableCell sx={headCellSx}>Why</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PHOTO_ALBUMS_UNSUPPORTED_PHOTO_ROWS.map((row) => (
                <TableRow key={`unsup-${row.n}`}>
                  <TableCell sx={cellSx}>{row.n}</TableCell>
                  <TableCell sx={{ ...cellSx, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                    {row.formats}
                  </TableCell>
                  <TableCell sx={cellSx}>{row.why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

PhotoAlbumsSupportedPhotoFilesDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func
};
