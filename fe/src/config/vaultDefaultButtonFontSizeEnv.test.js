import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The myNote button font default must follow the SAME env as every other button
 * (MOBILE_/DESKTOP_FONT_SIZE_BUTTON), converted from vw to rem at the current
 * window width so the rem-based font slider keeps working.
 */

const ENV = vi.hoisted(() => ({ sm: '1vw', xs: '6vw' }));

vi.mock('config/buttonFontEnv', () => ({
  get buttonFontSizeResponsive() {
    return { xs: ENV.xs, sm: ENV.sm };
  }
}));

function setWindow(innerWidth, rootPx = 16) {
  globalThis.window = {
    innerWidth,
    getComputedStyle: () => ({ fontSize: `${rootPx}px` })
  };
  globalThis.document = { documentElement: {} };
}

beforeEach(() => {
  vi.resetModules();
  delete import.meta.env.NOTES_DEFAULT_BUTTON_FONT_SIZE_REM;
});

afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
});

describe('vaultDefaultButtonFontSizeEnv', () => {
  it('converts the desktop button vw into rem at the current width', async () => {
    setWindow(1600); // 1vw = 16px = 1rem
    const { getVaultDefaultButtonFontSizeRem } = await import(
      'config/vaultDefaultButtonFontSizeEnv'
    );
    expect(getVaultDefaultButtonFontSizeRem()).toBe(1);
  });

  it('scales with the viewport, like the vw env it mirrors', async () => {
    setWindow(3200); // 1vw = 32px = 2rem
    const { getVaultDefaultButtonFontSizeRem } = await import(
      'config/vaultDefaultButtonFontSizeEnv'
    );
    expect(getVaultDefaultButtonFontSizeRem()).toBe(2);
  });

  it('uses the mobile env below the sm breakpoint (6vw)', async () => {
    setWindow(375); // 6vw = 22.5px = 1.40625rem
    const { getVaultDefaultButtonFontSizeRem } = await import(
      'config/vaultDefaultButtonFontSizeEnv'
    );
    expect(getVaultDefaultButtonFontSizeRem()).toBeCloseTo(1.41, 2);
  });

  it('honours the explicit rem override when one is configured', async () => {
    setWindow(1600);
    import.meta.env.NOTES_DEFAULT_BUTTON_FONT_SIZE_REM = '2.5';
    const { getVaultDefaultButtonFontSizeRem } = await import(
      'config/vaultDefaultButtonFontSizeEnv'
    );
    expect(getVaultDefaultButtonFontSizeRem()).toBe(2.5);
  });

  it('falls back sanely without a window (SSR / tests)', async () => {
    delete globalThis.window;
    const { getVaultDefaultButtonFontSizeRem } = await import(
      'config/vaultDefaultButtonFontSizeEnv'
    );
    expect(getVaultDefaultButtonFontSizeRem()).toBe(2);
  });

  it('clamps absurd sizes into the slider range', async () => {
    setWindow(100000, 16); // enormous viewport → 1vw = 1000px = 62.5rem
    const { getVaultDefaultButtonFontSizeRem } = await import(
      'config/vaultDefaultButtonFontSizeEnv'
    );
    expect(getVaultDefaultButtonFontSizeRem()).toBeLessThanOrEqual(8);
  });
});
