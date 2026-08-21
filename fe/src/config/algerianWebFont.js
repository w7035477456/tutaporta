/**
 * Cross-platform "Algerian" webfont (see assets/fonts/algerian-web-font.css).
 * Windows keeps local Algerian when installed; Mac/Ubuntu use bundled woff2.
 */
import 'assets/fonts/algerian-web-font.css';

/** No-op — @font-face is registered by the CSS import above. */
export function ensureAlgerianWebFont() {}
