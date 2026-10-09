import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEnrollmentPatchToBitmap,
  canChangeTutaDatesOptIn,
  isVisibleOnTutaDates,
  normalizeOptinoutBitmap,
  OPTINOUT_DEFAULT_BITMAP,
  optinoutBitmapToEnrollment,
  tutaDatesOptInBlockedMessage
} from './optinoutBitmap.js';

describe('singles.optinout_bitmap', () => {
  it('defaults to all three apps', () => {
    assert.equal(OPTINOUT_DEFAULT_BITMAP, 7);
    assert.equal(normalizeOptinoutBitmap(null), 7);
    assert.equal(normalizeOptinoutBitmap(300), 7);
    assert.deepEqual(optinoutBitmapToEnrollment(7), {
      tutaDatesEnabled: true,
      tutaNotesEnabled: true,
      tutaAlbumsEnabled: true
    });
  });

  it('maps bit 0 = TutaDates, bit 1 = TutaNotes, bit 2 = TutaPhotos', () => {
    assert.deepEqual(optinoutBitmapToEnrollment(6), {
      tutaDatesEnabled: false,
      tutaNotesEnabled: true,
      tutaAlbumsEnabled: true
    });
    assert.equal(applyEnrollmentPatchToBitmap(7, { tutaDatesEnabled: false }), 6);
    assert.equal(applyEnrollmentPatchToBitmap(0, { tutaAlbumsEnabled: true }), 4);
    assert.equal(applyEnrollmentPatchToBitmap(7, { tutaNotesEnabled: false, tutaAlbumsEnabled: false }), 1);
  });

  it('keeps reserved bits untouched', () => {
    assert.equal(applyEnrollmentPatchToBitmap(0b1000_0111, { tutaDatesEnabled: false }), 0b1000_0110);
  });

  it('lists a member on TutaDates only when active AND TutaDates opted in', () => {
    assert.equal(isVisibleOnTutaDates('active', 7), true);
    assert.equal(isVisibleOnTutaDates('active', 6), false);
    assert.equal(isVisibleOnTutaDates('new', 7), false);
    assert.equal(isVisibleOnTutaDates('under18', 7), false);
  });

  it('allows the TutaDates checkbox only for active / new', () => {
    assert.equal(canChangeTutaDatesOptIn('active'), true);
    assert.equal(canChangeTutaDatesOptIn('new'), true);
    assert.equal(canChangeTutaDatesOptIn('under18'), false);
    assert.equal(canChangeTutaDatesOptIn('pause'), false);
    assert.equal(
      tutaDatesOptInBlockedMessage('pause'),
      "Please contact customer support, since your TutaDate status is 'pause' and must be 'active' to optin TutaDates"
    );
  });
});
