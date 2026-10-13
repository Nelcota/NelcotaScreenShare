CREATE TABLE "friend_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"share_room" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friend_preferences" ADD CONSTRAINT "friend_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ===== Handwritten: keep updated_at current, as in the other tables =====
CREATE TRIGGER friend_preferences_set_updated_at BEFORE UPDATE ON friend_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
