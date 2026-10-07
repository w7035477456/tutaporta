import { describe, expect, it } from 'vitest';
import {
  isTutaDriveSealedBackupBytes,
  readTutaDriveBackupHeader,
  sealTutaDriveBackupZipWithPassword,
  tutaDriveBackupPasswordCheckFromHeader,
  unsealTutaDriveBackupZipWithDek,
  verifyTutaDriveBackupPassword
} from './recordVaultClientVaultCrypto';

const hasWebCrypto = typeof globalThis.crypto?.subtle?.encrypt === 'function';
const describeCrypto = hasWebCrypto ? describe : describe.skip;

describeCrypto('per-backup password seal (TNBAK3)', () => {
  const plain = new TextEncoder().encode('PK\u0003\u0004 fake vault zip bytes');

  it('stores salt + verifier + hint in a readable header and round-trips with the right password', async () => {
    const sealed = await sealTutaDriveBackupZipWithPassword(plain, 'zip-pass-1', { hint: 'otriangle', note: 'Marker1_local' });
    expect(isTutaDriveSealedBackupBytes(sealed)).toBe(true);

    const parsed = readTutaDriveBackupHeader(sealed);
    expect(parsed.format).toBe('TNBAK3');
    expect(parsed.header.hint).toBe('otriangle');
    expect(parsed.header.note).toBe('Marker1_local');
    expect(JSON.stringify(parsed.header)).not.toContain('zip-pass-1');

    const check = tutaDriveBackupPasswordCheckFromHeader(parsed.header);
    await expect(verifyTutaDriveBackupPassword('zip-pass-1', check)).resolves.toBeTruthy();
    await expect(verifyTutaDriveBackupPassword('wrong', check)).rejects.toThrow('Wrong password for this backup zip');

    const out = await unsealTutaDriveBackupZipWithDek(sealed, null, { password: 'zip-pass-1' });
    expect(new TextDecoder().decode(out)).toBe(new TextDecoder().decode(plain));
    await expect(unsealTutaDriveBackupZipWithDek(sealed, null, { password: 'wrong' })).rejects.toThrow(
      'Wrong password for this backup zip'
    );
  }, 30000);

  it('rejects a zip whose visible header was edited', async () => {
    const sealed = await sealTutaDriveBackupZipWithPassword(plain, 'pw', { hint: 'abc' });
    const tampered = new Uint8Array(sealed);
    const at = new TextDecoder('latin1').decode(tampered).indexOf('"hint":"abc"') + '"hint":"'.length;
    tampered[at] = 'x'.charCodeAt(0);
    await expect(unsealTutaDriveBackupZipWithDek(tampered, null, { password: 'pw' })).rejects.toThrow();
  }, 30000);
});
