/** true when env AUTO_UI_*_UPDATE is not explicitly false (default on). */
export function isAutoUiUpdateEnabled(value) {
  return String(value ?? 'true').trim().toLowerCase() !== 'false';
}
