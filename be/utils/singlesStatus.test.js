import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSinglesStatusLoginAllowed,
  isSinglesStatusNew,
  nextSinglesStatus,
  normalizeSinglesStatus,
  singlesStatusLoginRejectMessage
} from './singlesStatus.js';

describe('singles.status new / under18', () => {
  it('recognizes new', () => {
    assert.equal(normalizeSinglesStatus(' NEW '), 'new');
    assert.equal(isSinglesStatusNew('new'), true);
    assert.equal(isSinglesStatusNew('active'), false);
  });

  it('lets new members log in to finish onboarding', () => {
    assert.equal(isSinglesStatusLoginAllowed('new', 'PUBLIC'), true);
    assert.equal(singlesStatusLoginRejectMessage('new', 'PUBLIC'), null);
  });

  it('lets under18 log in (TutaNotes / TutaPhotos only)', () => {
    assert.equal(isSinglesStatusLoginAllowed('under18', 'PUBLIC'), true);
    assert.equal(singlesStatusLoginRejectMessage('under18', 'PUBLIC'), null);
  });

  it('admin status cycle wraps from new back to active', () => {
    assert.equal(nextSinglesStatus('under18'), 'new');
    assert.equal(nextSinglesStatus('new'), 'active');
  });
});

describe('singles.status suspend / inactive / abandon', () => {
  for (const status of ['suspend', 'inactive', 'abandon']) {
    it(`refuses ${status} for every member category`, () => {
      assert.equal(isSinglesStatusLoginAllowed(status, 'PUBLIC'), false);
      assert.equal(isSinglesStatusLoginAllowed(status, 'REGULARMEMBER'), false);
      assert.equal(
        singlesStatusLoginRejectMessage(status, 'REGULARMEMBER'),
        `Your status is '${status}', not 'active', so you can not login. Please contact customer support to correct your status to 'active' first.`
      );
    });
  }
});
