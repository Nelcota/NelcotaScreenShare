CREATE TYPE "public"."room_access" AS ENUM('open', 'approval');--> statement-breakpoint
CREATE TABLE "room_settings" (
	"room_code" text PRIMARY KEY NOT NULL,
	"access" "room_access" DEFAULT 'open' NOT NULL,
	"updated_by_user_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_room_code_room_codes_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room_codes"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- ===== Handwritten: keep updated_at current, as in the other tables =====
CREATE TRIGGER room_settings_set_updated_at BEFORE UPDATE ON room_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
