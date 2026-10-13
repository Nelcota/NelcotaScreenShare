CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'hate', 'sexual', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_resolution" AS ENUM('no_action', 'message_deleted', 'account_blocked');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."report_target_kind" AS ENUM('user', 'message', 'conversation');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"reporter_id" uuid,
	"target_kind" "report_target_kind" NOT NULL,
	"target_user_id" uuid,
	"target_message_id" uuid,
	"target_conversation_id" uuid,
	"message_excerpt" text,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolution" "report_resolution",
	"resolved_by_admin_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_details_check" CHECK (char_length("reports"."details") <= 500),
	CONSTRAINT "reports_excerpt_check" CHECK (char_length("reports"."message_excerpt") <= 2000),
	CONSTRAINT "reports_resolution_check" CHECK (("reports"."status" = 'open' and "reports"."resolution" is null and "reports"."resolved_at" is null)
        or ("reports"."status" = 'resolved' and "reports"."resolution" is not null and "reports"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_message_id_messages_id_fk" FOREIGN KEY ("target_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_conversation_id_conversations_id_fk" FOREIGN KEY ("target_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_admin_id_admin_users_id_fk" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_queue_idx" ON "reports" USING btree ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_target_user_idx" ON "reports" USING btree ("target_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_unique_idx" ON "reports" USING btree ("reporter_id","target_kind",coalesce("target_message_id", "target_conversation_id", "target_user_id")) WHERE "reports"."status" = 'open';