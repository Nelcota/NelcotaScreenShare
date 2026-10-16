CREATE TYPE "public"."conversation_kind" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"name" text,
	"direct_low_id" uuid,
	"direct_high_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone,
	CONSTRAINT "conversations_kind_check" CHECK (("conversations"."kind" = 'direct' and "conversations"."direct_low_id" is not null and "conversations"."direct_high_id" is not null and "conversations"."direct_low_id" < "conversations"."direct_high_id" and "conversations"."name" is null)
        or ("conversations"."kind" = 'group' and "conversations"."direct_low_id" is null and "conversations"."direct_high_id" is null)),
	CONSTRAINT "conversations_name_check" CHECK ("conversations"."name" is null or char_length("conversations"."name") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "gif_favorites" (
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gif_favorites_user_id_slug_pk" PRIMARY KEY("user_id","slug"),
	CONSTRAINT "gif_favorites_slug_check" CHECK (char_length("gif_favorites"."slug") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text,
	"gif_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_content_check" CHECK (("messages"."body" is null) <> ("messages"."gif_slug" is null)),
	CONSTRAINT "messages_body_check" CHECK ("messages"."body" is null or char_length("messages"."body") between 1 and 2000),
	CONSTRAINT "messages_gif_slug_check" CHECK ("messages"."gif_slug" is null or char_length("messages"."gif_slug") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_low_id_users_id_fk" FOREIGN KEY ("direct_low_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_high_id_users_id_fk" FOREIGN KEY ("direct_high_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gif_favorites" ADD CONSTRAINT "gif_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_direct_pair_idx" ON "conversations" USING btree ("direct_low_id","direct_high_id") WHERE "conversations"."kind" = 'direct';--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","id");--> statement-breakpoint
CREATE INDEX "messages_author_idx" ON "messages" USING btree ("author_id");