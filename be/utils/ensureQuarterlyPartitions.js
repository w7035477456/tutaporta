import pool from '../db/connection.js';
import { getDBSchema } from '../config/envConfig.js';
import {
  addQuartersUtc,
  quarterStartUtc,
  quarterlyPartitionName,
  utcQuarterEndSql,
  utcQuarterStartSql
} from './quarterlyRangePartitions.js';

function getSchemaSqlIdent() {
  return String(getDBSchema() || 'public').replace(/"/g, '""');
}

function getSchemaName() {
  return String(getDBSchema() || 'public');
}

async function partitionExists(schemaName, partName) {
  const result = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2
    ) AS ok
    `,
    [schemaName, partName]
  );
  return result.rows[0]?.ok === true;
}

async function getPriorPartitionUpperBoundSql(schemaName, parentTable, curQuarterStart) {
  const prev = addQuartersUtc(quarterStartUtc(curQuarterStart), -1);
  const prevPart = quarterlyPartitionName(parentTable, prev);
  const result = await pool.query(
    `
    SELECT pg_get_expr(c.relpartbound, c.oid, true) AS expr
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relname = $2
    `,
    [schemaName, prevPart]
  );
  const expr = String(result.rows[0]?.expr ?? '');
  const match = expr.match(/TO\s*\(\s*'((?:[^']|'')*)'\s*\)/i);
  if (!match) return null;
  const ts = String(match[1]).replace(/'/g, "''");
  return `'${ts}'::timestamptz`;
}

async function ensureQuarterlyPartition(schema, parentTable, quarterStart) {
  const cur = quarterStartUtc(quarterStart);
  const part = quarterlyPartitionName(parentTable, cur);
  const schemaName = getSchemaName();
  if (await partitionExists(schemaName, part)) return;

  const priorTo = await getPriorPartitionUpperBoundSql(schemaName, parentTable, cur);
  const rangeStart = priorTo ?? utcQuarterStartSql(cur);
  const rangeEnd = priorTo ? `(${priorTo} + INTERVAL '3 months')` : utcQuarterEndSql(cur);

  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS "${schema}"."${part}"
    PARTITION OF "${schema}"."${parentTable}"
    FOR VALUES FROM (${rangeStart}) TO (${rangeEnd})
    `
  );
}

/** Current UTC calendar quarter + the next quarter only. */
export async function ensureQuarterlyPartitionsBeforeWrite(parentTable, at = new Date()) {
  const schema = getSchemaSqlIdent();
  const anchor = quarterStartUtc(at);
  await ensureQuarterlyPartition(schema, parentTable, anchor);
  await ensureQuarterlyPartition(schema, parentTable, addQuartersUtc(anchor, 1));
}

export async function ensurePostingQuarterlyPartitionsBeforeWrite(at = new Date()) {
  await ensureQuarterlyPartitionsBeforeWrite('postings', at);
  await ensureQuarterlyPartitionsBeforeWrite('posting_photos', at);
  await ensureQuarterlyPartitionsBeforeWrite('posting_comments', at);
}

/** Create posting partitions for every UTC quarter from `fromDate` through `toDate` (inclusive) plus the next quarter. */
export async function ensurePostingQuarterlyPartitionsForRange(fromDate, toDate = new Date()) {
  let q = quarterStartUtc(fromDate);
  const last = addQuartersUtc(quarterStartUtc(toDate), 1);
  while (q.getTime() <= last.getTime()) {
    await ensurePostingQuarterlyPartitionsBeforeWrite(q);
    q = addQuartersUtc(q, 1);
  }
}

export async function ensureChatLogQuarterlyPartitionsBeforeWrite(at = new Date()) {
  await ensureQuarterlyPartitionsBeforeWrite('chat_log', at);
}

export async function ensureGroupChatLogQuarterlyPartitionsBeforeWrite(at = new Date()) {
  await ensureQuarterlyPartitionsBeforeWrite('group_chat_log', at);
}
