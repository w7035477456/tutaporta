import { Outlet } from 'react-router-dom';

// material-ui
import Box from '@mui/material/Box';

// project imports
import useConfig from 'hooks/useConfig';
import ZoomBar from 'layout/MainLayout/ZoomBar';

// ==============================|| MINIMAL LAYOUT ||============================== //

export default function MinimalLayout() {
  const showZoom = (import.meta.env.SHOW_ZOOM ?? '').toString().trim().toLowerCase() === 'true';
  const {
    state: { pageZoom },
    setField
  } = useConfig();
  const zoomFactor = (pageZoom ?? 100) / 100;
  const isZoomDefault = zoomFactor === 1;

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          ...(!isZoomDefault && {
            width: `${100 / zoomFactor}%`,
            minHeight: `${100 / zoomFactor}vh`,
            transform: `scale(${zoomFactor})`,
            transformOrigin: '0 0'
          })
        }}
      >
        <Outlet />
      </Box>
      {showZoom && <ZoomBar value={pageZoom ?? 100} onChange={(v) => setField('pageZoom', v)} />}
    </>
  );
}
