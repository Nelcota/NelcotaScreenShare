CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
ALTER TYPE "public"."token_result" ADD VALUE 'awaiting_approval' BEFORE 'error';--> statement-breakpoint
CREATE TABLE "room_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_code" text NOT NULL,
	"user_id" uuid,
	"guest_id" uuid,
	"display_name" text NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	CONSTRAINT "room_join_requests_requester_check" CHECK (num_nonnulls("room_join_requests"."user_id", "room_join_requests"."guest_id") = 1),
	CONSTRAINT "room_join_requests_name_check" CHECK (length("room_join_requests"."display_name") between 1 and 64)
);
--> statement-breakpoint
ALTER TABLE "room_join_requests" ADD CONSTRAINT "room_join_requests_room_code_room_codes_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room_codes"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_join_requests" ADD CONSTRAINT "room_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_join_requests" ADD CONSTRAINT "room_join_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_join_requests_pending_key" ON "room_join_requests" USING btree ("room_code",coalesce("user_id", "guest_id")) WHERE "room_join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "room_join_requests_room_idx" ON "room_join_requests" USING btree ("room_code","created_at" DESC NULLS LAST);