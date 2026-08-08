/**
 * Promise-based themed dialogs (ColorTemplate16PopupCenterWide via ThemedDialogHost).
 * Prefer these over window.alert / window.confirm / window.prompt.
 */

let dialogHandler = null;

/**
 * @param {(req: object) => Promise<any>} handler
 * @returns {() => void} unregister
 */
export function registerThemedDialogHandler(handler) {
  dialogHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (dialogHandler === handler) dialogHandler = null;
  };
}

function requestDialog(payload) {
  if (typeof dialogHandler === 'function') {
    return dialogHandler(payload);
  }
  // Fallback before host mounts (should be rare).
  const message = String(payload?.message ?? '');
  if (payload?.type === 'confirm') {
    return Promise.resolve(window.confirm(message));
  }
  if (payload?.type === 'prompt') {
    return Promise.resolve(window.prompt(message, payload?.defaultValue ?? ''));
  }
  window.alert(message);
  return Promise.resolve();
}

/**
 * @param {string} message
 * @param {{ title?: string, okLabel?: string }} [options]
 * @returns {Promise<void>}
 */
export function themedAlert(message, options = {}) {
  return requestDialog({
    type: 'alert',
    message: String(message ?? ''),
    title: options.title || 'Notice',
    okLabel: options.okLabel || 'OK'
  });
}

/**
 * @param {string} message
 * @param {{ title?: string, okLabel?: string, cancelLabel?: string }} [options]
 * @returns {Promise<boolean>} true if confirmed
 */
export function themedConfirm(message, options = {}) {
  return requestDialog({
    type: 'confirm',
    message: String(message ?? ''),
    title: options.title || 'Please confirm',
    okLabel: options.okLabel || 'OK',
    cancelLabel: options.cancelLabel || 'Cancel'
  }).then((result) => Boolean(result));
}

/**
 * @param {string} message
 * @param {string} [defaultValue]
 * @param {{ title?: string, okLabel?: string, cancelLabel?: string }} [options]
 * @returns {Promise<string|null>} entered value, or null if cancelled
 */
export function themedPrompt(message, defaultValue = '', options = {}) {
  return requestDialog({
    type: 'prompt',
    message: String(message ?? ''),
    defaultValue: defaultValue == null ? '' : String(defaultValue),
    title: options.title || 'Input',
    okLabel: options.okLabel || 'OK',
    cancelLabel: options.cancelLabel || 'Cancel'
  });
}
