/** Shared AudioContext for UI sounds (click, mall boop, etc.). */
let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Short “UI click” using Web Audio API (no audio file).
 * Call only after a user gesture when possible; resumes suspended contexts.
 */
/** @param {number} [volume01] — 0–1, scales click loudness (0 = silent). */
export function playUiClickSound(volume01 = 1) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const v = Math.max(0, Math.min(1, volume01));
    if (v <= 0) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.022);
    gain.gain.setValueAtTime(0.1 * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    /* ignore */
  }
}
