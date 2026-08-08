/**
 * Before Exit to Mall / site logout / Log off USB|Cloud: lock album templates
 * and flush the open note so layout is saved before vault logoff.
 */

const prepareHandlers = new Set();

/**
 * @param {() => void | Promise<void>} handler
 * @returns {() => void} unsubscribe
 */
export function registerPhotoAlbumsLeavePrepare(handler) {
  if (typeof handler !== 'function') return () => {};
  prepareHandlers.add(handler);
  return () => {
    prepareHandlers.delete(handler);
  };
}

/** Run all registered prepare hooks (best-effort; never throws). */
export async function runPhotoAlbumsLeavePrepare() {
  const handlers = [...prepareHandlers];
  for (const handler of handlers) {
    try {
      await handler();
    } catch (err) {
      console.error('[photoAlbumsLeavePrepare]', err?.message || err);
    }
  }
}
