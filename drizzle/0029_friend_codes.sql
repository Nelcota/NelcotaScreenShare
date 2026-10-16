CREATE TABLE "friend_codes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "friend_codes_code_check" CHECK ("friend_codes"."code" ~ '^[2-9A-HJKMNP-Z]{4,5}$')
);
--> statement-breakpoint
ALTER TABLE "friend_codes" ADD CONSTRAINT "friend_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;