-- Bootstrap of the Postgres roles. Runs ONCE, as the superuser, on the app database:
--
--   psql "$SUPERUSER_URL" \
--     -v migrator_password="$(openssl rand -base64 32)" \
--     -v app_password="$(openssl rand -base64 32)" \
--     -v readonly_password="$(openssl rand -base64 32)" \
--     -f deploy/postgres/bootstrap.sql
--
-- It is idempotent: running it again only updates the passwords and the grants.
--
-- Roles:
--   nelcota_migrator  schema owner; only the migration job uses it (secret in GitHub Actions)
--   nelcota_app       the app: reads and writes data, no DDL
--   nelcota_readonly  diagnostics and restore testing: read-only
\set ON_ERROR_STOP on

SELECT format('CREATE ROLE %I LOGIN', r)
FROM unnest(ARRAY['nelcota_migrator', 'nelcota_app', 'nelcota_readonly']) AS r
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
\gexec

ALTER ROLE nelcota_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'migrator_password';
ALTER ROLE nelcota_app      WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
ALTER ROLE nelcota_readonly WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'readonly_password';

-- A stuck query or a forgotten transaction does not hold the app's connections or locks.
ALTER ROLE nelcota_app SET statement_timeout = '15s';
ALTER ROLE nelcota_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE nelcota_app SET lock_timeout = '5s';
ALTER ROLE nelcota_readonly SET statement_timeout = '60s';
ALTER ROLE nelcota_readonly SET default_transaction_read_only = on;

-- Database: nobody but these three creates objects or connects by default.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO nelcota_migrator, nelcota_app', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO nelcota_readonly', current_database()) \gexec
-- Extensions (pg_trgm, unaccent, pg_stat_statements) are created by the migrator.
SELECT format('GRANT CREATE ON DATABASE %I TO nelcota_migrator', current_database()) \gexec

-- Schema: the migrator owns it; the app only uses it.
ALTER SCHEMA public OWNER TO nelcota_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nelcota_app, nelcota_readonly;

-- Tables created by the migrator (now and in the future) are accessible to the app.
-- Insert-only tables (audit etc.) revoke UPDATE/DELETE in their own migration.
ALTER DEFAULT PRIVILEGES FOR ROLE nelcota_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nelcota_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nelcota_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nelcota_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nelcota_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nelcota_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nelcota_migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO nelcota_readonly;

-- Objects that already existed before the bootstrap are handed over to the migrator.
SELECT format('ALTER TABLE %I.%I OWNER TO nelcota_migrator', schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public'
\gexec
SELECT format('ALTER SCHEMA %I OWNER TO nelcota_migrator', nspname)
FROM pg_namespace WHERE nspname = 'drizzle'
\gexec
SELECT format('ALTER TABLE drizzle.%I OWNER TO nelcota_migrator', tablename)
FROM pg_tables WHERE schemaname = 'drizzle'
\gexec
SELECT format('ALTER SEQUENCE drizzle.%I OWNER TO nelcota_migrator', sequencename)
FROM pg_sequences WHERE schemaname = 'drizzle'
\gexec
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nelcota_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nelcota_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nelcota_readonly;
-- On a rerun, the GRANT above would give UPDATE/DELETE back on the insert-only
-- tables: redo the REVOKEs of migrations 0003 and 0004 (if the tables already exist).
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM nelcota_app;
  END IF;
  -- Retention (0025): the app deletes expired audit rows only through this function.
  IF to_regprocedure('public.purge_expired_audit_logs()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION purge_expired_audit_logs() TO nelcota_app;
  END IF;
  IF to_regclass('public.token_requests') IS NOT NULL THEN
    REVOKE UPDATE, TRUNCATE ON token_requests FROM nelcota_app;
  END IF;
  IF to_regclass('public.livekit_events') IS NOT NULL THEN
    REVOKE UPDATE, TRUNCATE ON livekit_events FROM nelcota_app;
    GRANT UPDATE (processed_at, error) ON livekit_events TO nelcota_app;
  END IF;
END $$;
-- pg_stat_statements is not a "trusted" extension: only the superuser can create it.
-- (Requires shared_preload_libraries = 'pg_stat_statements' in postgresql.conf.)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- "Saúde do banco" (database health) screen (read-only) and diagnostics.
GRANT pg_read_all_stats TO nelcota_readonly;
