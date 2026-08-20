import { Outlet, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import './eClassifiedsStorybook.css';

const STORIES = [
  { path: '/eClassifieds/bpm-demo', label: 'BPM Demo' },
  { path: '/eClassifieds/my-listings', label: 'My Listings' },
  { path: '/eClassifieds/pending', label: 'Pending Approvals' },
  { path: '/eClassifieds/history', label: 'Process History' }
];

function storyTitle(pathname) {
  return STORIES.find((s) => pathname.startsWith(s.path))?.label || 'eClassifieds';
}

/**
 * Storybook-style chrome for the Classified Ad Moderation BPM helloworld.
 * Nav lives in the app sidebar only — no duplicate Stories rail.
 */
export default function EClassifiedsStorybookLayout() {
  const { pathname } = useLocation();
  const title = storyTitle(pathname);

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <div className="ecsb-root">
        <div className="ecsb-toolbar">
          <span className="ecsb-brand">Storybook</span>
          <span className="ecsb-toolbar-title">{title}</span>
          <span className="ecsb-toolbar-meta">Classified Ad Moderation · view-only diagram · static demo data</span>
        </div>
        <div className="ecsb-body">
          <div className="ecsb-main">
            <Outlet />
          </div>
        </div>
      </div>
    </Box>
  );
}
