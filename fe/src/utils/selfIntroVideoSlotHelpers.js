import { SELF_INTRO_VIDEO_SLOT_MAX } from 'constants/selfIntroVideoLimits';

export const SELF_INTRO_VIDEO_SLOTS_FULL_MESSAGE =
  'You can have up to three 1 minute video. Please delete one to make room for new video.';

export function allSelfIntroVideoSlotsFull(slots) {
  if (!Array.isArray(slots) || slots.length < SELF_INTRO_VIDEO_SLOT_MAX) return false;
  return slots.every((slot) => Number(slot?.videoId) > 0);
}
