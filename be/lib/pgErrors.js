/** PostgreSQL: undefined_table */
export function isUndefinedTableError(err) {
  return Boolean(err && err.code === '42P01');
}
