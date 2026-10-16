CREATE TABLE "retired_friend_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"retired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retired_friend_codes_code_check" CHECK ("retired_friend_codes"."code" ~ '^[2-9A-HJKMNP-Z]{4,5}$')
);
