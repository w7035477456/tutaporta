# CLAUDE.md

## Database schema changes (required)

Any Postgres schema change (DDL, constraints, indexes, grants, required backfills) must follow
**`docs/SchemaMigrations/SCHEMA_MIGRATION_PROCESS.md`** step by step:

- new file `be/db/migrations/YYYYMMDD_NN_shortName.sql` — never hand-run DDL, never edit an applied migration;
- apply on the Mac with `scripts/db-migrate.sh`; Ubuntu gets it only via `work2`;
- end the reply with that doc's DO THIS block (`work1` → `work2` → `isdbsame`).

Other project rules: `.cursor/rules/*.mdc` (always apply here too).
