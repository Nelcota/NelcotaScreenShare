-- ===== Handwritten: 5-year retention of the audit log =====
-- The app role keeps no DELETE on audit_logs (0003). Maintenance deletes the expired rows
-- through this function, which runs as its owner (the migrator, owner of the table). The
-- audit_logs_guard trigger still refuses any row younger than 5 years.
CREATE OR REPLACE FUNCTION purge_expired_audit_logs() RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '5 years';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION purge_expired_audit_logs() FROM PUBLIC;--> statement-breakpoint
-- The bootstrap may not have run yet (e.g. tests); it grants the same on a rerun.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nelcota_app') THEN
    GRANT EXECUTE ON FUNCTION purge_expired_audit_logs() TO nelcota_app;
  END IF;
END $$;
