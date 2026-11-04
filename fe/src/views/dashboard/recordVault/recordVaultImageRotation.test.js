import { describe, expect, it } from 'vitest';
import {
  IMAGE_ROTATION_STEP,
  isQuarterTurn,
  isRotatableAttachmentExtension,
  normalizeImageRotation,
  parseRotationStyle,
  rotationToHtmlAttributes
} from './recordVaultImageRotation';

describe('recordVaultImageRotation', () => {
  it('steps a quarter turn by default', () => {
    expect(IMAGE_ROTATION_STEP).toBe(90);
  });

  it('normalizes any angle onto 0 / 90 / 180 / 270', () => {
    expect(normalizeImageRotation(0)).toBe(0);
    expect(normalizeImageRotation(90)).toBe(90);
    expect(normalizeImageRotation(180)).toBe(180);
    expect(normalizeImageRotation(270)).toBe(270);
    expect(normalizeImageRotation(360)).toBe(0);
    expect(normalizeImageRotation(-90)).toBe(270);
    expect(normalizeImageRotation(450)).toBe(90);
    expect(normalizeImageRotation('90')).toBe(90);
    expect(normalizeImageRotation(null)).toBe(0);
    expect(normalizeImageRotation(undefined)).toBe(0);
    expect(normalizeImageRotation('sideways')).toBe(0);
  });

  it('rounds to the nearest quarter turn', () => {
    expect(normalizeImageRotation(89)).toBe(90);
    expect(normalizeImageRotation(44)).toBe(0);
    expect(normalizeImageRotation(46)).toBe(90);
  });

  it('detects quarter turns that swap the displayed footprint', () => {
    expect(isQuarterTurn(90)).toBe(true);
    expect(isQuarterTurn(270)).toBe(true);
    expect(isQuarterTurn(-90)).toBe(true);
    expect(isQuarterTurn(0)).toBe(false);
    expect(isQuarterTurn(180)).toBe(false);
  });

  it('round-trips rotation through the style string and back', () => {
    expect(parseRotationStyle('width: 200px; transform: rotate(90deg);')).toBe(90);
    expect(parseRotationStyle('transform: rotate(-90deg)')).toBe(270);
    expect(parseRotationStyle('width: 200px')).toBe(0);
    expect(parseRotationStyle('')).toBe(0);
  });

  it('serializes 0° to no attributes and other angles to data-rotation + transform', () => {
    expect(rotationToHtmlAttributes(0)).toEqual({});
    expect(rotationToHtmlAttributes(360)).toEqual({});
    expect(rotationToHtmlAttributes(90)).toEqual({
      'data-rotation': '90',
      style: 'transform: rotate(90deg);'
    });
    expect(rotationToHtmlAttributes(-90)).toEqual({
      'data-rotation': '270',
      style: 'transform: rotate(270deg);'
    });
  });

  it('only offers rotation for picture attachments', () => {
    expect(isRotatableAttachmentExtension('png')).toBe(true);
    expect(isRotatableAttachmentExtension('.JPG')).toBe(true);
    expect(isRotatableAttachmentExtension('jpeg')).toBe(true);
    expect(isRotatableAttachmentExtension('pdf')).toBe(false);
    expect(isRotatableAttachmentExtension('mp4')).toBe(false);
    expect(isRotatableAttachmentExtension('')).toBe(false);
  });
});
