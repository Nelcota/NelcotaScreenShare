CREATE INDEX "livekit_events_identity_idx" ON "livekit_events" USING btree (("payload"->'participant'->>'identity'));--> statement-breakpoint
-- New deliveries serialize with anonymization on the account row, so neither arrival order
-- nor a webhook concurrent with deletion can retain the original name.
CREATE FUNCTION public.redact_anonymized_livekit_name() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
  AS $$
DECLARE
  participant_identity text := NEW.payload->'participant'->>'identity';
  anonymized_at timestamptz;
BEGIN
  IF participant_identity IS NULL OR participant_identity !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NEW;
  END IF;
  SELECT u.anonymized_at INTO anonymized_at FROM public.users AS u
    WHERE u.id = participant_identity::uuid FOR UPDATE;
  IF anonymized_at IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.payload := NEW.payload #- '{participant,name}';
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER livekit_events_redact_name BEFORE INSERT ON public.livekit_events
  FOR EACH ROW EXECUTE FUNCTION public.redact_anonymized_livekit_name();--> statement-breakpoint
-- Only this trigger may redact event bodies. The application keeps its prohibition on UPDATE
-- of payload; IDs, lifecycle data and projection status stay intact for replay and deduplication.
CREATE FUNCTION public.redact_user_livekit_names() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog
  AS $$
BEGIN
  UPDATE public.livekit_events SET payload = payload #- '{participant,name}'
    WHERE payload->'participant'->>'identity' = NEW.id::text
      AND (payload->'participant') ? 'name';
  RETURN NULL;
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.redact_user_livekit_names() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER users_redact_livekit_names AFTER UPDATE OF anonymized_at ON public.users
  FOR EACH ROW WHEN (OLD.anonymized_at IS NULL AND NEW.anonymized_at IS NOT NULL)
  EXECUTE FUNCTION public.redact_user_livekit_names();--> statement-breakpoint
-- Repair data for accounts anonymized before this migration.
UPDATE public.livekit_events AS event SET payload = event.payload #- '{participant,name}'
  FROM public.users AS account
  WHERE account.anonymized_at IS NOT NULL
    AND event.payload->'participant'->>'identity' = account.id::text
    AND (event.payload->'participant') ? 'name';
