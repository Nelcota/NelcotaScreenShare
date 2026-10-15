ALTER TYPE "public"."token_result" ADD VALUE 'banned' BEFORE 'error';--> statement-breakpoint
CREATE TABLE "room_bans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_code" text NOT NULL,
	"livekit_room_sid" text NOT NULL,
	"identity" text NOT NULL,
	"banned_by_user_id" uuid,
	"banned_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_bans_code_check" CHECK (room_code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
	CONSTRAINT "room_bans_identity_check" CHECK (length("room_bans"."identity") <= 128)
);
--> statement-breakpoint
ALTER TABLE "room_bans" ADD CONSTRAINT "room_bans_banned_by_user_id_users_id_fk" FOREIGN KEY ("banned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_bans" ADD CONSTRAINT "room_bans_banned_by_admin_id_admin_users_id_fk" FOREIGN KEY ("banned_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_bans_call_identity_key" ON "room_bans" USING btree ("room_code","identity","livekit_room_sid");