/**
 * Registration pending state lives in Redis (see signupPendingStore.js) for multi-server round-robin.
 * This module remains for backward-compatible imports only.
 */
export {
  TOKEN_EXPIRY_MS,
  storeCreatePasswordToken as storeCreatePasswordToken,
  consumeCreatePasswordToken as consumeCreatePasswordToken,
  getCreatePasswordToken as getCreatePasswordToken,
  deleteCreatePasswordToken as deleteCreatePasswordToken,
  storePendingVerification as storePendingVerification,
  getPendingVerification as getPendingVerification,
  deletePendingVerification as deletePendingVerification
} from '../../utils/signupPendingStore.js';
