import { describe, expect, it } from 'vitest';
import {
  normalizeMynoteFontSizeTenths,
  recordVaultMenuButtonFontRemFromTenths
} from 'config/recordVaultMenuButtonFontEnv';

describe('normalizeMynoteFontSizeTenths', () => {
  it('treats legacy pinned 20 as unset', () => {
    expect(normalizeMynoteFontSizeTenths(20)).toBeNull();
    expect(normalizeMynoteFontSizeTenths('20')).toBeNull();
  });

  it('keeps real member choices', () => {
    expect(normalizeMynoteFontSizeTenths(15)).toBe(15);
    expect(normalizeMynoteFontSizeTenths(25)).toBe(25);
  });

  it('maps legacy 20 to env default rem, not 2rem', () => {
    expect(recordVaultMenuButtonFontRemFromTenths(20, 1.1)).toBe(1.1);
    expect(recordVaultMenuButtonFontRemFromTenths(null, 1.1)).toBe(1.1);
  });
});
