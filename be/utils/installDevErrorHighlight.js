/**
 * Mac / local TTY (beall): make console.error first lines black on red.
 * No-op when stderr is not a TTY (PM2 / redirected logs) so log files stay clean.
 */
import util from 'util';

const OPEN = '\x1b[30;41m'; // black fg + red bg
const CLOSE = '\x1b[0m';

export function installDevErrorHighlight() {
  if (!process.stderr.isTTY) return;
  if (console.error.__blackOnRed) return;

  const orig = console.error;
  console.error = (...args) => {
    try {
      const text = util.formatWithOptions({ colors: false, depth: 4 }, ...args);
      const nl = text.indexOf('\n');
      if (nl === -1) {
        orig.call(console, `${OPEN}${text}${CLOSE}`);
      } else {
        orig.call(console, `${OPEN}${text.slice(0, nl)}${CLOSE}${text.slice(nl)}`);
      }
    } catch {
      orig.apply(console, args);
    }
  };
  console.error.__blackOnRed = true;
}
