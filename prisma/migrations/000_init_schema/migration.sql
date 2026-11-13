-- 000_init_roles.sql
-- Initialize database roles with least-privilege separation (D-3, D-5)

DO $$
BEGIN
  -- 1. chatpilot_migrator: Table owner, DDL executor, migration runner (separate DSN)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_migrator') THEN
    CREATE ROLE chatpilot_migrator WITH LOGIN PASSWORD 'migrator_secret_pass';
  END IF;

  -- 2. chatpilot_app: Runtime role used by Prisma (NO BYPASSRLS, NOT SUPERUSER, NOT TABLE OWNER)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_app') THEN
    CREATE ROLE chatpilot_app WITH LOGIN PASSWORD 'app_secret_pass' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  -- 3. chatpilot_analytics: Restricted role for aggregate source views and daily rollups only
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'chatpilot_analytics') THEN
    CREATE ROLE chatpilot_analytics WITH LOGIN PASSWORD 'analytics_secret_pass' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO chatpilot_app, chatpilot_analytics;

-- Default grants for tables owned by chatpilot_migrator to chatpilot_app
ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO chatpilot_app;

ALTER DEFAULT PRIVILEGES FOR ROLE chatpilot_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO chatpilot_app;
