import { sqlBooleanEnumIsTrue } from '../../utils/booleanEnum.js';

/** SQL fragment: row counts as interested (boolean_enum). */
export function sqlInterestedIsTrue(alias = 'r') {
  return sqlBooleanEnumIsTrue(alias, 'interested');
}
