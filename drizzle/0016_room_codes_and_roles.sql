CREATE TYPE "public"."room_role" AS ENUM('owner', 'moderator');--> statement-breakpoint
ALTER TYPE "public"."token_result" ADD VALUE 'room_not_found' BEFORE 'error';--> statement-breakpoint
CREATE TABLE "room_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_codes_code_check" CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "room_roles" (
	"room_code" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "room_role" NOT NULL,
	"granted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_roles_room_code_user_id_pk" PRIMARY KEY("room_code","user_id")
);
--> statement-breakpoint
ALTER TABLE "room_codes" ADD CONSTRAINT "room_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_roles" ADD CONSTRAINT "room_roles_room_code_room_codes_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room_codes"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_roles" ADD CONSTRAINT "room_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_roles" ADD CONSTRAINT "room_roles_granted_by_user_id_users_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_roles_owner_key" ON "room_roles" USING btree ("room_code") WHERE "room_roles"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "room_roles_user_idx" ON "room_roles" USING btree ("user_id");--> statement-breakpoint
-- ===== Handwritten: every room used so far keeps working =====
-- A code is known if the webhook projected it or someone got a token for it. The owner is
-- the recorded creator, else the first account that got a token. Rooms with neither keep
-- working without an owner.
INSERT INTO room_codes (code, created_by_user_id, created_at)
SELECT
  known.code,
  coalesce(
    (SELECT r.created_by_user_id FROM rooms r
      WHERE r.code = known.code AND r.created_by_user_id IS NOT NULL
      ORDER BY r.deleted_at IS NOT NULL, r.started_at LIMIT 1),
    (SELECT t.user_id FROM token_requests t
      WHERE t.room_code = known.code AND t.result = 'granted' AND t.user_id IS NOT NULL
      ORDER BY t.created_at LIMIT 1)
  ),
  known.first_seen
FROM (
  SELECT code, min(first_seen) AS first_seen FROM (
    SELECT code, started_at AS first_seen FROM rooms
    UNION ALL
    SELECT room_code, created_at FROM token_requests
    WHERE result = 'granted' AND room_code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
  ) used
  GROUP BY code
) known
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO room_roles (room_code, user_id, role)
SELECT code, created_by_user_id, 'owner' FROM room_codes
WHERE created_by_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
