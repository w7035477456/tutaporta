import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSinglesStatusForceLogout,
  isSinglesStatusLoginAllowed,
  isSinglesStatusNew,
  nextSinglesStatus,
  normalizeSinglesStatus,
  singlesStatusBlockedMessage,
  singlesStatusLoginRejectMessage
} from './singlesStatus.js';
import { accountStatusSessionBlockMessage } from './accountStatusSessionGate.js';

describe('singles.status new', () => {
  it('recognizes new', () => {
    assert.equal(normalizeSinglesStatus(' NEW '), 'new');
    assert.equal(isSinglesStatusNew('new'), true);
    assert.equal(isSinglesStatusNew('active'), false);
  });

  it('lets new members log in to finish onboarding', () => {
    assert.equal(isSinglesStatusLoginAllowed('new', 'PUBLIC'), true);
    assert.equal(singlesStatusLoginRejectMessage('new', 'PUBLIC'), null);
  });

  it('admin status cycle goes active → new → under18 and wraps from blank back to active', () => {
    assert.equal(nextSinglesStatus('active'), 'new');
    assert.equal(nextSinglesStatus('new'), 'under18');
    assert.equal(nextSinglesStatus('blank'), 'active');
  });
});

describe('force-logout statuses', () => {
  for (const status of ['suspend', 'inactive', 'abandon', 'blank', 'under18', 'unknown', 'other']) {
    it(`refuses ${status} for every member category`, () => {
      assert.equal(isSinglesStatusForceLogout(status), true);
      assert.equal(isSinglesStatusLoginAllowed(status, 'PUBLIC'), false);
      assert.equal(isSinglesStatusLoginAllowed(status, 'REGULARMEMBER'), false);
      assert.equal(
        singlesStatusLoginRejectMessage(status, 'REGULARMEMBER'),
        `Please contact customer support, since your status is '${status}' and must be 'active' to Login`
      );
    });
  }

  it('treats NULL status as blank', () => {
    assert.equal(isSinglesStatusForceLogout(null), true);
    assert.equal(singlesStatusBlockedMessage(null).includes("'blank'"), true);
  });

  it('keeps active / new / pause sessions', () => {
    for (const status of ['active', 'new', 'pause']) {
      assert.equal(isSinglesStatusForceLogout(status), false);
      assert.equal(accountStatusSessionBlockMessage({ status, role: 'user' }), null);
    }
  });

  it('ends member sessions but never admin / impersonation sessions', () => {
    assert.equal(
      accountStatusSessionBlockMessage({ status: 'suspend', role: 'user' }),
      "Please contact customer support, since your status is 'suspend' and must be 'active' to Login"
    );
    assert.equal(accountStatusSessionBlockMessage({ status: 'suspend', role: 'Admin' }), null);
    assert.equal(accountStatusSessionBlockMessage({ status: 'blank', tools_only: true }), null);
  });
});
