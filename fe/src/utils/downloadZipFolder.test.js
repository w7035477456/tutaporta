import { describe, expect, it } from 'vitest';
import { keepLatestButtonEnabled, uniqueZipFileName } from './downloadZipFolder';

describe('keepLatestButtonEnabled', () => {
  it('is enabled only when the folder has more backup zips than we keep', () => {
    expect(keepLatestButtonEnabled(4, 3)).toBe(true);
    expect(keepLatestButtonEnabled(3, 3)).toBe(false);
    expect(keepLatestButtonEnabled(2, 3)).toBe(false);
    expect(keepLatestButtonEnabled(0, 3)).toBe(false);
  });

  it('stays enabled when the folder could not be counted', () => {
    expect(keepLatestButtonEnabled(null, 3)).toBe(true);
    expect(keepLatestButtonEnabled(undefined, 3)).toBe(true);
  });
});

describe('uniqueZipFileName', () => {
  it('keeps the suggested name when the folder does not already have it', () => {
    expect(
      uniqueZipFileName(
        ['EncryptedTutaNotesZip_2026_11_09_bacon67.zip'],
        'EncryptedTutaNotesZip_2026_11_14_testRemove3.zip'
      )
    ).toBe('EncryptedTutaNotesZip_2026_11_14_testRemove3.zip');
  });

  it('adds _2, then _3, when that zip name is already in the folder', () => {
    const suggested = 'EncryptedTutaNotesZip_2026_11_14_testRemove3.zip';
    expect(uniqueZipFileName([suggested], suggested)).toBe('EncryptedTutaNotesZip_2026_11_14_testRemove3_2.zip');
    expect(uniqueZipFileName([suggested, 'EncryptedTutaNotesZip_2026_11_14_testRemove3_2.zip'], suggested)).toBe(
      'EncryptedTutaNotesZip_2026_11_14_testRemove3_3.zip'
    );
  });
});
