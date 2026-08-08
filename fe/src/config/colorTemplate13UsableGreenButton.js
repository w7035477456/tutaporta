/**
 * ColorTemplate13UsableGreenButton — green action pill (e.g. Send SMS Code).
 * Enabled: green + clickable. Disabled: grey + no click.
 * Shares ColorTemplate13 typography, border, and fit-label width.
 */
import { colorTemplate13DisableGreenButtonSx } from 'config/colorTemplate13DisableGreenButton';

/** @param {{ disabled?: boolean, hoverEnlargeFont?: boolean }} [opts] */
export function colorTemplate13UsableGreenButtonSx({ disabled = false, hoverEnlargeFont = false } = {}) {
  return colorTemplate13DisableGreenButtonSx({ activeVariant: 'green', disabled, hoverEnlargeFont });
}
