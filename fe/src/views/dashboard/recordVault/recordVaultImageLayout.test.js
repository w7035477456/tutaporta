import { describe, expect, it } from 'vitest';
import { computeRotatedImageBox } from './recordVaultImageLayout';

/** 4:3 landscape scan, 1200×900. */
const LANDSCAPE = 1200 / 900;

describe('computeRotatedImageBox', () => {
  it('does nothing until the picture and column are measured', () => {
    expect(computeRotatedImageBox({ rotation: 90, availableWidth: 0, aspect: 0 }).box).toBeNull();
    expect(computeRotatedImageBox({ rotation: 90, availableWidth: 600, aspect: 0 }).box).toBeNull();
    expect(computeRotatedImageBox({ rotation: 90, availableWidth: 0, aspect: LANDSCAPE }).box).toBeNull();
  });

  it('keeps the natural box when unrotated', () => {
    const out = computeRotatedImageBox({ rotation: 0, availableWidth: 600, aspect: LANDSCAPE });
    expect(out.quarterTurn).toBe(false);
    expect(out.box).toBeNull();
    expect(out.imgWidth).toBe(600);
  });

  it('swaps width and height on a quarter turn', () => {
    const out = computeRotatedImageBox({ rotation: 90, availableWidth: 600, aspect: LANDSCAPE });
    expect(out.quarterTurn).toBe(true);
    // unrotated 600×450 → turned footprint 450×600
    expect(out.box).toEqual({ width: 450, height: 600 });
    expect(out.imgWidth).toBe(600);
  });

  it('scales a turned picture down until its footprint fits the column', () => {
    // A tall portrait (2:3) at full column width becomes wider than the column.
    const portrait = 800 / 1200;
    const out = computeRotatedImageBox({ rotation: 90, availableWidth: 400, aspect: portrait });
    expect(out.box.width).toBeLessThanOrEqual(400);
    // The turned footprint is the unrotated box swapped, so its ratio inverts
    // (integer rounding of the box keeps this approximate).
    expect(out.box.width / out.box.height).toBeCloseTo(1 / portrait, 2);
  });

  it('honours an explicit width and a height cap before rotating', () => {
    const explicit = computeRotatedImageBox({
      rotation: 90,
      availableWidth: 900,
      preferredWidth: 400,
      aspect: LANDSCAPE
    });
    expect(explicit.imgWidth).toBe(400);
    expect(explicit.box).toEqual({ width: 300, height: 400 });

    const capped = computeRotatedImageBox({
      rotation: 0,
      availableWidth: 900,
      maxHeight: 300,
      aspect: LANDSCAPE
    });
    expect(capped.imgWidth).toBe(400);
  });

  it('normalizes odd rotation values before deciding', () => {
    expect(computeRotatedImageBox({ rotation: -90, availableWidth: 600, aspect: LANDSCAPE }).box).toEqual({
      width: 450,
      height: 600
    });
    expect(computeRotatedImageBox({ rotation: 180, availableWidth: 600, aspect: LANDSCAPE }).box).toBeNull();
    expect(computeRotatedImageBox({ rotation: 179, availableWidth: 600, aspect: LANDSCAPE }).quarterTurn).toBe(false);
  });
});
