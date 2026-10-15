-- ===== Handwritten: count participations once per statement =====
-- The row trigger updated the same account once per inserted or deleted row. In one
-- transaction each update leaves another version of that row behind, so bulk inserts
-- and cascades slowed down quadratically (5,000 rows of one account: ~10 s → ~0.4 s).
-- Changing user_id stays a row trigger: transition tables cannot follow UPDATE OF a column.
CREATE FUNCTION users_count_inserted_participations() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  UPDATE users SET participations_count = participations_count + added.total
  FROM (SELECT user_id, count(*)::int AS total FROM inserted_participations
        WHERE user_id IS NOT NULL GROUP BY user_id) AS added
  WHERE users.id = added.user_id;
  RETURN NULL;
END $$;--> statement-breakpoint
CREATE FUNCTION users_count_deleted_participations() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  UPDATE users SET participations_count = participations_count - removed.total
  FROM (SELECT user_id, count(*)::int AS total FROM deleted_participations
        WHERE user_id IS NOT NULL GROUP BY user_id) AS removed
  WHERE users.id = removed.user_id;
  RETURN NULL;
END $$;--> statement-breakpoint
DROP TRIGGER room_participations_count_insert_delete ON room_participations;--> statement-breakpoint
CREATE TRIGGER room_participations_count_insert
  AFTER INSERT ON room_participations
  REFERENCING NEW TABLE AS inserted_participations
  FOR EACH STATEMENT EXECUTE FUNCTION users_count_inserted_participations();--> statement-breakpoint
CREATE TRIGGER room_participations_count_delete
  AFTER DELETE ON room_participations
  REFERENCING OLD TABLE AS deleted_participations
  FOR EACH STATEMENT EXECUTE FUNCTION users_count_deleted_participations();
