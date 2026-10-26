import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stripSampleAlbumTutorialLabels } from './migrateSampleAlbumTutorialLabels.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const hint = (id, text) =>
  `<div data-label-id="${id}" data-text="${text}" data-rv-text-label="" class="rv-text-label">${text}</div><p></p>`;

test('strips every tl_sample_hint_ label and keeps other content', () => {
  const photo = '<div data-attachment-id="1" data-rv-attachment=""></div><p></p>';
  const userLabel = '<div data-label-id="tl_user_1" data-rv-text-label="">Mine</div>';
  const body =
    photo +
    hint('tl_sample_hint_edit_1', 'Double me to edit photo') +
    hint('tl_sample_hint_video_3', 'You can add/play Video (mp4) files on Album also') +
    userLabel +
    hint('tl_sample_hint_edit_5', 'Double me to edit photo');
  assert.equal(stripSampleAlbumTutorialLabels(body), photo + userLabel);
});

test('leaves bodies without hint labels unchanged', () => {
  const body = '<p>hello</p><div data-label-id="tl_x">x</div>';
  assert.equal(stripSampleAlbumTutorialLabels(body), body);
  assert.equal(stripSampleAlbumTutorialLabels(null), '');
});

test('bundled new-member sample album has no hint labels', () => {
  const html = fs.readFileSync(
    path.join(here, '../../assets/photoAlbumsNewMemberSample/sampleAlbumBody.html'),
    'utf8'
  );
  assert.ok(!html.includes('tl_sample_hint_'));
  assert.ok(!html.includes('Double me to edit photo'));
});
