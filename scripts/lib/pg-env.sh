# Read Postgres connection vars from ~/.ssh/be/.env (or BE_ENV_FILE).
# Sourced by compare-pg-schema.sh — not executed directly.

PG_ENV_FILE="${BE_ENV_FILE:-$HOME/.ssh/be/.env}"

pg_env_require_readable() {
  if [[ ! -r "$PG_ENV_FILE" ]]; then
    echo "FAIL  cannot read env file: $PG_ENV_FILE" >&2
    return 1
  fi
}

# Last assignment wins; strip inline comments and quotes.
pg_read_env() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$PG_ENV_FILE" \
    | tail -n1 \
    | sed -e 's/[[:space:]]*#.*$//' -e 's/[[:space:]]*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}

pg_load_connection_defaults() {
  pg_env_require_readable || return 1
  PGHOST="${PGHOST:-$(pg_read_env DB_HOST)}"
  PGPORT="${PGPORT:-$(pg_read_env DB_PORT)}"
  PGDATABASE="${PGDATABASE:-$(pg_read_env DB_NAME)}"
  PGUSER="${PGUSER:-$(pg_read_env DB_USER)}"
  PGPASSWORD="${PGPASSWORD:-$(pg_read_env DB_PASSWORD)}"
  PGSCHEMA="${PGSCHEMA:-$(pg_read_env DB_SCHEMA)}"
  PGSCHEMA="${PGSCHEMA:-$(pg_read_env VSINGLES_SCHEMA)}"
  PGSCHEMA="${PGSCHEMA:-helloworldjunktest}"
  export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSCHEMA
}

pg_connection_label() {
  echo "${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE} schema=${PGSCHEMA}"
}
