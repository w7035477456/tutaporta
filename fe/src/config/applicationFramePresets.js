/**
 * Application frame presets — pick one when starting a new themed mini-app.
 *
 * Usage:
 *   import { FAMILY_CONNECTIONS_APPLICATION_FRAME } from 'config/applicationFramePresets';
 *   import ColorTemplate15ApplicationFrame from 'ui-component/ColorTemplate15ApplicationFrame';
 *
 *   <ColorTemplate15ApplicationFrame
 *     preset={FAMILY_CONNECTIONS_APPLICATION_FRAME}
 *     headerLeft={<Logo />}
 *     headerRight={<ProfileSection />}
 *     sidebarMenu={<MyColorTemplate10Menu />}
 *   >
 *     {routes}
 *   </ColorTemplate15ApplicationFrame>
 */
import { DATING_TOP_BANNER_IMAGE } from 'config/datingTopBanner';

/**
 * @typedef {{
 *   id: string,
 *   label?: string,
 *   topBannerImage?: string | null,
 *   sidebarPhrase?: string,
 *   footerInline?: boolean,
 *   showMusicControls?: boolean,
 *   showSupportButton?: boolean
 * }} ApplicationFramePreset
 */

/** Current dating / vsingles shell (OnlineMall.Website). */
/** @type {ApplicationFramePreset} */
export const VSINGLES_APPLICATION_FRAME = {
  id: 'vsingles',
  label: 'vSingles Dating',
  topBannerImage: DATING_TOP_BANNER_IMAGE,
  sidebarPhrase:
    'From a fun social media feed and trusted 3rd-party safety vetting to playful chatting and flower gifting - we have built the perfect home for love.',
  footerInline: true,
  showMusicControls: true,
  showSupportButton: true
};

/** Starter template — duplicate and customize for a new app. */
/** @type {ApplicationFramePreset} */
export const FAMILY_CONNECTIONS_APPLICATION_FRAME = {
  id: 'family-connections',
  label: 'Family Connections',
  topBannerImage: null,
  sidebarPhrase:
    'Stay close to the people who matter most — share milestones, photos, and family stories in one trusted place.',
  footerInline: false,
  showMusicControls: true,
  showSupportButton: true
};

/** Starter template — duplicate and customize for a new app. */
/** @type {ApplicationFramePreset} */
export const PROFESSIONAL_CONNECTIONS_APPLICATION_FRAME = {
  id: 'professional-connections',
  label: 'Professional Connections',
  topBannerImage: null,
  sidebarPhrase:
    'Build your network with confidence — showcase your work, connect with peers, and grow your career.',
  footerInline: false,
  showMusicControls: true,
  showSupportButton: true
};

/** @type {Record<string, ApplicationFramePreset>} */
export const APPLICATION_FRAME_PRESETS = {
  vsingles: VSINGLES_APPLICATION_FRAME,
  'family-connections': FAMILY_CONNECTIONS_APPLICATION_FRAME,
  'professional-connections': PROFESSIONAL_CONNECTIONS_APPLICATION_FRAME
};

/**
 * @param {string | ApplicationFramePreset | null | undefined} preset
 * @returns {ApplicationFramePreset | null}
 */
export function resolveApplicationFramePreset(preset) {
  if (!preset) return null;
  if (typeof preset === 'string') {
    return APPLICATION_FRAME_PRESETS[preset] ?? null;
  }
  return preset;
}
