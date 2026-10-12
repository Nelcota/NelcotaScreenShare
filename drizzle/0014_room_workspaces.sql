CREATE TABLE "pro_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"active" boolean DEFAULT false NOT NULL,
	"room_limit" integer DEFAULT 3 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pro_entitlements_subject_check" CHECK (("pro_entitlements"."user_id" is not null) <> ("pro_entitlements"."team_id" is not null)),
	CONSTRAINT "pro_entitlements_limit_check" CHECK ("pro_entitlements"."room_limit" between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "room_favorites" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_favorites_user_id_room_id_pk" PRIMARY KEY("user_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "team_invitations_role_check" CHECK ("team_invitations"."role" in ('manager', 'member')),
	CONSTRAINT "team_invitations_email_check" CHECK (length("team_invitations"."email") <= 254)
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_members_role_check" CHECK ("team_members"."role" in ('owner', 'manager', 'member'))
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_check" CHECK (length("teams"."name") between 2 and 80)
);
--> statement-breakpoint
ALTER TABLE "room_definitions" ADD COLUMN "kind" text DEFAULT 'ad_hoc' NOT NULL;--> statement-breakpoint
ALTER TABLE "room_definitions" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "room_definitions" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "room_definitions" ADD COLUMN "allow_guests" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "room_definitions" ADD COLUMN "member_can_host" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "room_definitions" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "room_sessions" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "room_sessions" ADD COLUMN "participant_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pro_entitlements" ADD CONSTRAINT "pro_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_entitlements" ADD CONSTRAINT "pro_entitlements_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_favorites" ADD CONSTRAINT "room_favorites_room_id_room_definitions_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_favorites" ADD CONSTRAINT "room_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pro_entitlements_user_key" ON "pro_entitlements" USING btree ("user_id") WHERE "pro_entitlements"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pro_entitlements_team_key" ON "pro_entitlements" USING btree ("team_id") WHERE "pro_entitlements"."team_id" is not null;--> statement-breakpoint
CREATE INDEX "team_invitations_team_idx" ON "team_invitations" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "team_invitations_expiry_idx" ON "team_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_owner_key" ON "team_members" USING btree ("team_id") WHERE "team_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id","team_id");--> statement-breakpoint
ALTER TABLE "room_definitions" ADD CONSTRAINT "room_definitions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_definitions_owner_idx" ON "room_definitions" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "room_definitions_team_idx" ON "room_definitions" USING btree ("team_id","created_at");--> statement-breakpoint
ALTER TABLE "room_definitions" ADD CONSTRAINT "room_definitions_kind_check" CHECK ("room_definitions"."kind" in ('ad_hoc', 'personal', 'team'));--> statement-breakpoint
ALTER TABLE "room_definitions" ADD CONSTRAINT "room_definitions_name_check" CHECK ("room_definitions"."name" is null or length("room_definitions"."name") between 2 and 80);--> statement-breakpoint
ALTER TABLE "room_definitions" ADD CONSTRAINT "room_definitions_team_check" CHECK (("room_definitions"."kind" = 'team') = ("room_definitions"."team_id" is not null));
--> statement-breakpoint
CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER pro_entitlements_set_updated_at BEFORE UPDATE ON pro_entitlements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
UPDATE room_sessions AS s SET participant_count = (
  SELECT count(*) FROM room_session_members AS m WHERE m.session_id = s.id AND m.admitted_at IS NOT NULL
), started_at = (
  SELECT min(m.admitted_at) FROM room_session_members AS m WHERE m.session_id = s.id
);
--> statement-breakpoint
CREATE FUNCTION require_active_team_owner(target uuid) RETURNS void AS $$
BEGIN
  PERFORM id FROM teams WHERE id = target FOR UPDATE;
  IF EXISTS (SELECT 1 FROM teams WHERE id = target AND deleted_at IS NULL)
    AND (SELECT count(*) FROM team_members WHERE team_id = target AND role = 'owner') <> 1 THEN
    RAISE EXCEPTION 'An active team must have exactly one owner' USING ERRCODE = '23514';
  END IF;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE FUNCTION check_active_team_owner() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'teams' THEN
    PERFORM require_active_team_owner(NEW.id);
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    PERFORM require_active_team_owner(OLD.team_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM require_active_team_owner(NEW.team_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER teams_require_owner AFTER INSERT OR UPDATE ON teams
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_team_owner();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER team_members_require_owner AFTER INSERT OR UPDATE OR DELETE ON team_members
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_active_team_owner();
