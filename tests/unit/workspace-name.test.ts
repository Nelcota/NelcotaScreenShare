import assert from "node:assert/strict";
import { test } from "vitest";
import { workspaceNameSchema } from "@/features/rooms/domain/commands";
import { teamCommandSchema } from "@/features/team/domain/commands";

test("a room or team name with a blocked term is refused with a plain message", () => {
  const refused = workspaceNameSchema.safeParse("Sala do H1tler");
  assert.equal(refused.success, false);
  assert.equal(refused.error?.issues[0]?.message, "Esse texto não pode ser usado.");
});

test("a normal room or team name passes", () => {
  assert.equal(workspaceNameSchema.safeParse("Time Preto e Branco").success, true);
});

test("creating or renaming a team checks the same list", () => {
  assert.equal(teamCommandSchema.safeParse({ kind: "create", name: "porn club" }).success, false);
});
