/** BE 403 body `code` when singles.id_initialization_completed is false (be/utils/idInitialization.js). */
export const ID_INITIALIZATION_REQUIRED_CODE = 'ID_INITIALIZATION_REQUIRED';

export const ID_INITIALIZATION_REQUIRED_EVENT = 'id-initialization-required';

export function notifyIdInitializationRequired() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ID_INITIALIZATION_REQUIRED_EVENT));
}
