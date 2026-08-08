import iconList from 'constants/fontAwesome5ObjectsIcons.json';
import * as solidIcons from '@fortawesome/free-solid-svg-icons';

/** @returns {string[]} sorted FA5 object icon kebab names from bundled snapshot file */
export function getFontAwesome5ObjectIconNames() {
  const icons = Array.isArray(iconList?.icons) ? iconList.icons : [];
  return [...new Set(icons.map((name) => String(name).trim().toLowerCase()).filter(Boolean))].sort();
}

function exportNameFromKebab(kebab) {
  return `fa${kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
}

const iconDefinitionByName = (() => {
  const map = new Map();
  for (const name of getFontAwesome5ObjectIconNames()) {
    const exportName = exportNameFromKebab(name);
    const def = solidIcons[exportName];
    if (def && typeof def === 'object' && def.icon) {
      map.set(name, def);
    }
  }
  return map;
})();

/** Font Awesome icon definition for a bundled FA5 object name, or null if unavailable in installed set. */
export function getFontAwesome5ObjectIconDefinition(iconName) {
  const name = String(iconName ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
  return iconDefinitionByName.get(name) || null;
}

export function isAllowedFontAwesome5ObjectIconName(iconName) {
  const name = String(iconName ?? '')
    .trim()
    .toLowerCase()
    .replace(/^fa-/, '');
  return iconDefinitionByName.has(name);
}
