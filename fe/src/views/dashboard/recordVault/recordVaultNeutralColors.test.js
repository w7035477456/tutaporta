import { describe, expect, it } from 'vitest';
import { isNeutralCssColor, stripNeutralColorsFromHtml } from './recordVaultNeutralColors';

describe('isNeutralCssColor', () => {
  it('treats black, white and grays as neutral', () => {
    for (const c of ['#000', '#000000', '#fff', '#F0F0F0', '#282727', 'rgb(31, 31, 31)', 'rgb(15, 17, 17)', 'rgba(0, 0, 0, 0.87)', 'black', 'White', 'gray', 'rgba(255, 0, 0, 0)']) {
      expect(isNeutralCssColor(c)).toBe(true);
    }
  });

  it('keeps real colors', () => {
    for (const c of ['rgb(252, 18, 51)', '#e60000', '#2f6fed', 'rgb(204, 12, 57)', 'rgb(0, 113, 133)', 'orange']) {
      expect(isNeutralCssColor(c)).toBe(false);
    }
  });
});

const describeDom = typeof DOMParser === 'undefined' ? describe.skip : describe;

describeDom('stripNeutralColorsFromHtml', () => {
  it('drops neutral text / background colors but keeps red text and other styles', () => {
    const html =
      '<p><span style="color: rgb(31, 31, 31); font-size: 17px">Conclusion</span> ' +
      '<span style="color: rgb(252, 18, 51); background-color: rgb(255, 255, 255)">LICENSE</span></p>' +
      '<table><tbody><tr><td style="background-color: #ffffff">cell</td></tr></tbody></table>';
    const out = stripNeutralColorsFromHtml(html);
    expect(out).toContain('<span style="font-size: 17px;">Conclusion</span>');
    expect(out).toContain('<span style="color: rgb(252, 18, 51);">LICENSE</span>');
    expect(out).toContain('<td>cell</td>');
  });

  it('returns the input untouched when nothing is neutral', () => {
    const html = '<p><span style="color: rgb(252, 18, 51)">red</span></p>';
    expect(stripNeutralColorsFromHtml(html)).toBe(html);
  });
});
