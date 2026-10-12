CREATE TABLE "annotation_epochs" (
	"session_id" uuid NOT NULL,
	"track_sid" text NOT NULL,
	"epoch" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"fingerprint" text NOT NULL,
	CONSTRAINT "annotation_epochs_session_id_track_sid_pk" PRIMARY KEY("session_id","track_sid")
);
--> statement-breakpoint
ALTER TABLE "annotation_epochs" ADD CONSTRAINT "annotation_epochs_session_id_room_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."room_sessions"("id") ON DELETE cascade ON UPDATE no action;