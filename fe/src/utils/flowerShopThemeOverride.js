import { applyThemeByName, getThemeOptionsFromEnv, isDarkThemeName, getLightThemeCounterpart } from './themeConfig.js';

let overrideActive = false;
let restoreThemeName = null;

export function isFlowerShopThemeOverrideActive() {
  return overrideActive;
}

export function getFlowerShopRestoreThemeName() {
  return restoreThemeName;
}

/**
 * On /send-flower or /eMarketPlace/flowerShop: if stored theme is dark, apply light counterpart for display only.
 * @returns {boolean} true when a temporary light override was applied
 */
export function beginFlowerShopLightThemeOverride(storedThemeName, options = getThemeOptionsFromEnv()) {
  const stored = String(storedThemeName ?? '').trim();
  if (!stored) return false;

  restoreThemeName = stored;

  if (!isDarkThemeName(stored)) {
    overrideActive = false;
    applyThemeByName(stored, options);
    return false;
  }

  const lightName = getLightThemeCounterpart(stored, options);
  if (!lightName) {
    overrideActive = false;
    return false;
  }

  overrideActive = true;
  applyThemeByName(lightName, options);
  return true;
}

/**
 * Restore the user's stored theme (pass DB value when leaving the route).
 * @param {string} [restoreThemeNameOverride] - e.g. resolved `singles.theme` from preferences
 */
export function endFlowerShopLightThemeOverride(restoreThemeNameOverride, options = getThemeOptionsFromEnv()) {
  const restore = restoreThemeNameOverride ?? restoreThemeName;
  overrideActive = false;
  restoreThemeName = null;
  if (restore) {
    applyThemeByName(restore, options);
  }
}

export function clearFlowerShopLightThemeOverride() {
  overrideActive = false;
  restoreThemeName = null;
}
