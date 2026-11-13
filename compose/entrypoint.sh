#!/bin/sh
set -e

if [ "${SKIP_MIGRATIONS}" = "true" ]; then
  echo "SKIP_MIGRATIONS=true — skipping Prisma migrations"
else
  echo "Running Prisma migrations..."

  # STEP A: Ensure PostgreSQL roles exist.
  # Use the postgres superuser (available via PGINIT) because
  # chatpilot_migrator may not exist yet on a fresh DB.
  PG_PASS="${POSTGRES_PASSWORD:-postgres}"
  psql "postgresql://postgres:${PG_PASS}@postgres:5432/chatpilot?sslmode=disable" \
    --no-password <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_migrator') THEN
    CREATE ROLE chatpilot_migrator WITH LOGIN PASSWORD 'migrator_secret_pass';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_app') THEN
    CREATE ROLE chatpilot_app WITH LOGIN PASSWORD 'app_secret_pass' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_analytics') THEN
    CREATE ROLE chatpilot_analytics WITH LOGIN PASSWORD 'analytics_secret_pass' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO chatpilot_app, chatpilot_analytics;
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatpilot_app;
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO chatpilot_app;
SQL

  # STEP B: Detect whether _prisma_migrations tracking table exists.
  # Absence means the DB was created by pg_restore / manual setup with no
  # migration history — bootstrap from schema + mark existing SQL migrations.
  HAS_PRISMA_SCHEMA_TABLE=$(psql "$DATABASE_URL_MIGRATOR" --tuples-only --no-align \
    -c "SELECT COUNT(*) FROM pg_tables WHERE tablename = '_prisma_migrations';" 2>/dev/null || echo "0")

  if [ "$HAS_PRISMA_SCHEMA_TABLE" = "0" ]; then
    echo "No _prisma_migrations table found — bootstrapping from schema."

    # 1. Sync table structure from Prisma schema (idempotent on empty or existing DB)
    echo "  → Running prisma db push to align schema..."
    pnpm exec prisma db push --schema=prisma/schema.prisma --skip-generate

    # 2. Run the five hand-written SQL migration files in order.
    #    Each uses IF NOT EXISTS / CREATE OR REPLACE so repeated runs are safe.
    MIGRATIONS_DIR="/app/prisma/migrations"
    for f in "$MIGRATIONS_DIR"/0*.sql; do
      [ -f "$f" ] || continue
      echo "  → Applying $(basename "$f")..."
      psql "$DATABASE_URL_MIGRATOR" -f "$f"
    done

    # 3. Mark every SQL migration as applied so future migrate-deploy calls are no-ops.
    for ver in 000_init_schema 001_guc_helpers 002_preauth_lookups 003_rls_policies 004_pgvector_hnsw 005_bootstrap_seeder; do
      pnpm exec prisma migrate resolve --applied "$ver" --schema=prisma/schema.prisma
    done

    echo "Migration bootstrap complete."
  else
    echo "  → _prisma_migrations exists — running standard migrate deploy..."
    pnpm exec prisma migrate deploy --schema=prisma/schema.prisma
  fi
fi

exec "$@"
