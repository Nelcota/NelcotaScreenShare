import { expect, test } from "vitest";
import { ROOM_ROLE_IN_EXPORT, TOKEN_RESULT_IN_EXPORT } from "@/features/room/domain/export-labels";
import { TOKEN_LOG_RESULTS } from "@/features/room/domain/issue-token";
import { SAVED_ROOM_ROLES } from "@/features/room/domain/room-role";

test("every entry result and saved role reads in Portuguese in the data export", () => {
  for (const result of TOKEN_LOG_RESULTS) expect(TOKEN_RESULT_IN_EXPORT[result]).toMatch(/\S/);
  for (const role of SAVED_ROOM_ROLES) expect(ROOM_ROLE_IN_EXPORT[role]).toMatch(/\S/);
  expect(TOKEN_RESULT_IN_EXPORT.granted).toBe("aceito");
  expect(ROOM_ROLE_IN_EXPORT).toEqual({ owner: "dono", moderator: "moderador" });
});
