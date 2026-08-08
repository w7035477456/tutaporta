/**
 * End-user USB bridge runs without Postgres, JWT keys, or ~/.ssh/be/.env.
 * Same flag as Notes bridge for now (shared installer binary); either env works.
 */
export function isPhotoAlbumsBridgeStandalone() {
  return (
    String(process.env.PHOTO_ALBUMS_BRIDGE_STANDALONE || '').trim() === '1' ||
    String(process.env.RECORD_VAULT_BRIDGE_STANDALONE || '').trim() === '1'
  );
}
