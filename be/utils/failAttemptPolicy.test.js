import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { failAttemptLocks, failAttemptStartsCooldown, failAttemptWarning } from './failAttemptPolicy.js';

describe('failAttemptPolicy', () => {
  it('cools down only on the 3rd consecutive fail', () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5].map(failAttemptStartsCooldown),
      [false, false, true, false, false]
    );
  });

  it('locks on the 6th consecutive fail', () => {
    assert.deepEqual([1, 3, 5, 6, 7].map(failAttemptLocks), [false, false, false, true, true]);
  });

  it('describes what happens next', () => {
    const lock = 'lock TutaNotes, and you must contact tech support after that';
    assert.equal(
      failAttemptWarning(1, lock),
      '3 fails in a row start a retry cooldown, and 3 more fails after that will lock TutaNotes, and you must contact tech support after that.'
    );
    assert.equal(failAttemptWarning(3, lock), '3 more fails will lock TutaNotes, and you must contact tech support after that.');
    assert.equal(failAttemptWarning(5, lock), '1 more fail will lock TutaNotes, and you must contact tech support after that.');
  });
});
