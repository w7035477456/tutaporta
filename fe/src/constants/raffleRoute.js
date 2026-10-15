/** Public raffle rules page. */
export const RAFFLE_PATH = '/raffle';
/** Public page showing a sample raffle screenshot (image at /raffleimage.jpg). */
export const RAFFLE_SAMPLE_PATH = '/rafflesample';
/** Event link handed out at the Meetup — sends members to the mall (login / signup first). */
export const RAFFLE_MUSTAFA_PATH = '/raffleMustafa';
/** Direct link — opens the mall and pops the Get My Raffle popup. */
export const GET_MY_RAFFLE_PATH = '/getmyraffle';

const PENDING_OPEN_KEY = 'tutamall.getMyRafflePending';

/** Remember /getmyraffle across the login / signup bounce (UI intent only — no raffle data). */
export function markGetMyRafflePending() {
  try {
    window.sessionStorage.setItem(PENDING_OPEN_KEY, '1');
  } catch {
    // storage blocked — the button on /mall still works
  }
}

export function takeGetMyRafflePending() {
  try {
    const pending = window.sessionStorage.getItem(PENDING_OPEN_KEY) === '1';
    window.sessionStorage.removeItem(PENDING_OPEN_KEY);
    return pending;
  } catch {
    return false;
  }
}
