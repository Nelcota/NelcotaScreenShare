CREATE TYPE "public"."attachment_kind" AS ENUM('image', 'pdf', 'text', 'audio', 'video', 'zip');--> statement-breakpoint
CREATE TYPE "public"."attachment_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conversation_id" uuid,
	"message_id" uuid,
	"uploader_id" uuid,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"status" "attachment_status" DEFAULT 'pending' NOT NULL,
	"kind" "attachment_kind",
	"size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "message_attachments_file_name_check" CHECK (char_length("message_attachments"."file_name") between 1 and 200),
	CONSTRAINT "message_attachments_ready_check" CHECK ("message_attachments"."status" = 'pending' or ("message_attachments"."kind" is not null and "message_attachments"."size_bytes" is not null))
);
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_content_check";--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_attachments_object_key_idx" ON "message_attachments" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_attachments_uploader_idx" ON "message_attachments" USING btree ("uploader_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_check" CHECK ("messages"."body" is null or "messages"."gif_slug" is null);