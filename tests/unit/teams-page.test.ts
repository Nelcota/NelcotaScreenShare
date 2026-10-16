import assert from "node:assert/strict";
import { test } from "vitest";
import { teamsPageView } from "@/features/team/domain/teams-page";

test("without Pro and without a team, the page is one message and the Pro list", () => {
  assert.equal(teamsPageView({ proActive: false, enabled: false, teamCount: 0 }), "without-pro");
  assert.equal(teamsPageView({ proActive: false, enabled: true, teamCount: 0 }), "without-pro");
});

test("without Pro, the teams someone is in stay, with no creation form", () => {
  assert.equal(teamsPageView({ proActive: false, enabled: true, teamCount: 2 }), "pro-off");
});

test("with Pro, creating waits for teams to be turned on", () => {
  assert.equal(teamsPageView({ proActive: true, enabled: false, teamCount: 0 }), "unavailable");
  assert.equal(teamsPageView({ proActive: true, enabled: true, teamCount: 1 }), "create");
});
