ALTER TYPE "public"."token_result" ADD VALUE 'room_locked' BEFORE 'error';--> statement-breakpoint
ALTER TYPE "public"."token_result" ADD VALUE 'room_removed' BEFORE 'error';--> statement-breakpoint
ALTER TYPE "public"."token_result" ADD VALUE 'room_closed' BEFORE 'error';--> statement-breakpoint
CREATE TABLE "room_commands" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_identity" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_commands_kind_check" CHECK ("room_commands"."kind" in ('sync', 'remove', 'close')),
	CONSTRAINT "room_commands_status_check" CHECK ("room_commands"."status" in ('pending', 'applied', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "room_definitions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" text NOT NULL,
	"owner_user_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_definitions_code_unique" UNIQUE("code"),
	CONSTRAINT "room_definitions_code_check" CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "room_session_members" (
	"session_id" uuid NOT NULL,
	"identity" text NOT NULL,
	"user_id" uuid,
	"admitted_at" timestamp with time zone,
	"reserved_until" timestamp with time zone NOT NULL,
	"excluded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_session_members_session_id_identity_pk" PRIMARY KEY("session_id","identity"),
	CONSTRAINT "room_session_members_identity_check" CHECK (length("room_session_members"."identity") between 1 and 128)
);
--> statement-breakpoint
CREATE TABLE "room_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"definition_id" uuid NOT NULL,
	"media_room_name" text NOT NULL,
	"host_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"admission_locked" boolean DEFAULT false NOT NULL,
	"share_policy" text DEFAULT 'everyone' NOT NULL,
	"allowed_sharers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"host_missing_at" timestamp with time zone,
	"empty_since" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_sessions_media_room_name_unique" UNIQUE("media_room_name"),
	CONSTRAINT "room_sessions_status_check" CHECK ("room_sessions"."status" in ('pending', 'active', 'closed')),
	CONSTRAINT "room_sessions_policy_check" CHECK ("room_sessions"."share_policy" in ('everyone', 'host', 'selected'))
);
--> statement-breakpoint
ALTER TABLE "room_participations" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "room_commands" ADD CONSTRAINT "room_commands_session_id_room_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."room_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_definitions" ADD CONSTRAINT "room_definitions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_session_members" ADD CONSTRAINT "room_session_members_session_id_room_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."room_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_session_members" ADD CONSTRAINT "room_session_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_sessions" ADD CONSTRAINT "room_sessions_definition_id_room_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."room_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_sessions" ADD CONSTRAINT "room_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_commands_retry_idx" ON "room_commands" USING btree ("next_attempt_at") WHERE "room_commands"."status" <> 'applied';--> statement-breakpoint
CREATE INDEX "room_session_members_user_idx" ON "room_session_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_sessions_one_open_idx" ON "room_sessions" USING btree ("definition_id") WHERE "room_sessions"."status" <> 'closed';--> statement-breakpoint
CREATE INDEX "room_sessions_open_idx" ON "room_sessions" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "room_participations" ADD CONSTRAINT "room_participations_session_id_room_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."room_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER room_sessions_set_updated_at BEFORE UPDATE ON room_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER room_commands_set_updated_at BEFORE UPDATE ON room_commands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
