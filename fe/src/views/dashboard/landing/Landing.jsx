import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { useAuth } from 'contexts/AuthContext';
import { useSiteAudio } from 'contexts/SiteAudioContext';

import onlinemall from 'assets/images/onlineMallInside.png';
import eMarketPlaceImg from 'assets/images/onlineMarketPlace.png';
import vProfessionalsImg from 'assets/images/onlineProfessionals.png';
import eClassifiedsImg from 'assets/images/onlineClassifieds.png';
import tutaAlbumsImg from 'assets/images/tutaalbums.png';
import tutaDatesImg from 'assets/images/tutaDates.png';
import tutaNotesImg from 'assets/images/tutaNotes.png';
import { MY_RECORD_VAULT_PATH } from 'constants/myRecordVaultRoute';
import { MY_PHOTO_ALBUMS_PATH } from 'constants/myPhotoAlbumsRoute';

// ==============================|| LANDING PAGE ||============================== //

const departments = [
  { id: 'vsingles', title: 'Tuta Dates', url: '/vsingles', image: tutaDatesImg },
  { id: 'eMarketPlace', title: 'Online MarketPlace', url: '/eMarketPlace', image: eMarketPlaceImg },
  { id: 'photoAlbums', title: 'TutaPhotoAlbums', url: MY_PHOTO_ALBUMS_PATH, image: tutaAlbumsImg },
  { id: 'onlineProfessionals', title: 'onlineProfessionals', url: '/onlineProfessionals', image: vProfessionalsImg },
  { id: 'eClassifieds', title: 'eClassifieds', url: '/eClassifieds', image: eClassifiedsImg },
  { id: 'recordVault', title: 'TutaNotes', url: MY_RECORD_VAULT_PATH, image: tutaNotesImg }
];

// Play a short "boop" using Web Audio API (no asset needed)
function playBoop(audioContextRef, gainMultiplier = 1) {
  try {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const m = Math.max(0, Math.min(1, gainMultiplier));
    if (m <= 0) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15 * m, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (_) {
    // ignore if audio not allowed
  }
}

/** Tile grid: flex + gap is more reliable than CSS grid + transform:scale() on Firefox/Linux (avoids collapsed/overlapping gaps). */
const MALL_LAYOUT_BASE = {
  tileSize: 280,
  columnGap: 48,
  rowGap: 40
};
/** Below this width, use 2×3 instead of 3×2 so the stage is narrower and scale() keeps tiles legible on phones. */
const MALL_NARROW_BREAKPOINT = 700;
/** Slightly reduce narrow scale to avoid right-edge clipping on some phones. */
const MALL_NARROW_SAFE_SCALE = 0.94;

function getMallStageSize(cols, rows) {
  const { tileSize, columnGap, rowGap } = MALL_LAYOUT_BASE;
  const w = cols * tileSize + (cols - 1) * columnGap;
  const h = rows * tileSize + (rows - 1) * rowGap;
  return { stageW: w, stageH: h, cols, rows };
}

export default function Landing() {
  const { user } = useAuth();
  const { mediaVolume } = useSiteAudio();
  const audioContextRef = useRef(null);
  const mallAreaRef = useRef(null);
  const [mallScale, setMallScale] = useState(1);
  const [mallGrid, setMallGrid] = useState(() => getMallStageSize(3, 2));

  const visibleDepartments = useMemo(() => {
    const memberKeys = [user?.member_id, user?.member_category]
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean);
    const isPublic = memberKeys.includes('public') || memberKeys.includes('demouser');
    const mode = String(user?.mallDepartmentMode ?? '').trim().toLowerCase();
    const showVSingles = mode === 'all' || mode === 'vsingles_only' || mode === 'vsingles_and_emarketplace';
    const showEMarketPlace = mode === 'all' || mode === 'emarketplace_only' || mode === 'vsingles_and_emarketplace';
    const byMode = departments.filter(
      (d) =>
        (d.id === 'vsingles' && showVSingles) ||
        (d.id === 'eMarketPlace' && showEMarketPlace) ||
        (!['vsingles', 'eMarketPlace'].includes(d.id))
    );

    if (isPublic) {
      // Public/DemoUser now honor env mode (e.g. show_vsingles, show_eMarketPlace)
      return mode
        ? byMode
        : departments.filter((d) => d.id === 'vsingles' || d.id === 'eMarketPlace' || d.id === 'recordVault' || d.id === 'photoAlbums');
    }
    if (mode && mode !== 'all') {
      return byMode;
    }
    return departments;
  }, [user?.mallDepartmentMode, user?.member_category, user?.member_id]);

  useEffect(() => {
    const el = mallAreaRef.current;
    if (!el) return undefined;

    const updateMallScale = () => {
      const narrow = window.innerWidth < MALL_NARROW_BREAKPOINT;
      const departmentCount = visibleDepartments.length;
      let nextGrid;
      if (departmentCount <= 1) {
        nextGrid = getMallStageSize(1, 1);
      } else if (departmentCount === 2) {
        nextGrid = getMallStageSize(2, 1);
      } else {
        const cols = narrow ? 2 : 3;
        const rows = Math.max(1, Math.ceil(departmentCount / cols));
        nextGrid = getMallStageSize(cols, rows);
      }
      setMallGrid(nextGrid);

      let availableWidth;
      let availableHeight;
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        availableWidth = Math.max(320, el.clientWidth);
        availableHeight = Math.max(220, el.clientHeight);
      } else {
        const isSmallScreen = window.innerWidth < 600;
        const reservedVerticalSpace = narrow ? (isSmallScreen ? 190 : 140) : 380;
        const horizontalChrome = narrow ? 24 : 48;
        availableWidth = Math.max(320, window.innerWidth - horizontalChrome);
        availableHeight = Math.max(220, window.innerHeight - reservedVerticalSpace);
      }

      const widthScale = availableWidth / nextGrid.stageW;
      const heightScale = availableHeight / nextGrid.stageH;
      let nextScale = Math.min(widthScale, heightScale);
      // Wide grid: hover scale(1.08) + rounding — leave a little headroom so nothing clips.
      if (departmentCount <= 1) {
        nextScale *= 0.98;
      } else if (!narrow) {
        nextScale *= 0.96;
      } else {
        nextScale *= MALL_NARROW_SAFE_SCALE;
      }

      const minScale = departmentCount <= 1 ? 0.35 : narrow ? 0.42 : 0.32;
      setMallScale(Math.max(minScale, Math.min(2, nextScale)));
    };

    updateMallScale();
    const ro = new ResizeObserver(() => updateMallScale());
    ro.observe(el);
    window.addEventListener('resize', updateMallScale);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateMallScale);
    };
  }, [visibleDepartments.length]);

  const handleTileHover = useCallback(() => {
    if (mediaVolume <= 0) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    playBoop(audioContextRef, mediaVolume);
  }, [mediaVolume]);

  return (
    <Box
      ref={mallAreaRef}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        backgroundImage: `url(${onlinemall})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        mx: 0,
        py: 0
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${mallGrid.stageW}px`,
          height: `${mallGrid.stageH}px`,
          transform: `translate(-50%, -50%) scale(${mallScale})`,
          transformOrigin: 'center center',
          overflow: 'visible',
          isolation: 'isolate',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${MALL_LAYOUT_BASE.rowGap}px`,
          boxSizing: 'border-box'
        }}
      >
        {(() => {
          const rowChunks = [];
          for (let i = 0; i < visibleDepartments.length; i += mallGrid.cols) {
            rowChunks.push(visibleDepartments.slice(i, i + mallGrid.cols));
          }
          return rowChunks;
        })().map((rowDepts, rowIndex) => (
          <Box
            key={rowIndex}
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: `${MALL_LAYOUT_BASE.columnGap}px`,
              flex: '0 0 auto',
              width: 'fit-content',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {rowDepts.map((d) => {
              const isLink = Boolean(d.url);

              return (
                <Box
                  key={d.id}
                  component={isLink ? Link : 'div'}
                  {...(isLink ? { to: d.url } : {})}
                  data-guest-demo-allow="true"
                  onMouseEnter={handleTileHover}
                  sx={{
                    position: 'relative',
                    flex: '0 0 auto',
                    width: `${MALL_LAYOUT_BASE.tileSize}px`,
                    height: `${MALL_LAYOUT_BASE.tileSize}px`,
                    minWidth: `${MALL_LAYOUT_BASE.tileSize}px`,
                    minHeight: `${MALL_LAYOUT_BASE.tileSize}px`,
                    borderRadius: 2,
                    overflow: 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isLink ? 'pointer' : 'default',
                    textDecoration: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    touchAction: 'manipulation',
                    border: '4px solid transparent',
                    boxSizing: 'border-box',
                    boxShadow: 'none',
                    zIndex: 1,
                    transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      zIndex: 2,
                      transform: 'scale(1.08)',
                      borderColor: 'var(--theme-error-color)',
                      boxShadow: 'inset 0 0 50px rgba(255, 0, 0, 0.6), 0 0 20px rgba(255, 0, 0, 0.4)'
                    }
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: 2,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'transparent',
                      boxShadow: 'none'
                    }}
                  >
                    {d.image ? (
                      <Box
                        component="img"
                        src={d.image}
                        alt={d.title}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      <Typography
                        variant="h5"
                        sx={{
                          px: 2,
                          textAlign: 'center',
                          color: 'secondary.main',
                          fontWeight: 600
                        }}
                      >
                        {d.title}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
