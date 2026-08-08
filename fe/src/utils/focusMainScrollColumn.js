/** Main layout column (`data-main-scroll-column` in MainLayout). */
export function focusMainScrollColumn() {
  const el = document.querySelector('[data-main-scroll-column]');
  if (!el || typeof el.focus !== 'function') return;

  const focus = () => {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  };

  requestAnimationFrame(() => {
    focus();
    requestAnimationFrame(focus);
  });
}
