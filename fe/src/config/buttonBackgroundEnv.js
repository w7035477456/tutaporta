/**
 * Neutral (idle / unselected — formerly grey #9e9e9e) button fill — fe/.env
 *   BUTTON_BACKGROUND_COLOR="#FFFFFF"        idle fill (QUOTE it — unquoted # starts a .env comment)
 *   BUTTON_BACKGROUND_HOVER_COLOR="#D3D3DA"  fill while the cursor hovers
 *
 * Used by: TutaNotes / Photo Albums notebook, note + shortcut rows (incl. Monthly / Yearly),
 * Recent chips, "More Choices". Colored buttons (green selected, yellow, orange, red) and
 * disabled-grey states are intentionally NOT affected.
 */
import { readEnvCssColor } from 'config/buttonBorderEnv';

const LEGACY_IDLE_GREY = '#9e9e9e';

export const BUTTON_BACKGROUND_COLOR = readEnvCssColor(import.meta.env.BUTTON_BACKGROUND_COLOR, LEGACY_IDLE_GREY);
export const BUTTON_BACKGROUND_HOVER_COLOR = readEnvCssColor(import.meta.env.BUTTON_BACKGROUND_HOVER_COLOR, BUTTON_BACKGROUND_COLOR);
