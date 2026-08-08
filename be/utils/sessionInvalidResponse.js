/** Session cookie/JWT present but member row missing from helloworldjunktest.singles. */
export const SESSION_INVALID_ERROR =
  'Login User Identity Error detected, please login again. If login fail, please contact admin.';

export function sessionInvalidJsonBody(errorMessage = SESSION_INVALID_ERROR) {
  const error = String(errorMessage ?? '').trim() || SESSION_INVALID_ERROR;
  return {
    error,
    sessionInvalid: true
  };
}

/** @param {import('express').Response} res */
export function respondSessionInvalid(res, errorMessage = SESSION_INVALID_ERROR) {
  return res.status(401).json(sessionInvalidJsonBody(errorMessage));
}
