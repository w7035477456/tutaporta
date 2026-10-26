import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isUnchangedNoteTextPatch } from './unchangedNoteTextPatch.js';

const row = { note_name: 'TAX', body_text: '<p>hello</p>' };

describe('isUnchangedNoteTextPatch', () => {
  it('skips a body / name save identical to the stored note', () => {
    assert.equal(isUnchangedNoteTextPatch(row, { body_text: '<p>hello</p>' }), true);
    assert.equal(isUnchangedNoteTextPatch(row, { body_text: '<p>hello</p>', note_name: 'TAX' }), true);
  });

  it('writes when the body or name changed', () => {
    assert.equal(isUnchangedNoteTextPatch(row, { body_text: '<p>hello!</p>' }), false);
    assert.equal(isUnchangedNoteTextPatch(row, { note_name: 'TAX 2026' }), false);
  });

  it('writes any other kind of patch', () => {
    assert.equal(isUnchangedNoteTextPatch(row, {}), false);
    assert.equal(isUnchangedNoteTextPatch(row, { body_text: '<p>hello</p>', keywords: 'a' }), false);
    assert.equal(isUnchangedNoteTextPatch(row, { notebook_id: 3 }), false);
    assert.equal(isUnchangedNoteTextPatch(row, { clear_image: true }), false);
  });
});
