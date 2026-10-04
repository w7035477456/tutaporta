#!/usr/bin/env node
/**
 * Object-level diff of two raw pg_dump --schema-only files (Mac = source of truth, Ubuntu = target).
 *
 *   node scripts/pg-schema-diff.mjs report <mac_raw.sql> <ubuntu_raw.sql>
 *   node scripts/pg-schema-diff.mjs sync   <mac_raw.sql> <ubuntu_raw.sql> [--include-destructive]
 *
 * Raw dumps come from: PG_SCHEMA_DUMP_RAW=1 bash scripts/pg-schema-dump.sh
 * ("-- Name: …; Type: …; Schema: …" headers are required to split objects).
 *
 * sync prints SQL that, run on Ubuntu, makes its schema match Mac. Statements that lose data
 * (DROP TABLE / DROP COLUMN / DROP SEQUENCE / DROP TYPE) are emitted commented out unless
 * --include-destructive is passed.
 */
import fs from 'node:fs';

const HEADER_RE = /^-- Name: (.+); Type: ([A-Z ]+); Schema: ([^;]+); Owner: .*$/;
const SKIP_LINE_RE = /^(SET |SELECT pg_catalog\.|\\restrict|\\unrestrict)/;
const RECREATE_TYPES = new Set(['INDEX', 'CONSTRAINT', 'FK CONSTRAINT', 'TRIGGER', 'VIEW', 'MATERIALIZED VIEW']);
const TABLE_OWNED_TYPES = new Set(['CONSTRAINT', 'FK CONSTRAINT', 'TRIGGER', 'DEFAULT']);

function parseDump(text) {
  const lines = text.split('\n');
  const objects = [];
  let cur = null;
  const finish = () => {
    if (!cur) return;
    const body = cur.raw.filter((l) => !SKIP_LINE_RE.test(l));
    while (body.length && (!body[body.length - 1].trim() || body[body.length - 1] === '--')) body.pop();
    while (body.length && !body[0].trim()) body.shift();
    cur.body = body.join('\n');
    cur.norm = body
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim() && !/^--/.test(l))
      .join('\n');
    cur.key = `${cur.type}|${cur.schema}|${cur.name}`;
    cur.order = objects.length;
    objects.push(cur);
    cur = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const m = HEADER_RE.exec(lines[i]);
    if (m) {
      if (cur && cur.raw.length && cur.raw[cur.raw.length - 1] === '--') cur.raw.pop();
      finish();
      cur = { name: m[1], type: m[2].trim(), schema: m[3].trim(), raw: [] };
      if (lines[i + 1] === '--') i += 1;
      continue;
    }
    if (cur) cur.raw.push(lines[i]);
  }
  if (cur && cur.raw.length && cur.raw[cur.raw.length - 1] === '--') cur.raw.pop();
  finish();
  return objects;
}

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`;
const unqualify = (name) => {
  const s = String(name || '').trim();
  const dot = s.lastIndexOf('.');
  return (dot >= 0 ? s.slice(dot + 1) : s).replace(/^"|"$/g, '');
};
const headerParts = (obj) => {
  const sp = obj.name.indexOf(' ');
  return sp < 0 ? [obj.name, ''] : [obj.name.slice(0, sp), obj.name.slice(sp + 1)];
};

function indexOwnerTable(obj) {
  const m = /\bON\s+(?:ONLY\s+)?([^\s(]+)/.exec(obj.body);
  return m ? unqualify(m[1]) : '';
}

function parseAttach(obj) {
  if (obj.type === 'INDEX ATTACH') {
    const m = /ALTER INDEX (\S+) ATTACH PARTITION (\S+);/.exec(obj.body);
    return m ? { parent: unqualify(m[1]), child: unqualify(m[2]) } : null;
  }
  if (obj.type === 'TABLE ATTACH') {
    const m = /ALTER TABLE (?:ONLY )?(\S+) ATTACH PARTITION (\S+)/.exec(obj.body);
    return m ? { parent: unqualify(m[1]), child: unqualify(m[2]), parentQualified: m[1], childQualified: m[2] } : null;
  }
  return null;
}

/** Index name for INDEX / CONSTRAINT blocks (PK/UNIQUE constraints share the index name). */
function indexLikeName(obj) {
  if (obj.type === 'INDEX') return obj.name;
  if (obj.type === 'CONSTRAINT') return headerParts(obj)[1];
  return '';
}

class DumpIndex {
  constructor(objects) {
    this.objects = objects;
    this.byKey = new Map(objects.map((o) => [o.key, o]));
    this.tables = new Set(objects.filter((o) => o.type === 'TABLE').map((o) => o.name));
    this.indexLike = new Map();
    this.indexParent = new Map();
    this.indexChildren = new Map();
    this.partitionParent = new Map();
    for (const o of objects) {
      const idx = indexLikeName(o);
      if (idx) this.indexLike.set(idx, o);
      const att = parseAttach(o);
      if (!att) continue;
      if (o.type === 'INDEX ATTACH') {
        this.indexParent.set(att.child, att.parent);
        if (!this.indexChildren.has(att.parent)) this.indexChildren.set(att.parent, []);
        this.indexChildren.get(att.parent).push(att.child);
      } else {
        this.partitionParent.set(att.child, att.parent);
      }
    }
  }

  ownerTable(obj) {
    if (TABLE_OWNED_TYPES.has(obj.type)) return headerParts(obj)[0];
    if (obj.type === 'INDEX') return indexOwnerTable(obj);
    if (obj.type === 'TABLE ATTACH') return obj.name;
    if (obj.type === 'INDEX ATTACH') {
      const idx = this.indexLike.get(obj.name);
      return idx ? this.ownerTable(idx) : '';
    }
    if (obj.type === 'SEQUENCE OWNED BY') {
      const m = /OWNED BY (\S+)\.[^.\s]+;/.exec(obj.body);
      return m ? unqualify(m[1]) : '';
    }
    return '';
  }
}

function classify(macObjs, ubObjs) {
  const mac = new DumpIndex(macObjs);
  const ub = new DumpIndex(ubObjs);
  const onlyMac = macObjs.filter((o) => !ub.byKey.has(o.key));
  const onlyUb = ubObjs.filter((o) => !mac.byKey.has(o.key));
  const changed = macObjs.filter((o) => ub.byKey.has(o.key) && ub.byKey.get(o.key).norm !== o.norm);
  return { mac, ub, onlyMac, onlyUb, changed };
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function lineDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push([' ', a[i]]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(['-', a[i]]);
      i += 1;
    } else {
      out.push(['+', b[j]]);
      j += 1;
    }
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}

function groupByOwnedTable(list, index) {
  const onlyTables = new Set(list.filter((o) => o.type === 'TABLE').map((o) => o.name));
  const onlyIndexes = new Set(list.map(indexLikeName).filter(Boolean));
  const related = new Map();
  const shown = [];
  const bump = (key) => related.set(key, (related.get(key) || 0) + 1);
  for (const o of list) {
    const owner = o.type === 'TABLE' ? '' : index.ownerTable(o);
    const childIndex = o.type === 'INDEX ATTACH' ? o.name : indexLikeName(o);
    const parentIndex = childIndex ? index.indexParent.get(childIndex) : '';
    if (owner && onlyTables.has(owner)) {
      bump(`TABLE|${owner}`);
    } else if (parentIndex && onlyIndexes.has(parentIndex)) {
      bump(`INDEX|${parentIndex}`);
    } else {
      shown.push(o);
    }
  }
  return shown.map((o) => {
    const idx = indexLikeName(o);
    const key = o.type === 'TABLE' ? `TABLE|${o.name}` : idx ? `INDEX|${idx}` : '';
    return { obj: o, related: key ? related.get(key) || 0 : 0 };
  });
}

function report(macObjs, ubObjs) {
  const tty = process.stdout.isTTY;
  const color = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
  const green = (s) => color('32', s);
  const red = (s) => color('31', s);
  const yellow = (s) => color('33', s);
  const bold = (s) => color('1', s);

  const { mac, ub, onlyMac, onlyUb, changed } = classify(macObjs, ubObjs);
  const label = (o) => `${o.type.padEnd(18)} ${o.name}`;
  const out = [];

  out.push(bold(`Mac (source of truth) vs Ubuntu — ${macObjs.length} vs ${ubObjs.length} objects`));

  const macShown = groupByOwnedTable(onlyMac, mac);
  out.push('');
  out.push(bold(green(`Only on Mac — missing on Ubuntu (${onlyMac.length}):`)));
  if (!macShown.length) out.push('  (none)');
  for (const { obj, related } of macShown) {
    out.push(green(`  + ${label(obj)}${related ? `  (+${related} related partition/index/attach objects)` : ''}`));
  }

  const ubShown = groupByOwnedTable(onlyUb, ub);
  out.push('');
  out.push(bold(red(`Only on Ubuntu — not on Mac (${onlyUb.length}):`)));
  if (!ubShown.length) out.push('  (none)');
  for (const { obj, related } of ubShown) {
    out.push(red(`  - ${label(obj)}${related ? `  (+${related} related partition/index/attach objects)` : ''}`));
  }

  out.push('');
  out.push(bold(yellow(`Different on both (${changed.length}):  ${red('- Ubuntu')}  ${green('+ Mac')}`)));
  if (!changed.length) out.push('  (none)');
  const MAX_LINES_PER_OBJECT = 40;
  for (const macObj of changed) {
    const ubObj = ub.byKey.get(macObj.key);
    out.push(yellow(`  ~ ${label(macObj)}`));
    const ops = lineDiff(ubObj.norm.split('\n'), macObj.norm.split('\n'));
    let printed = 0;
    for (const [op, text] of ops) {
      if (op === ' ') continue;
      if (printed >= MAX_LINES_PER_OBJECT) {
        out.push('      … (more lines differ)');
        break;
      }
      out.push(op === '+' ? green(`      + ${text}`) : red(`      - ${text}`));
      printed += 1;
    }
  }

  if (!onlyMac.length && !onlyUb.length && !changed.length) {
    out.push('');
    out.push('All objects match; the dumps differ only in object ordering/formatting.');
  }
  out.push('');
  out.push('To make Ubuntu match Mac: run  syncdbmacubuntu  (prints SQL to run on Ubuntu).');
  process.stdout.write(`${out.join('\n')}\n`);
}

// ---------------------------------------------------------------------------
// sync
// ---------------------------------------------------------------------------

function parseEnum(obj) {
  const m = /^CREATE TYPE (\S+) AS ENUM \(([\s\S]*)\);\s*$/.exec(obj.body.trim());
  if (!m) return null;
  const labels = [];
  const re = /'((?:[^']|'')*)'/g;
  let lm;
  while ((lm = re.exec(m[2]))) labels.push(lm[1]);
  return { name: m[1], labels };
}

function splitTableEntries(lines) {
  const entries = [];
  for (const line of lines) {
    if (/^ {4}\S/.test(line) || !entries.length) entries.push(line.trim());
    else entries[entries.length - 1] += `\n${line}`;
  }
  return entries.map((e) => e.replace(/,\s*$/, ''));
}

function parseTable(obj) {
  const lines = obj.body.split('\n');
  const head = /^CREATE (UNLOGGED )?TABLE (\S+) \($/.exec(lines[0]);
  if (!head) return null;
  let close = -1;
  for (let i = lines.length - 1; i > 0; i -= 1) {
    if (/^\)/.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close < 0) return null;
  const columns = new Map();
  const columnOrder = [];
  const constraints = new Map();
  for (const entry of splitTableEntries(lines.slice(1, close))) {
    const cm = /^CONSTRAINT (\S+) ([\s\S]+)$/.exec(entry);
    if (cm) {
      constraints.set(cm[1], cm[2]);
      continue;
    }
    let name;
    let rest;
    if (entry.startsWith('"')) {
      const end = entry.indexOf('"', 1);
      name = entry.slice(0, end + 1);
      rest = entry.slice(end + 1).trim();
    } else {
      const sp = entry.indexOf(' ');
      name = entry.slice(0, sp);
      rest = entry.slice(sp + 1);
    }
    columns.set(name, parseColumnDef(rest));
    columnOrder.push(name);
  }
  return {
    qualified: head[2],
    unlogged: Boolean(head[1]),
    tail: lines.slice(close).join('\n'),
    columns,
    columnOrder,
    constraints
  };
}

function parseColumnDef(rest) {
  let s = rest;
  let notNull = false;
  if (/ NOT NULL$/.test(s)) {
    notNull = true;
    s = s.slice(0, -' NOT NULL'.length);
  }
  let generated = null;
  const gi = s.indexOf(' GENERATED ');
  if (gi >= 0) {
    generated = s.slice(gi + 1);
    s = s.slice(0, gi);
  }
  let dflt = null;
  const di = s.indexOf(' DEFAULT ');
  if (di >= 0) {
    dflt = s.slice(di + ' DEFAULT '.length);
    s = s.slice(0, di);
  }
  return { full: rest, type: s, default: dflt, notNull, generated };
}

function buildSync(macObjs, ubObjs, { includeDestructive = false } = {}) {
  const { mac, ub, onlyMac, onlyUb, changed } = classify(macObjs, ubObjs);
  const onlyMacKeys = new Set(onlyMac.map((o) => o.key));
  const onlyUbKeys = new Set(onlyUb.map((o) => o.key));
  const changedKeys = new Set(changed.map((o) => o.key));
  const onlyUbTables = new Set(onlyUb.filter((o) => o.type === 'TABLE').map((o) => o.name));
  const changedTables = new Set(changed.filter((o) => o.type === 'TABLE').map((o) => o.name));

  const phase0 = [];
  const phase1 = [];
  const phase2 = [];
  const phase3 = [];
  const manual = [];
  const emitted = new Set();
  let destructiveCount = 0;

  const comment = (text) => text.split('\n').map((l) => `-- ${l}`).join('\n');
  const stmt = (list, why, sql, { destructive = false } = {}) => {
    if (destructive && !includeDestructive) {
      destructiveCount += 1;
      list.push(`-- ${why}  [DESTRUCTIVE — uncomment to apply]\n${comment(sql)}`);
    } else {
      list.push(`-- ${why}\n${sql}`);
    }
  };
  const addManual = (obj, why) => manual.push(`${obj.type} ${obj.name}: ${why}`);
  const label = (o) => `${o.type} ${o.name}`;
  const isChangedParentIndex = (name) => {
    const parent = mac.indexLike.get(name);
    return parent && changedKeys.has(parent.key);
  };

  // Phase 0 — enum values (ALTER TYPE … ADD VALUE cannot be used inside the same transaction).
  for (const macObj of changed.filter((o) => o.type === 'TYPE')) {
    const me = parseEnum(macObj);
    const ue = parseEnum(ub.byKey.get(macObj.key));
    if (!me || !ue) {
      addManual(macObj, 'non-enum type differs; alter by hand');
      continue;
    }
    const have = [...ue.labels];
    me.labels.forEach((lbl, i) => {
      if (have.includes(lbl)) return;
      const lit = `'${lbl.replace(/'/g, "''")}'`;
      let pos = '';
      if (i > 0) pos = ` AFTER '${me.labels[i - 1].replace(/'/g, "''")}'`;
      else if (have.length) pos = ` BEFORE '${have[0].replace(/'/g, "''")}'`;
      stmt(phase0, `${label(macObj)}: add enum value`, `ALTER TYPE ${me.name} ADD VALUE IF NOT EXISTS ${lit}${pos};`);
      have.splice(i > 0 ? have.indexOf(me.labels[i - 1]) + 1 : 0, 0, lbl);
    });
    const extra = ue.labels.filter((l) => !me.labels.includes(l));
    if (extra.length) addManual(macObj, `Ubuntu has extra enum values not on Mac: ${extra.join(', ')} (Postgres cannot drop enum values)`);
    else if (have.join('\u0000') !== me.labels.join('\u0000')) addManual(macObj, 'enum value order differs');
  }

  const dropSql = (obj) => {
    const [first, second] = headerParts(obj);
    const schema = q(obj.schema);
    switch (obj.type) {
      case 'TABLE': {
        const m = /^CREATE (?:UNLOGGED )?TABLE (\S+)/.exec(obj.body);
        return { sql: `DROP TABLE IF EXISTS ${m ? m[1] : `${schema}.${q(obj.name)}`};`, destructive: true };
      }
      case 'SEQUENCE': {
        const ident = /^ALTER TABLE (\S+) ALTER COLUMN (\S+) ADD GENERATED/.exec(obj.body);
        if (ident) return { sql: `ALTER TABLE ${ident[1]} ALTER COLUMN ${ident[2]} DROP IDENTITY IF EXISTS;` };
        return { sql: `DROP SEQUENCE IF EXISTS ${schema}.${q(obj.name)};`, destructive: true };
      }
      case 'VIEW':
        return { sql: `DROP VIEW IF EXISTS ${schema}.${q(obj.name)};` };
      case 'MATERIALIZED VIEW':
        return { sql: `DROP MATERIALIZED VIEW IF EXISTS ${schema}.${q(obj.name)};` };
      case 'FUNCTION':
      case 'PROCEDURE': {
        const paren = obj.name.indexOf('(');
        return { sql: `DROP ${obj.type} IF EXISTS ${schema}.${q(obj.name.slice(0, paren))}${obj.name.slice(paren)};` };
      }
      case 'INDEX':
        return { sql: `DROP INDEX IF EXISTS ${schema}.${q(obj.name)};` };
      case 'CONSTRAINT':
      case 'FK CONSTRAINT':
        return { sql: `ALTER TABLE ${schema}.${q(first)} DROP CONSTRAINT IF EXISTS ${q(second)};` };
      case 'TRIGGER':
        return { sql: `DROP TRIGGER IF EXISTS ${q(second)} ON ${schema}.${q(first)};` };
      case 'DEFAULT':
        return { sql: `ALTER TABLE ${schema}.${q(first)} ALTER COLUMN ${q(second)} DROP DEFAULT;` };
      case 'TYPE':
        return { sql: `DROP TYPE IF EXISTS ${schema}.${q(obj.name)};`, destructive: true };
      case 'TABLE ATTACH': {
        const att = parseAttach(obj);
        return att ? { sql: `ALTER TABLE ${att.parentQualified} DETACH PARTITION ${att.childQualified};`, destructive: true } : null;
      }
      default:
        return null;
    }
  };

  // Phase 1 — drops (reverse Ubuntu dump order so dependents go first).
  for (const ubObj of [...ubObjs].reverse()) {
    const isOnlyUb = onlyUbKeys.has(ubObj.key);
    const isChanged = changedKeys.has(ubObj.key);
    if (!isOnlyUb && !(isChanged && RECREATE_TYPES.has(ubObj.type))) continue;
    if (ubObj.type === 'SCHEMA' || ubObj.type === 'SEQUENCE OWNED BY' || ubObj.type === 'INDEX ATTACH') continue;

    const owner = ub.ownerTable(ubObj);
    if (isOnlyUb && ubObj.type !== 'TABLE' && owner && onlyUbTables.has(owner)) continue;
    if (ubObj.type === 'TABLE ATTACH' && onlyUbTables.has(ubObj.name)) continue;

    const idxName = indexLikeName(ubObj);
    if (idxName && ub.indexParent.has(idxName)) {
      const parentName = ub.indexParent.get(idxName);
      const parentObj = ub.indexLike.get(parentName);
      const parentGoes = parentObj && (onlyUbKeys.has(parentObj.key) || changedKeys.has(parentObj.key));
      if (!parentGoes) addManual(ubObj, `partition index attached to ${parentName} differs; fix the parent index by hand`);
      continue;
    }

    const d = dropSql(ubObj);
    if (!d) {
      addManual(ubObj, isOnlyUb ? 'exists only on Ubuntu; drop by hand if unwanted' : 'differs; recreate by hand');
      continue;
    }
    stmt(phase1, `${label(ubObj)}: ${isOnlyUb ? 'not on Mac' : 'changed on Mac (drop, re-create below)'}`, d.sql, {
      destructive: Boolean(d.destructive)
    });
  }

  const createSql = (obj) => {
    if (obj.type === 'INDEX') return obj.body.replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/, 'CREATE $1INDEX IF NOT EXISTS ');
    return obj.body;
  };

  const emitCreate = (obj, why) => {
    if (emitted.has(obj.key)) return;
    emitted.add(obj.key);
    if (obj.type === 'TABLE ATTACH' || obj.type === 'INDEX ATTACH') {
      stmt(phase3, `${label(obj)}: ${why}`, obj.body);
      return;
    }
    stmt(phase2, `${label(obj)}: ${why}`, createSql(obj));
  };

  /** Recreating a partitioned parent index/constraint drops its partition children — re-create them too. */
  const emitIndexFamily = (parentObj) => {
    const parentName = indexLikeName(parentObj);
    for (const childName of mac.indexChildren.get(parentName) || []) {
      const childObj = mac.indexLike.get(childName);
      if (childObj && !onlyMacKeys.has(childObj.key)) emitCreate(childObj, `re-create partition child of ${parentName}`);
      const attachObj = mac.byKey.get(`INDEX ATTACH|${parentObj.schema}|${childName}`);
      if (attachObj) emitCreate(attachObj, `re-attach to ${parentName}`);
    }
  };

  const alterTable = (macObj, ubObj) => {
    const mt = parseTable(macObj);
    const ut = parseTable(ubObj);
    if (!mt || !ut) {
      addManual(macObj, 'table definition could not be parsed; compare by hand');
      return;
    }
    const isPartition = mac.partitionParent.has(macObj.name) && ub.partitionParent.has(macObj.name);
    if (isPartition) {
      const parent = mac.partitionParent.get(macObj.name);
      if (!changedTables.has(parent)) addManual(macObj, `partition of ${parent} differs but the parent does not; compare by hand`);
      return;
    }
    const t = mt.qualified;
    const before = phase2.length;
    for (const col of mt.columnOrder) {
      const mc = mt.columns.get(col);
      const uc = ut.columns.get(col);
      if (!uc) {
        const warn = mc.notNull && mc.default == null && !mc.generated ? ' (NOT NULL without DEFAULT fails if the table has rows)' : '';
        stmt(phase2, `${label(macObj)}: add column ${col}${warn}`, `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${col} ${mc.full};`);
        continue;
      }
      if (mc.generated !== uc.generated) {
        addManual(macObj, `column ${col} generated expression differs`);
        continue;
      }
      if (mc.type !== uc.type) {
        const usingType = mc.type.replace(/ COLLATE \S+$/, '');
        stmt(phase2, `${label(macObj)}: column ${col} type ${uc.type} -> ${mc.type}`, `ALTER TABLE ${t} ALTER COLUMN ${col} TYPE ${mc.type} USING ${col}::${usingType};`);
      }
      if (mc.default !== uc.default) {
        stmt(
          phase2,
          `${label(macObj)}: column ${col} default`,
          mc.default == null ? `ALTER TABLE ${t} ALTER COLUMN ${col} DROP DEFAULT;` : `ALTER TABLE ${t} ALTER COLUMN ${col} SET DEFAULT ${mc.default};`
        );
      }
      if (mc.notNull !== uc.notNull) {
        stmt(phase2, `${label(macObj)}: column ${col} ${mc.notNull ? 'SET' : 'DROP'} NOT NULL`, `ALTER TABLE ${t} ALTER COLUMN ${col} ${mc.notNull ? 'SET' : 'DROP'} NOT NULL;`);
      }
    }
    for (const col of ut.columnOrder) {
      if (!mt.columns.has(col)) {
        stmt(phase2, `${label(macObj)}: column ${col} not on Mac`, `ALTER TABLE ${t} DROP COLUMN IF EXISTS ${col};`, { destructive: true });
      }
    }
    for (const [name, def] of mt.constraints) {
      const udef = ut.constraints.get(name);
      if (udef === def) continue;
      if (udef != null) stmt(phase2, `${label(macObj)}: check constraint ${name} changed`, `ALTER TABLE ${t} DROP CONSTRAINT IF EXISTS ${name};`);
      stmt(phase2, `${label(macObj)}: check constraint ${name}`, `ALTER TABLE ${t} ADD CONSTRAINT ${name} ${def};`);
    }
    for (const name of ut.constraints.keys()) {
      if (!mt.constraints.has(name)) stmt(phase2, `${label(macObj)}: check constraint ${name} not on Mac`, `ALTER TABLE ${t} DROP CONSTRAINT IF EXISTS ${name};`);
    }

    const shared = mt.columnOrder.filter((c) => ut.columns.has(c));
    const ubShared = ut.columnOrder.filter((c) => mt.columns.has(c));
    const lastShared = mt.columnOrder.lastIndexOf(shared[shared.length - 1]);
    const addedMidTable = mt.columnOrder.filter((c, i) => !ut.columns.has(c) && i < lastShared);
    if (shared.join(',') !== ubShared.join(',')) {
      addManual(macObj, 'column order differs (Postgres cannot reorder columns; isdbsame will keep reporting this table)');
    } else if (addedMidTable.length) {
      addManual(macObj, `new column(s) ${addedMidTable.join(', ')} sit mid-table on Mac but ADD COLUMN appends at the end (isdbsame will keep reporting this table)`);
    }
    if (mt.tail !== ut.tail || mt.unlogged !== ut.unlogged) addManual(macObj, 'table storage/partitioning clause differs');
    if (phase2.length === before && !manual.some((m) => m.startsWith(`${macObj.type} ${macObj.name}:`))) {
      addManual(macObj, 'differs only in formatting/column order');
    }
  };

  // Phase 2 — create / alter in Mac dump order (pg_dump order respects dependencies).
  for (const macObj of macObjs) {
    if (macObj.type === 'SCHEMA') continue;
    if (onlyMacKeys.has(macObj.key)) {
      emitCreate(macObj, 'missing on Ubuntu');
      if (RECREATE_TYPES.has(macObj.type)) emitIndexFamily(macObj);
      continue;
    }
    if (!changedKeys.has(macObj.key)) continue;
    const ubObj = ub.byKey.get(macObj.key);

    if (RECREATE_TYPES.has(macObj.type)) {
      const idxName = indexLikeName(macObj);
      if (idxName && mac.indexParent.has(idxName) && isChangedParentIndex(mac.indexParent.get(idxName))) continue;
      emitCreate(macObj, 're-create with Mac definition');
      emitIndexFamily(macObj);
      continue;
    }
    switch (macObj.type) {
      case 'FUNCTION':
      case 'PROCEDURE': {
        const retOf = (o) => (/\)\s+RETURNS\s+(.+)$/m.exec(o.body.split('\n')[0]) || [])[1] || '';
        if (retOf(macObj) !== retOf(ubObj)) {
          const d = dropSql(ubObj);
          stmt(phase2, `${label(macObj)}: return type changed`, d.sql);
          stmt(phase2, `${label(macObj)}: Mac definition`, macObj.body);
        } else {
          stmt(phase2, `${label(macObj)}: Mac definition`, macObj.body.replace(/^CREATE (FUNCTION|PROCEDURE) /, 'CREATE OR REPLACE $1 '));
        }
        break;
      }
      case 'DEFAULT':
      case 'SEQUENCE OWNED BY':
      case 'INDEX ATTACH':
        emitCreate(macObj, 'Mac definition');
        break;
      case 'SEQUENCE':
        if (/^CREATE SEQUENCE /.test(macObj.body) && /^CREATE SEQUENCE /.test(ubObj.body)) {
          stmt(phase2, `${label(macObj)}: sequence options`, macObj.body.replace(/^CREATE SEQUENCE /, 'ALTER SEQUENCE '));
        } else {
          addManual(macObj, 'identity/sequence definition differs');
        }
        break;
      case 'TABLE':
        alterTable(macObj, ubObj);
        break;
      case 'TYPE':
        break;
      case 'TABLE ATTACH':
        addManual(macObj, 'partition bounds differ (detach/re-attach by hand)');
        break;
      default:
        addManual(macObj, 'differs; apply the Mac definition by hand');
    }
  }

  const out = [];
  const nowIso = new Date().toISOString();
  out.push('-- syncdbmacubuntu: make the Ubuntu schema match the Mac schema');
  out.push(`-- generated ${nowIso}`);
  out.push(`-- only on Mac: ${onlyMac.length}   only on Ubuntu: ${onlyUb.length}   different: ${changed.length}`);
  if (destructiveCount) {
    out.push(`-- ${destructiveCount} destructive statement(s) are commented out (data loss). Review and uncomment if intended.`);
  }
  out.push('');
  out.push('\\set ON_ERROR_STOP on');
  out.push("SELECT pg_catalog.set_config('search_path', '', false);");
  out.push('SET check_function_bodies = false;');
  out.push('');
  if (phase0.length) {
    out.push('-- ===== Enum values (outside the transaction) =====');
    out.push(...phase0, '');
  }
  out.push('BEGIN;', '');
  if (phase1.length) out.push('-- ===== Drop objects removed or changed on Mac =====', ...phase1.flatMap((s) => [s, '']));
  if (phase2.length) out.push('-- ===== Create / alter to match Mac =====', ...phase2.flatMap((s) => [s, '']));
  if (phase3.length) out.push('-- ===== Attach partitions / partition indexes =====', ...phase3.flatMap((s) => [s, '']));
  out.push('COMMIT;');
  if (manual.length) {
    out.push('', '-- ===== Needs manual review (not auto-generated) =====');
    for (const m of manual) out.push(`--   ${m}`);
  }
  const hasWork = phase0.length + phase1.length + phase2.length + phase3.length > 0;
  return { sql: `${out.join('\n')}\n`, hasWork, manualCount: manual.length, destructiveCount };
}

// ---------------------------------------------------------------------------

function main() {
  const [mode, macPath, ubPath, ...flags] = process.argv.slice(2);
  if (!['report', 'sync'].includes(mode) || !macPath || !ubPath) {
    process.stderr.write('usage: pg-schema-diff.mjs report|sync <mac_raw.sql> <ubuntu_raw.sql> [--include-destructive]\n');
    process.exit(2);
  }
  const macObjs = parseDump(fs.readFileSync(macPath, 'utf8'));
  const ubObjs = parseDump(fs.readFileSync(ubPath, 'utf8'));
  if (!macObjs.length || !ubObjs.length) {
    process.stderr.write('ERROR: no "-- Name:" headers found; pass raw dumps (PG_SCHEMA_DUMP_RAW=1).\n');
    process.exit(2);
  }
  if (mode === 'report') {
    report(macObjs, ubObjs);
    return;
  }
  const result = buildSync(macObjs, ubObjs, { includeDestructive: flags.includes('--include-destructive') });
  process.stdout.write(result.sql);
  process.exit(result.hasWork ? 0 : 3);
}

main();
