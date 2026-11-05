import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTutaDriveBackupFileNameParts } from './tutaDriveBackupNames.js';

describe('parseTutaDriveBackupFileNameParts', () => {
  it('parses date-only zip names', () => {
    assert.deepEqual(parseTutaDriveBackupFileNameParts('EncryptedTutaNotesZip_2026_11_04.zip'), {
      dateStamp: '2026_11_04',
      note: '',
      suffix: 1,
      fileName: 'EncryptedTutaNotesZip_2026_11_04.zip'
    });
  });

  it('parses note suffix from Mac uploads (_test2)', () => {
    assert.deepEqual(
      parseTutaDriveBackupFileNameParts('EncryptedTutaNotesZip_2026_11_04_test2.zip'),
      {
        dateStamp: '2026_11_04',
        note: 'test2',
        suffix: 1,
        fileName: 'EncryptedTutaNotesZip_2026_11_04_test2.zip'
      }
    );
  });

  it('parses numeric disambiguation suffix without a note', () => {
    assert.deepEqual(parseTutaDriveBackupFileNameParts('EncryptedTutaNotesZip_2026_11_04_3.zip'), {
      dateStamp: '2026_11_04',
      note: '',
      suffix: 3,
      fileName: 'EncryptedTutaNotesZip_2026_11_04_3.zip'
    });
  });

  it('parses note plus disambiguation suffix', () => {
    assert.deepEqual(
      parseTutaDriveBackupFileNameParts('EncryptedTutaNotesZip_2026_11_04_test2_2.zip'),
      {
        dateStamp: '2026_11_04',
        note: 'test2',
        suffix: 2,
        fileName: 'EncryptedTutaNotesZip_2026_11_04_test2_2.zip'
      }
    );
  });
});
