import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import pool from '../db/connection.js';
import { findUserByLoginIdentifier } from '../routes/singles/beVerifyLoginPassword.js';
import { normalizeLoginIdentifier } from './loginIdentifier.js';

describe('normalizeLoginIdentifier', () => {
  it('reads M-prefixed member codes in any case', () => {
    assert.deepEqual(normalizeLoginIdentifier('M3902787'), { type: 'member_id', value: '3902787' });
    assert.deepEqual(normalizeLoginIdentifier(' m3902787 '), { type: 'member_id', value: '3902787' });
    assert.deepEqual(normalizeLoginIdentifier('M-0042'), { type: 'member_id', value: '42' });
  });

  it('reads bare digits as a member number unless they are a phone number', () => {
    assert.deepEqual(normalizeLoginIdentifier('3902787'), { type: 'member_id', value: '3902787' });
    assert.deepEqual(normalizeLoginIdentifier('4155551234'), { type: 'phone', value: '+14155551234' });
    assert.deepEqual(normalizeLoginIdentifier('1 (415) 555-1234'), { type: 'phone', value: '+14155551234' });
    assert.equal(normalizeLoginIdentifier('555-1234'), null);
  });

  it('keeps emails and nicknames as before', () => {
    assert.deepEqual(normalizeLoginIdentifier('A@B.com'), { type: 'email', value: 'a@b.com' });
    assert.deepEqual(normalizeLoginIdentifier('WildWade'), { type: 'email', value: 'wildwade' });
    assert.deepEqual(normalizeLoginIdentifier('M39x'), { type: 'email', value: 'm39x' });
  });
});

describe('findUserByLoginIdentifier (dev DB)', () => {
  after(() => pool.end());

  it('finds a member by member code, with or without M, any case', async (t) => {
    const { rows } = await pool.query(
      `SELECT singles_id, member_id FROM outdateddbsnapshotoct2024.singles WHERE member_id IS NOT NULL ORDER BY singles_id LIMIT 1`
    );
    if (!rows.length) return t.skip('no members in this database');
    const { singles_id: singlesId, member_id: memberId } = rows[0];
    for (const input of [`M${memberId}`, `m${memberId}`, String(memberId)]) {
      const { normalized, user } = await findUserByLoginIdentifier(input);
      assert.equal(normalized.type, 'member_id', input);
      assert.equal(Number(user?.singles_id), Number(singlesId), input);
    }
  });

  it('unknown member code finds nobody (password check never reached)', async () => {
    const { user } = await findUserByLoginIdentifier('M999999999999');
    assert.equal(user, null);
  });
});
