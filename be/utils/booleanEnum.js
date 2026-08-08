import { getDBSchema } from '../config/envConfig.js';

export function requestSchemaName(schema) {
  return String(schema ?? getDBSchema() ?? 'helloworldjunktest').replace(/"/g, '');
}

/** SQL cast target, e.g. "helloworldjunktest".boolean_enum */
export function booleanEnumCast(schema) {
  return `"${requestSchemaName(schema)}".boolean_enum`;
}

/** Parse boolean_enum ('true' / 'false') from DB/API. */
export function parseBooleanEnumRaw(raw) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0 || raw == null) return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === 't' || s === 'yes' || s === '1';
}

export function toBooleanEnumLabel(value) {
  return parseBooleanEnumRaw(value) ? 'true' : 'false';
}

/** SQL fragment: column is logically true (boolean_enum). */
export function sqlBooleanEnumIsTrue(alias, column) {
  const col = `${alias}.${column}`;
  return `(LOWER(BTRIM(${col}::text)) = 'true')`;
}

/** SQL literal, e.g. 'false'::"schema".boolean_enum */
export function sqlBooleanEnumLiteral(value, schema) {
  const label = toBooleanEnumLabel(value);
  return `'${label}'::${booleanEnumCast(schema)}`;
}

/** SQL literal for bool or boolean_enum column (detected via information_schema udt_name). */
export function sqlBooleanColumnLiteral(value, udtName, schema) {
  if (String(udtName || '').toLowerCase() === 'boolean_enum') {
    return sqlBooleanEnumLiteral(value, schema);
  }
  return parseBooleanEnumRaw(value) ? 'TRUE' : 'FALSE';
}

/** Parameter cast for bool or boolean_enum column. */
export function sqlBooleanColumnParam(paramRef, udtName, schema) {
  if (String(udtName || '').toLowerCase() === 'boolean_enum') {
    return sqlBooleanEnumParam(paramRef, schema);
  }
  return `${paramRef}::boolean`;
}

const columnUdtCache = new Map();

/** Cached information_schema.columns.udt_name for one column. */
export async function loadColumnUdtName(client, schema, table, column) {
  const schemaName = requestSchemaName(schema);
  const cacheKey = `${schemaName}.${table}.${column}`;
  if (columnUdtCache.has(cacheKey)) {
    return columnUdtCache.get(cacheKey);
  }
  const { rows } = await client.query(
    `SELECT udt_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2
       AND column_name = $3
     LIMIT 1`,
    [schemaName, table, column]
  );
  const udtName = rows[0]?.udt_name || 'bool';
  columnUdtCache.set(cacheKey, udtName);
  return udtName;
}

/** Parameter cast, e.g. $3::"helloworldjunktest".boolean_enum */
export function sqlBooleanEnumParam(paramRef, schema) {
  return `${paramRef}::${booleanEnumCast(schema)}`;
}

/** SELECT expression returning SQL boolean for JSON APIs. */
export function sqlBooleanEnumSelectAsBool(alias, column, asName = column) {
  return `(${sqlBooleanEnumIsTrue(alias, column)}) AS ${asName}`;
}

/** SELECT expression for unqualified column name. */
export function sqlBooleanEnumColumnAsBool(column, asName = column) {
  return `(LOWER(BTRIM(${column}::text)) = 'true') AS ${asName}`;
}
