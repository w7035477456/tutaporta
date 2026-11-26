# Schema Migration Process (Mac → Ubuntu)

**Audience:** AI coding agents (Claude Code, Cursor) and Andrew.
**Rule:** follow every step below whenever a change touches the Postgres schema. If a step cannot be
followed, stop and say why — do not work around it.

---

## 1. The one rule

> **Every schema change is a new file in `be/db/migrations/`. Nothing else changes the schema.**

A schema change is any DDL: `CREATE` / `ALTER` / `DROP` of tables, columns, indexes, constraints,
enums, functions, triggers, views, sequences, comments; also `GRANT`s, and data backfills that a
code change depends on (e.g. filling a new NOT NULL column).

Not allowed:

| Don't | Why |
|---|---|
| Run DDL by hand with `psql -c "ALTER …"` (Mac or Ubuntu) | Ubuntu never gets it → drift |
| Put new DDL only in loose `be/db/*.sql` files | Nothing runs them on Ubuntu |
| Add new `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` in JS startup code | Hidden schema, races across the cluster; existing ones are legacy — don't add more |
| Edit a migration that already ran anywhere | Runner reports it as `CHANGED` and never re-runs it |
| Apply DDL on Ubuntu directly (`scripts/ubuntu-psql.sh`, `ssh xbox0 psql …`) | Bypasses `schema_migrations`; `work2` is the only path to Ubuntu |

## 2. How it works (already set up)

| Piece | What it does |
|---|---|
| `be/db/migrations/YYYYMMDD_NN_shortName.sql` | One change per file. Name order = run order. |
| `scripts/db-migrate.sh` (alias `dbmigrate`) | Applies pending files to **this** machine's Postgres (direct port 50010, never PgBouncer 6432). Each file runs in one transaction with its row in `outdateddbsnapshotoct2024.schema_migrations` — all or nothing, runs once per machine. |
| `dbmigrate --status` / `--dry-run` | Show applied / pending; change nothing. |
| `work1` (Mac `~/b`) | Runs `db-migrate.sh` on the Mac, stages `be/db/migrations/`, commits, pushes. A failing migration stops `work1` before anything is committed. |
| `work2` (Ubuntu `~/b`) | Pulls, runs `db-migrate.sh` on Ubuntu **before** `febeprod`. A failing migration aborts the deploy; the old build keeps running. |
| `isdbsame` (Mac, `scripts/compare-pg-schema.sh`) | Compares Mac vs Ubuntu schema; first line `same` or `difference` (`--verbose` for details). |

`beall` (Mac) and `deployall2` (`scripts/remote-deploy-work2.sh`) also run `db-migrate.sh`.

## 3. Agent steps (every schema change)

1. **Check state first:** `scripts/db-migrate.sh --status` → must show `0 pending` and no `CHANGED`.
   If not, stop and report.
2. **Create the file** `be/db/migrations/<today YYYYMMDD>_<NN>_<shortName>.sql`
   - `NN` = next number for that date (`01`, `02`, …); `shortName` = `[A-Za-z0-9_]+`.
   - Start with a 1–3 line `--` comment: what and why.
3. **Write the SQL to these rules:**
   - Always schema-qualify: `outdateddbsnapshotoct2024.<table>`. Never schema `public`.
   - Idempotent where possible: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
     `CREATE INDEX IF NOT EXISTS`, `DROP … IF EXISTS`; for constraints,
     `ALTER TABLE … DROP CONSTRAINT IF EXISTS x;` then `ADD CONSTRAINT x …`.
   - **Backward compatible** (expand → contract): `work2` migrates *before* the new build is up,
     and if the build fails the **old code runs on the new schema**. So:
     - new columns are nullable or have a `DEFAULT`;
     - never rename/drop a column the current code still reads — add the new one, ship code
       that uses it, drop the old one in a **later** migration/deploy;
     - widen constraints first, tighten later.
   - Large tables: `CREATE INDEX CONCURRENTLY` + the line `-- migrate:no-transaction` in the file.
   - No `BEGIN` / `COMMIT` in the file (the runner wraps it). No `\c`, no role changes.
   - Use role `test_user1`. Never the `postgres` role.
   - Backfills: plain `UPDATE … WHERE <not yet done>` so a re-run is harmless.
4. **Apply on the Mac:** `scripts/db-migrate.sh` → must end `done: 1 applied`.
   - If it fails: nothing was recorded. Fix the **same** file (it never ran successfully) and re-run.
5. **Test** the feature against the migrated Mac DB (backend handler / SQL in a rolled-back
   transaction / UI).
6. **Optional drift check:** `isdbsame` → expected `difference` showing **only** the new objects as
   Mac-only (Ubuntu gets them on `work2`). Anything else in the diff = pre-existing drift → report it.
7. **Do not commit** unless Andrew asks. Hand over with the DO THIS block below.
8. **Update code that builds/restores data** if the table is in a backup or copy path
   (e.g. `billScheduleBackup.js`, `billScheduleTransferRoutes.js`, `tutaMallUserBackup.js`).

### Fixing a mistake after it was applied

Never edit the applied file. Add a new migration that corrects it (e.g. `…_06_fixTodoHeaderCheck.sql`).
There are no down-migrations; a rollback is a new forward migration.

## 4. One-time data / file scripts (not schema)

Jobs that rewrite files on disk or bulk data outside the schema (e.g. `be/scripts/sealBillReceipts.mjs`)
are **not** migrations — they need the app's env/keys and storage folders. Rules:

- Script lives in `be/scripts/`, **dry run by default**, `--apply` to write, prints a summary,
  never prints secrets, ends with `process.exit` (loadEnv's timer keeps node alive).
- Deploy the code that reads the new format **before** running `--apply` (run `work2` first on Ubuntu).
- Give Andrew both machines' commands (dry run, then apply) in the DO THIS block.

## 5. Hand-over block (agent → Andrew)

Every reply that adds a migration ends with:

```
######## DO THIS BEGIN ########
--- Mac (terminal) ---
dbmigrate --status            # expect: 0 pending (agent already applied it)
work1                         # commits + pushes, incl. be/db/migrations/

--- Ubuntu (terminal) ---
source ~/b
work2                         # pulls, runs db-migrate, then builds/deploys
dbmigrate --status            # expect: 0 pending

--- Mac (terminal) ---
isdbsame                      # expect: same
####### END DO THIS #####
```

If `isdbsame` prints `difference` after `work2`: run `isdbsame --verbose`, and fix the side that is
behind **with a new migration**, then `work1` → `work2` again.

## 6. Checklist (copy into the reply)

- [ ] `--status` was clean before starting
- [ ] New file `be/db/migrations/YYYYMMDD_NN_name.sql`, header comment, schema-qualified
- [ ] Idempotent and backward compatible with the currently deployed code
- [ ] Applied on Mac with `scripts/db-migrate.sh` (`1 applied`)
- [ ] Feature tested on Mac
- [ ] Backup / restore / copy code updated if the table is included there
- [ ] No hand-run DDL, no JS startup DDL, no edits to applied migrations
- [ ] DO THIS block given (Mac `work1` → Ubuntu `work2` → `isdbsame`)
