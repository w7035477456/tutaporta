import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import GlobalStyles from '@mui/material/GlobalStyles';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { handlerDrawerOpen } from 'api/menu';
import useVsinglesTour from 'hooks/useVsinglesTour';
import {
  TOUR_STEP_ALL_SINGLES,
  TOUR_STEP_MY_PICKS,
  TOUR_STEP_PICKS_BRIEF_BIO,
  TOUR_STEP_THEME,
  TOUR_STEP_VETTED_FRIENDS_SMS,
  VSINGLES_LANDING_PATH,
  consumePendingVsinglesTourStart,
  endVsinglesTour,
  goToTourStep,
  isVsinglesTourRoute
} from 'utils/vsinglesTour';
import { markTourDemoMembersAsPicks, requestTourDemoBriefBios } from 'utils/vsinglesTourActions';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';

import { VSINGLES_TOUR_STEPS } from './vsinglesTourSteps';

const TOUR_POPUP_MAX_WIDTH = 780;
const TOUR_POPUP_STEP1_MAX_WIDTH = 960;
const TOUR_POPUP_STEP2_MAX_WIDTH = 840;
const TOUR_MENU_GAP_PX = 40;

const tourPopupSx = {
  position: 'relative',
  bgcolor: '#ffeb3b',
  color: '#000',
  border: '4px solid #000',
  borderRadius: 3,
  p: { xs: 2.5, sm: 3.5 },
  pt: { xs: 3.5, sm: 4 },
  boxShadow: '8px 8px 0 #000',
  outline: 'none',
  pointerEvents: 'auto',
  maxWidth: '92vw'
};

const tourEndCornerButtonSx = {
  position: 'absolute',
  top: { xs: 10, sm: 12 },
  right: { xs: 10, sm: 12 },
  zIndex: 1,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: { xs: '1rem', sm: '1.1rem' },
  color: '#000',
  borderColor: '#000',
  borderWidth: 2,
  bgcolor: '#ffeb3b',
  px: { xs: 1.25, sm: 1.5 },
  py: { xs: 0.35, sm: 0.5 },
  minWidth: 0,
  lineHeight: 1.2,
  '&:hover': { borderColor: '#000', borderWidth: 2, bgcolor: '#ffe566' }
};

const tourActionButtonSx = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: { xs: '1.2rem', sm: '1.35rem' },
  color: '#000',
  borderColor: '#000',
  borderWidth: 2,
  minWidth: 100,
  px: 2,
  py: 1,
  '&:hover': { borderColor: '#000', borderWidth: 2, bgcolor: 'rgba(0,0,0,0.08)' }
};

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const TOUR_BLOCK_LAYER_Z = 1800;
const TOUR_POPUP_Z = 1801;
const TOUR_ARROWS_Z = 1800;
const TOUR_ARROW_COLOR = '#e53935';
const TOUR_ARROW_STROKE_WIDTH = 9;
const TOUR_ARROW_HEAD_SIZE = 5;

const BLOCKED_INTERACTION_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'pointerdown',
  'pointerup',
  'dblclick',
  'contextmenu'
];

function isTourAllowedTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-vsingles-tour-allow]'));
}

function useBlockTourInteractions(open) {
  useEffect(() => {
    if (!open) return undefined;

    const blockInteraction = (event) => {
      if (isTourAllowedTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    };

    const opts = { capture: true };
    BLOCKED_INTERACTION_EVENTS.forEach((name) => {
      document.addEventListener(name, blockInteraction, opts);
    });

    return () => {
      BLOCKED_INTERACTION_EVENTS.forEach((name) => {
        document.removeEventListener(name, blockInteraction, opts);
      });
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.classList.add('vsingles-guided-tour-active');
    } else {
      document.body.classList.remove('vsingles-guided-tour-active');
    }
    return () => document.body.classList.remove('vsingles-guided-tour-active');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') return;
      const active = document.activeElement;
      if (isTourAllowedTarget(active)) return;
      event.preventDefault();
      document.querySelector('[data-vsingles-tour-allow]')?.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    const focusTimer = window.setTimeout(() => {
      document.querySelector('[data-vsingles-tour-allow]')?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(focusTimer);
    };
  }, [open]);
}

function TourArrows({ arrows }) {
  if (!arrows?.length) return null;

  return (
    <Box
      component="svg"
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: TOUR_ARROWS_Z,
        overflow: 'visible'
      }}
    >
      <defs>
        <marker
          id="vsingles-tour-arrowhead"
          markerWidth={TOUR_ARROW_HEAD_SIZE}
          markerHeight={TOUR_ARROW_HEAD_SIZE}
          refX={TOUR_ARROW_HEAD_SIZE - 1}
          refY={TOUR_ARROW_HEAD_SIZE / 2}
          orient="auto"
        >
          <path
            d={`M0,0 L${TOUR_ARROW_HEAD_SIZE},${TOUR_ARROW_HEAD_SIZE / 2} L0,${TOUR_ARROW_HEAD_SIZE} Z`}
            fill={TOUR_ARROW_COLOR}
          />
        </marker>
      </defs>
      {arrows.map((arrow) => (
        <line
          key={arrow.id}
          x1={arrow.x1}
          y1={arrow.y1}
          x2={arrow.x2}
          y2={arrow.y2}
          stroke={TOUR_ARROW_COLOR}
          strokeWidth={TOUR_ARROW_STROKE_WIDTH}
          strokeLinecap="round"
          markerEnd="url(#vsingles-tour-arrowhead)"
        />
      ))}
    </Box>
  );
}

export default function VsinglesGuidedTourOverlay() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const preferCentered = useMediaQuery(theme.breakpoints.down('md'));
  const { open, step } = useVsinglesTour();
  const popupRef = useRef(null);
  const [popupStyle, setPopupStyle] = useState(null);
  const [arrows, setArrows] = useState([]);
  const [advancing, setAdvancing] = useState(false);

  const stepConfig = step != null ? VSINGLES_TOUR_STEPS[step] : null;

  useEffect(() => {
    if (pathname === VSINGLES_LANDING_PATH) {
      consumePendingVsinglesTourStart();
    }
    if (!isVsinglesTourRoute(pathname)) {
      endVsinglesTour();
      setPopupStyle(null);
      setArrows([]);
    }
  }, [pathname]);

  useEffect(() => {
    if (open && step != null) {
      document.body.dataset.vsinglesTourStep = String(step);
    } else {
      delete document.body.dataset.vsinglesTourStep;
    }
    return () => {
      delete document.body.dataset.vsinglesTourStep;
    };
  }, [open, step]);

  const measureThemeStepLayout = useCallback(
    (popupEl, popupWidth) => {
      const themeEl = document.querySelector('[data-vsingles-tour-theme]');
      const logoutEl = document.querySelector('[data-vsingles-tour-logout]');
      const menuEl = document.querySelector('[data-vsingles-tour-profile-menu]');

      if (preferCentered || !menuEl || !themeEl || !logoutEl) {
        setPopupStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: popupWidth
        });
        setArrows([]);
        return;
      }

      const popupRect = popupEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const popupHeight = popupRect.height || 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = menuRect.left - popupWidth - TOUR_MENU_GAP_PX;
      let top = menuRect.top + menuRect.height * 0.12;

      if (left < 12) {
        left = clamp(menuRect.left - popupWidth - 16, 12, vw - popupWidth - 12);
      }
      top = clamp(top, 12, vh - popupHeight - 12);

      setPopupStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: popupWidth,
        transform: 'none'
      });

      const popupBox = {
        left,
        top,
        right: left + popupWidth,
        bottom: top + popupHeight,
        width: popupWidth,
        height: popupHeight
      };

      const themeCenter = rectCenter(themeEl.getBoundingClientRect());
      const logoutCenter = rectCenter(logoutEl.getBoundingClientRect());

      setArrows([
        {
          id: 'theme',
          x1: popupBox.right - 8,
          y1: popupBox.top + popupBox.height * 0.22,
          x2: themeCenter.x,
          y2: themeCenter.y
        },
        {
          id: 'logout',
          x1: popupBox.left + popupBox.width * 0.18,
          y1: popupBox.bottom - 10,
          x2: logoutCenter.x,
          y2: logoutCenter.y
        }
      ]);
    },
    [preferCentered]
  );

  const measureAllSinglesStepLayout = useCallback((popupEl, popupWidth) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const navEl = document.querySelector('[data-vsingles-tour-nav="allSingles"]');
    const picksEl = document.querySelector('[data-vsingles-tour-my-picks]');
    const filterEl = document.querySelector('[data-vsingles-tour-edit-filter]');

    const popupHeightEstimate = popupEl.getBoundingClientRect().height || 300;
    const gapAboveCard = 36;

    let anchorRect = null;
    if (picksEl) {
      const cardEl = picksEl.closest('.MuiCard-root');
      anchorRect = (cardEl || picksEl).getBoundingClientRect();
    } else if (filterEl) {
      anchorRect = filterEl.getBoundingClientRect();
    }

    let left = anchorRect
      ? anchorRect.left + anchorRect.width / 2 - popupWidth / 2
      : vw * 0.42 - popupWidth / 2;
    let top = anchorRect ? anchorRect.top - popupHeightEstimate - gapAboveCard : vh * 0.2;

    const navRect = navEl?.getBoundingClientRect();
    const minLeft = navRect ? navRect.right + 24 : 120;
    left = clamp(left, minLeft, vw - popupWidth - 16);
    top = clamp(top, 96, vh - popupHeightEstimate - 16);

    setPopupStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: popupWidth,
      transform: 'none'
    });

    const popupRect = popupEl.getBoundingClientRect();
    const popupBox = {
      left: popupRect.left,
      top: popupRect.top,
      right: popupRect.right,
      bottom: popupRect.bottom,
      width: popupRect.width,
      height: popupRect.height || popupHeightEstimate
    };

    const nextArrows = [];

    if (navEl) {
      const navCenter = rectCenter(navEl.getBoundingClientRect());
      nextArrows.push({
        id: 'allSinglesNav',
        x1: popupBox.left,
        y1: popupBox.top + popupBox.height * 0.5,
        x2: navCenter.x,
        y2: navCenter.y
      });
    }

    if (filterEl) {
      const filterCenter = rectCenter(filterEl.getBoundingClientRect());
      nextArrows.push({
        id: 'editFilter',
        x1: popupBox.right,
        y1: popupBox.top + popupBox.height * 0.5,
        x2: filterCenter.x,
        y2: filterCenter.y
      });
    }

    if (picksEl) {
      const picksCenter = rectCenter(picksEl.getBoundingClientRect());
      nextArrows.push({
        id: 'myPicks',
        x1: popupBox.left + popupBox.width / 2,
        y1: popupBox.bottom,
        x2: picksCenter.x,
        y2: picksCenter.y
      });
    }

    setArrows(nextArrows);
  }, []);

  const measureMyPicksStepLayout = useCallback((popupEl, popupWidth) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupHeight = popupEl.getBoundingClientRect().height || 420;
    const gap = 20;

    let left = vw - popupWidth - gap;
    let top = Math.max(88, (vh - popupHeight) / 2 - 24);

    if (preferCentered) {
      left = (vw - popupWidth) / 2;
      top = Math.max(88, (vh - popupHeight) / 2);
    }

    left = clamp(left, 16, vw - popupWidth - 16);
    top = clamp(top, 88, vh - popupHeight - 16);

    setPopupStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: popupWidth,
      transform: 'none',
      maxHeight: `min(${vh - top - 16}px, 92vh)`,
      overflowY: 'auto'
    });

    const popupRect = popupEl.getBoundingClientRect();
    const popupBox = {
      left: popupRect.left,
      top: popupRect.top,
      right: popupRect.right,
      bottom: popupRect.bottom,
      width: popupRect.width,
      height: popupRect.height || popupHeight
    };

    const bioEl = document.querySelector('[data-vsingles-tour-my-picks-bio]');
    const nextArrows = [];

    if (bioEl) {
      const buttons = bioEl.querySelectorAll('button');
      const bioRect = bioEl.getBoundingClientRect();
      if (buttons.length >= 2) {
        const briefCenter = rectCenter(buttons[0].getBoundingClientRect());
        const fullCenter = rectCenter(buttons[1].getBoundingClientRect());
        nextArrows.push({
          id: 'briefBio',
          x1: popupBox.left + 16,
          y1: popupBox.top + popupBox.height * 0.72,
          x2: briefCenter.x,
          y2: briefCenter.y
        });
        nextArrows.push({
          id: 'fullBio',
          x1: popupBox.left + popupBox.width * 0.35,
          y1: popupBox.top + popupBox.height * 0.78,
          x2: fullCenter.x,
          y2: fullCenter.y
        });
      } else {
        const center = rectCenter(bioRect);
        nextArrows.push({
          id: 'bioActions',
          x1: popupBox.left + popupBox.width / 2,
          y1: popupBox.top + popupBox.height * 0.75,
          x2: center.x,
          y2: center.y
        });
      }
    }

    setArrows(nextArrows);
  }, [preferCentered]);

  const measureBriefBioStepLayout = useCallback((popupEl, popupWidth) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupHeight = popupEl.getBoundingClientRect().height || 420;
    const gap = 20;

    let left = vw - popupWidth - gap;
    let top = Math.max(88, (vh - popupHeight) / 2 - 24);

    if (preferCentered) {
      left = (vw - popupWidth) / 2;
      top = Math.max(88, (vh - popupHeight) / 2);
    }

    left = clamp(left, 16, vw - popupWidth - 16);
    top = clamp(top, 88, vh - popupHeight - 16);

    setPopupStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: popupWidth,
      transform: 'none',
      maxHeight: `min(${vh - top - 16}px, 92vh)`,
      overflowY: 'auto'
    });

    const popupRect = popupEl.getBoundingClientRect();
    const popupBox = {
      left: popupRect.left,
      top: popupRect.top,
      right: popupRect.right,
      bottom: popupRect.bottom,
      width: popupRect.width,
      height: popupRect.height || popupHeight
    };

    const briefButtons = document.querySelectorAll('[data-vsingles-tour-brief-bio]');
    const nextArrows = [];

    briefButtons.forEach((btn, index) => {
      const center = rectCenter(btn.getBoundingClientRect());
      const yStart = popupBox.top + popupBox.height * (0.35 + index * 0.12);
      nextArrows.push({
        id: `briefBio-${index}`,
        x1: popupBox.left + 12,
        y1: yStart,
        x2: center.x,
        y2: center.y
      });
    });

    setArrows(nextArrows);
  }, [preferCentered]);

  const measureVettedFriendsSmsStepLayout = useCallback((popupEl, popupWidth) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupHeight = popupEl.getBoundingClientRect().height || 480;
    const gap = 20;

    let left = vw - popupWidth - gap;
    let top = Math.max(72, (vh - popupHeight) * 0.12);

    left = clamp(left, 16, vw - popupWidth - 16);
    top = clamp(top, 72, vh - popupHeight - 16);

    setPopupStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: popupWidth,
      transform: 'none',
      maxHeight: `min(${vh - top - 16}px, 92vh)`,
      overflowY: 'auto'
    });

    const popupRect = popupEl.getBoundingClientRect();
    const popupBox = {
      left: popupRect.left,
      top: popupRect.top,
      right: popupRect.right,
      bottom: popupRect.bottom,
      width: popupRect.width,
      height: popupRect.height || popupHeight
    };

    const smsBtn = document.querySelector('[data-vsingles-tour-sms-chat]');
    const navEl = document.querySelector('[data-vsingles-tour-nav="util-requests-sent"]');
    const nextArrows = [];

    if (smsBtn) {
      const center = rectCenter(smsBtn.getBoundingClientRect());
      nextArrows.push({
        id: 'lisaSmsChat',
        x1: popupBox.left + popupBox.width * 0.35,
        y1: popupBox.bottom - 24,
        x2: center.x,
        y2: center.y
      });
    }

    if (navEl) {
      const navCenter = rectCenter(navEl.getBoundingClientRect());
      nextArrows.push({
        id: 'vettedFriendsNav',
        x1: popupBox.left + 20,
        y1: popupBox.top + popupBox.height * 0.22,
        x2: navCenter.x,
        y2: navCenter.y
      });
    }

    setArrows(nextArrows);
  }, []);

  const measureLayout = useCallback(() => {
    const popupEl = popupRef.current;
    if (!popupEl || step == null) return;

    const popupWidth = Math.min(
      step === TOUR_STEP_ALL_SINGLES
        ? TOUR_POPUP_STEP1_MAX_WIDTH
        : step === TOUR_STEP_MY_PICKS ||
            step === TOUR_STEP_PICKS_BRIEF_BIO ||
            step === TOUR_STEP_VETTED_FRIENDS_SMS
          ? TOUR_POPUP_STEP2_MAX_WIDTH
          : TOUR_POPUP_MAX_WIDTH,
      window.innerWidth * 0.92
    );

    if (step === TOUR_STEP_THEME) {
      measureThemeStepLayout(popupEl, popupWidth);
    } else if (step === TOUR_STEP_ALL_SINGLES) {
      measureAllSinglesStepLayout(popupEl, popupWidth);
    } else if (step === TOUR_STEP_MY_PICKS) {
      measureMyPicksStepLayout(popupEl, popupWidth);
    } else if (step === TOUR_STEP_PICKS_BRIEF_BIO) {
      measureBriefBioStepLayout(popupEl, popupWidth);
    } else if (step === TOUR_STEP_VETTED_FRIENDS_SMS) {
      measureVettedFriendsSmsStepLayout(popupEl, popupWidth);
    }
  }, [
    measureAllSinglesStepLayout,
    measureBriefBioStepLayout,
    measureMyPicksStepLayout,
    measureThemeStepLayout,
    measureVettedFriendsSmsStepLayout,
    step
  ]);

  useLayoutEffect(() => {
    if (!open || step == null) return undefined;

    const runMeasure = () => measureLayout();

    runMeasure();
    const t1 = window.setTimeout(runMeasure, 80);
    const t2 = window.setTimeout(runMeasure, 280);
    const t3 = window.setTimeout(runMeasure, 600);
    const t4 = window.setTimeout(runMeasure, 900);

    window.addEventListener('resize', runMeasure);
    window.addEventListener('scroll', runMeasure, true);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.removeEventListener('resize', runMeasure);
      window.removeEventListener('scroll', runMeasure, true);
    };
  }, [open, step, measureLayout, pathname]);

  const handleEnd = useCallback(() => {
    endVsinglesTour();
  }, []);

  const handleNext = useCallback(async () => {
    if (advancing) return;
    if (step === TOUR_STEP_THEME) {
      goToTourStep(TOUR_STEP_ALL_SINGLES);
      handlerDrawerOpen(true);
      navigate('/allSingles');
      return;
    }
    if (step === TOUR_STEP_ALL_SINGLES) {
      setAdvancing(true);
      try {
        await markTourDemoMembersAsPicks();
        goToTourStep(TOUR_STEP_MY_PICKS);
        handlerDrawerOpen(true);
        navigate('/myPicks');
      } catch (err) {
        console.error('[VsinglesGuidedTour] mark demo picks failed', err);
        goToTourStep(TOUR_STEP_MY_PICKS);
        handlerDrawerOpen(true);
        navigate('/myPicks');
      } finally {
        setAdvancing(false);
      }
      return;
    }
    if (step === TOUR_STEP_MY_PICKS) {
      setAdvancing(true);
      try {
        await requestTourDemoBriefBios();
        goToTourStep(TOUR_STEP_PICKS_BRIEF_BIO);
      } catch (err) {
        console.error('[VsinglesGuidedTour] request demo brief bios failed', err);
        goToTourStep(TOUR_STEP_PICKS_BRIEF_BIO);
      } finally {
        setAdvancing(false);
      }
      return;
    }
    if (step === TOUR_STEP_PICKS_BRIEF_BIO) {
      setAdvancing(true);
      try {
        goToTourStep(TOUR_STEP_VETTED_FRIENDS_SMS);
        handlerDrawerOpen(true);
        navigate('/vettedFriends');
      } finally {
        setAdvancing(false);
      }
      return;
    }
    endVsinglesTour();
  }, [advancing, navigate, step]);

  const handlePrev = useCallback(() => {
    if (step === TOUR_STEP_VETTED_FRIENDS_SMS) {
      goToTourStep(TOUR_STEP_PICKS_BRIEF_BIO);
      handlerDrawerOpen(true);
      navigate('/myPicks');
      return;
    }
    if (step === TOUR_STEP_PICKS_BRIEF_BIO) {
      goToTourStep(TOUR_STEP_MY_PICKS);
      return;
    }
    if (step === TOUR_STEP_MY_PICKS) {
      goToTourStep(TOUR_STEP_ALL_SINGLES);
      navigate('/allSingles');
      return;
    }
    if (step === TOUR_STEP_ALL_SINGLES) {
      goToTourStep(TOUR_STEP_THEME);
      navigate('/vsingles');
    }
  }, [navigate, step]);

  useBlockTourInteractions(open);

  if (!open || step == null || !stepConfig) {
    return null;
  }

  const popupPositionSx =
    popupStyle ??
    (step === TOUR_STEP_MY_PICKS ||
      step === TOUR_STEP_PICKS_BRIEF_BIO ||
      step === TOUR_STEP_VETTED_FRIENDS_SMS
      ? {
          position: 'fixed',
          top: { xs: '12%', md: '14%' },
          right: { xs: 12, md: 20 },
          left: { xs: 12, md: 'auto' },
          width: { xs: 'min(92vw, 630px)', sm: TOUR_POPUP_STEP2_MAX_WIDTH },
          maxHeight: '92vh',
          overflowY: 'auto'
        }
      : step === TOUR_STEP_ALL_SINGLES
        ? {
            position: 'fixed',
            top: { xs: '16%', md: '20%' },
            left: { xs: '50%', md: '42%' },
            transform: { xs: 'translateX(-50%)', md: 'translateX(-50%)' },
            width: { xs: 'min(92vw, 630px)', sm: TOUR_POPUP_STEP1_MAX_WIDTH }
          }
        : stepConfig.centerPopup || preferCentered
        ? {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: 'min(92vw, 630px)', sm: TOUR_POPUP_STEP1_MAX_WIDTH }
          }
        : {
            position: 'fixed',
            top: '18%',
            right: { xs: 16, md: 320 },
            width: { xs: 'min(92vw, 630px)', sm: TOUR_POPUP_MAX_WIDTH }
          });

  return (
    <>
      <GlobalStyles
        styles={{
          'body.vsingles-guided-tour-active #root': { pointerEvents: 'none !important' },
          'body.vsingles-guided-tour-active .MuiModal-root': { pointerEvents: 'auto' }
        }}
      />
      <Modal
        open
        onClose={() => {}}
        disableEscapeKeyDown
        aria-labelledby="vsingles-guided-tour-title"
        aria-describedby="vsingles-guided-tour-body"
        sx={{ zIndex: TOUR_BLOCK_LAYER_Z }}
        slotProps={{
          backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.45)', pointerEvents: 'auto' } }
        }}
      >
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            outline: 'none'
          }}
        >
          <Box
            aria-hidden
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: TOUR_BLOCK_LAYER_Z,
              pointerEvents: 'auto',
              bgcolor: 'transparent'
            }}
          />
          <TourArrows arrows={arrows} />
          <Box
            ref={popupRef}
            role="dialog"
            aria-modal="true"
            className={LIGHT_SURFACE_CLASS}
            sx={{ ...tourPopupSx, ...popupPositionSx, zIndex: TOUR_POPUP_Z }}
          >
            {stepConfig.showEnd && (
              <Button
                type="button"
                variant="outlined"
                data-vsingles-tour-allow
                onClick={handleEnd}
                aria-label="End guided tour"
                sx={tourEndCornerButtonSx}
              >
                {stepConfig.endLabel ?? 'End Tour'}
              </Button>
            )}
            <Typography
              id="vsingles-guided-tour-title"
              component="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '2rem', sm: '2.6rem' },
                mb: 2,
                lineHeight: 1.2,
                pr: stepConfig.showEnd ? { xs: 6.5, sm: 7.5 } : 0
              }}
            >
              {stepConfig.title}
            </Typography>
            <Box id="vsingles-guided-tour-body" sx={{ mb: 3 }}>
              {stepConfig.body ? (
                <Typography sx={{ fontSize: { xs: '1.35rem', sm: '1.6rem' }, lineHeight: 1.45 }}>
                  {stepConfig.body}
                </Typography>
              ) : null}
              {stepConfig.bodyParagraphs?.map((paragraph) => (
                <Typography
                  key={paragraph}
                  sx={{ fontSize: { xs: '1.25rem', sm: '1.45rem' }, lineHeight: 1.45, mb: 1.5 }}
                >
                  {paragraph}
                </Typography>
              ))}
              {stepConfig.sections?.map((section) => (
                <Box key={section.heading} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.35rem', sm: '1.55rem' }, mb: 0.75 }}>
                    {section.heading}
                  </Typography>
                  {section.items.map((item) => (
                    <Typography
                      key={item}
                      component="p"
                      sx={{ fontSize: { xs: '1.15rem', sm: '1.3rem' }, lineHeight: 1.4, mb: 0.75, pl: 1 }}
                    >
                      {item}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
              {stepConfig.showPrev && (
                <Button
                  type="button"
                  variant="outlined"
                  data-vsingles-tour-allow
                  onClick={handlePrev}
                  disabled={advancing}
                  sx={tourActionButtonSx}
                >
                  {stepConfig.prevLabel ?? 'PREV'}
                </Button>
              )}
              {stepConfig.showNext && (
                <Button
                  type="button"
                  variant="outlined"
                  data-vsingles-tour-allow
                  onClick={() => void handleNext()}
                  disabled={advancing}
                  sx={tourActionButtonSx}
                >
                  {advancing ? '…' : stepConfig.nextLabel ?? 'Next'}
                </Button>
              )}
            </Stack>
          </Box>
        </Box>
      </Modal>
    </>
  );
}
