/**
 * Level-based logger controlled by ~/.ssh/be/.env PM2_LOG_LEVEL.
 * Levels in sequence (most to least verbose): TRACE, DEBUG, INFO, WARN, ERROR, FATAL.
 * PM2_LOG_LEVEL "higher than" a message (e.g. WARN, ERROR, FATAL) blocks that message.
 * Only when PM2_LOG_LEVEL is lower or equal to the message level is it displayed.
 * Example: INFO message shows when PM2_LOG_LEVEL is TRACE, DEBUG, or INFO; hidden when WARN, ERROR, or FATAL.
 */
const LEVEL_ORDER = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4, FATAL: 5 };
const DEFAULT_LEVEL = 'INFO';

function getCurrentLevel() {
  const raw = process.env.PM2_LOG_LEVEL && String(process.env.PM2_LOG_LEVEL).trim().toUpperCase();
  if (raw && LEVEL_ORDER[raw] !== undefined) return LEVEL_ORDER[raw];
  return LEVEL_ORDER[DEFAULT_LEVEL];
}

const currentLevel = getCurrentLevel();

// Log when config is "lower or equal" to message level (config number <= message number).
// So INFO (2) is shown when config is TRACE(0), DEBUG(1), or INFO(2); hidden when WARN(3), ERROR(4), FATAL(5).
function shouldLog(level) {
  return LEVEL_ORDER[level] !== undefined && currentLevel <= LEVEL_ORDER[level];
}

function log(level, fn, ...args) {
  if (shouldLog(level)) fn(...args);
}

export const appLog = {
  trace: (...args) => log('TRACE', console.log, ...args),
  debug: (...args) => log('DEBUG', console.log, ...args),
  info: (...args) => log('INFO', console.log, ...args),
  warn: (...args) => log('WARN', console.warn, ...args),
  error: (...args) => log('ERROR', console.error, ...args),
  fatal: (...args) => log('FATAL', console.error, ...args)
};

export default appLog;
