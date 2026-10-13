CREATE TABLE "app_errors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"request_id" text,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_errors_request_id_check" CHECK (length("app_errors"."request_id") <= 100),
	CONSTRAINT "app_errors_method_check" CHECK (length("app_errors"."method") <= 10),
	CONSTRAINT "app_errors_path_check" CHECK (length("app_errors"."path") <= 200),
	CONSTRAINT "app_errors_name_check" CHECK (length("app_errors"."name") <= 100),
	CONSTRAINT "app_errors_message_check" CHECK (length("app_errors"."message") <= 200)
);
--> statement-breakpoint
CREATE INDEX "app_errors_created_idx" ON "app_errors" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);