/**
 * @deprecated Prefer `config/hoverMagnifyEnv.js` (HOVER_MAGNIFY_FACTOR).
 * Re-exports kept for photo/card hover scaling and legacy imports.
 */
import {
  buttonHoverMagnifyTransitionSx,
  getHoverEnlargeTransform,
  getHoverMagnifyFactor
} from 'config/hoverMagnifyEnv';

export { getHoverEnlargeTransform, getHoverMagnifyFactor };

/** @deprecated use getHoverMagnifyFactor */
export function getHoverEnlargeFactor() {
  return getHoverMagnifyFactor();
}

export const hoverEnlargeBaseSx = {
  transform: 'scale(1)',
  transformOrigin: 'center',
  transition: 'transform 180ms ease'
};

/** Scale the element itself on hover (non-button targets). */
export function hoverEnlargeSx() {
  return {
    ...hoverEnlargeBaseSx,
    '&:hover': {
      transform: getHoverEnlargeTransform()
    }
  };
}

/**
 * Scale children when the parent is hovered (pass class names like ".clickable-profile-photo").
 */
export function hoverEnlargeChildrenSx(classNames) {
  const scale = getHoverEnlargeTransform();
  const selectors = Array.isArray(classNames) ? classNames : [classNames];
  return selectors.reduce((acc, className) => {
    const normalized = className.startsWith('.') ? className : `.${className}`;
    acc[`&:hover ${normalized}`] = {
      transform: scale,
      transformOrigin: 'center'
    };
    return acc;
  }, {});
}

export { buttonHoverMagnifyTransitionSx };
