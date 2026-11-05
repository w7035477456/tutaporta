import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * `user_customization.mynote_font_size` must stay NULL when the member never chose
 * a size — the browser then applies the live DESKTOP_FONT_SIZE_BUTTON default.
 *
 * Regression guard: the API used to substitute 20 (2.0rem) on read AND write, and
 * an earlier backfill wrote COALESCE(...,20) into every row. That pinned myNote
 * buttons at 2rem while the rest of the app followed the 1vw env, so the header /
 * notebook buttons rendered oversized.
 */

const ROUTE_SRC = fs.readFileSync(
  path.join(import.meta.dirname, 'userCustomization.js'),
  'utf8'
);

describe('mynote_font_size default handling', () => {
  it('does not reference the baked-in tenths constant in the route', () => {
    assert.equal(
      ROUTE_SRC.includes('MYNOTE_DEFAULT_FONT_SIZE_TENTHS'),
      false,
      'the route must not substitute a fixed 2rem default for mynote_font_size'
    );
  });

  it('never writes a COALESCE-style default into the column', () => {
    assert.doesNotMatch(
      ROUTE_SRC,
      /mynote_font_size\s*=\s*COALESCE\(\s*mynote_font_size\s*,/,
      'writing a default would re-pin the size and defeat the env'
    );
  });

  it('returns null (not 20) for a member with no saved size', () => {
    // rowToPayload's no-row branch.
    const noRowBranch = ROUTE_SRC.slice(
      ROUTE_SRC.indexOf('function rowToPayload'),
      ROUTE_SRC.indexOf('function rowToPayload') + 400
    );
    assert.match(noRowBranch, /mynoteFontSize:\s*null/);
    assert.doesNotMatch(noRowBranch, /mynoteFontSize:\s*\d/);
  });

  it('passes a NULL column through instead of defaulting it', () => {
    assert.match(
      ROUTE_SRC,
      /const mynoteFontSize = mynoteFontSizeParsed;/,
      'a NULL column must stay NULL so the browser default applies'
    );
  });

  it('keeps the column nullable with no numeric default', () => {
    assert.doesNotMatch(ROUTE_SRC, /mynote_font_size smallint NULL DEFAULT 20/);
    assert.doesNotMatch(ROUTE_SRC, /ALTER COLUMN mynote_font_size SET DEFAULT 20/);
  });

  it('leaves an explicit member choice untouched when saving other prefs', () => {
    assert.match(
      ROUTE_SRC,
      /hasMynoteFontSize\s*\?\s*mynoteFontSize\s*:\s*prev\?\.mynote_font_size \?\? null/
    );
  });
});
