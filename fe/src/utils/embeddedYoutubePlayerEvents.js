/** Open Embedded Youtube Player from elsewhere (e.g. My Album&Posts album titles). */
export const OPEN_EMBEDDED_YOUTUBE_PLAYER_EVENT = 'vsingles:open-embedded-youtube-player';

/**
 * @param {{ slotIndex?: number, play?: boolean }} [detail]
 * slotIndex is 0-based (Play 1 = 0 … Play 10 = 9).
 */
export function openEmbeddedYoutubePlayer(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OPEN_EMBEDDED_YOUTUBE_PLAYER_EVENT, {
      detail: {
        slotIndex: Number.isFinite(Number(detail.slotIndex)) ? Math.trunc(Number(detail.slotIndex)) : null,
        play: detail.play === true
      }
    })
  );
}
