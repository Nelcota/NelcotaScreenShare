-- ===== Handwritten: room_definitions becomes the only room registry =====
-- Every "Criar sala" code moves over as an ad hoc room. The owner is the room_roles owner,
-- else the recorded creator. A code the host controls already registered keeps its row and
-- only takes the owner from room_roles. "Sala de <dono>" stays derived from the owner.
INSERT INTO room_definitions (code, owner_user_id, kind, created_at)
SELECT
  rc.code,
  coalesce(
    (SELECT rr.user_id FROM room_roles rr WHERE rr.room_code = rc.code AND rr.role = 'owner'),
    rc.created_by_user_id
  ),
  'ad_hoc',
  rc.created_at
FROM room_codes rc
ON CONFLICT (code) DO UPDATE
  SET owner_user_id = coalesce(excluded.owner_user_id, room_definitions.owner_user_id)
  WHERE room_definitions.kind = 'ad_hoc';--> statement-breakpoint
ALTER TABLE "room_join_requests" DROP CONSTRAINT "room_join_requests_room_code_room_codes_code_fk";
--> statement-breakpoint
ALTER TABLE "room_settings" DROP CONSTRAINT "room_settings_room_code_room_codes_code_fk";
--> statement-breakpoint
ALTER TABLE "room_roles" DROP CONSTRAINT "room_roles_room_code_room_codes_code_fk";
--> statement-breakpoint
ALTER TABLE "room_codes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "room_codes";--> statement-breakpoint
ALTER TABLE "room_join_requests" ADD CONSTRAINT "room_join_requests_room_code_room_definitions_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room_definitions"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_settings" ADD CONSTRAINT "room_settings_room_code_room_definitions_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room_definitions"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_roles" ADD CONSTRAINT "room_roles_room_code_room_definitions_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."room_definitions"("code") ON DELETE cascade ON UPDATE no action;
