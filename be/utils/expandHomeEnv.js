/**
 * Load ~/.ssh/be/.env with ${VAR} expansion (e.g. STORAGE_FOLDER, ROOT_FOLDER).
 * Plain dotenv does not expand; dotenv-expand does.
 */
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

/**
 * @param {string} homeEnvPath
 * @param {{ override?: boolean }} [options]
 * @returns {import('dotenv').DotenvConfigOutput}
 */
export function loadHomeEnvExpanded(homeEnvPath, options = {}) {
  const result = dotenv.config({
    path: homeEnvPath,
    override: options.override !== false
  });
  if (!result.error) {
    dotenvExpand.expand(result);
  }
  return result;
}
