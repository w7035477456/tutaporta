/** When true, login page blocks compact/mobile viewports (~/.ssh/be/.env BLOCK_MOBILE). Default: true. */

export function isBlockMobileEnabled() {
  return String(process.env.BLOCK_MOBILE ?? 'true').trim().toLowerCase() !== 'false';
}
