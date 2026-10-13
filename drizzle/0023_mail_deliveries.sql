CREATE TYPE "public"."mail_delivery_status" AS ENUM('accepted', 'failed', 'not_sent');--> statement-breakpoint
CREATE TYPE "public"."mail_provider" AS ENUM('resend', 'smtp', 'none');--> statement-breakpoint
CREATE TABLE "mail_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"subject" text NOT NULL,
	"recipient_domain" text,
	"provider" "mail_provider" NOT NULL,
	"status" "mail_delivery_status" NOT NULL,
	"reason" text,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_deliveries_subject_check" CHECK (length("mail_deliveries"."subject") <= 200),
	CONSTRAINT "mail_deliveries_domain_check" CHECK (length("mail_deliveries"."recipient_domain") <= 255),
	CONSTRAINT "mail_deliveries_reason_check" CHECK (length("mail_deliveries"."reason") <= 100),
	CONSTRAINT "mail_deliveries_message_id_check" CHECK (length("mail_deliveries"."provider_message_id") <= 200),
	CONSTRAINT "mail_deliveries_attempts_check" CHECK ("mail_deliveries"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "mail_deliveries_created_idx" ON "mail_deliveries" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);