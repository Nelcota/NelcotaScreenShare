CREATE TYPE "public"."message_kind" AS ENUM('message', 'missed_call');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "kind" "message_kind" DEFAULT 'message' NOT NULL;