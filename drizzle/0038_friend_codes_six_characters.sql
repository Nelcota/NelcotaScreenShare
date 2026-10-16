ALTER TABLE "friend_codes" DROP CONSTRAINT "friend_codes_code_check";--> statement-breakpoint
ALTER TABLE "retired_friend_codes" DROP CONSTRAINT "retired_friend_codes_code_check";--> statement-breakpoint
ALTER TABLE "friend_codes" ADD CONSTRAINT "friend_codes_code_check" CHECK ("friend_codes"."code" ~ '^[2-9A-HJKMNP-Z]{4,7}$');--> statement-breakpoint
ALTER TABLE "retired_friend_codes" ADD CONSTRAINT "retired_friend_codes_code_check" CHECK ("retired_friend_codes"."code" ~ '^[2-9A-HJKMNP-Z]{4,7}$');