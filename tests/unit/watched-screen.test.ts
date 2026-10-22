import { expect, test } from "vitest";
import { watchedRemoteScreen } from "@/features/room/domain/watched-screen";

const own = { participant: { isLocal: true }, publication: { trackSid: "TR_own" } };
const ana = { participant: { isLocal: false }, publication: { trackSid: "TR_ana" } };

test("the screen on the stage is the one to stop watching", () => {
  expect(watchedRemoteScreen(ana, [own, ana])).toBe("TR_ana");
});

test("with your own screen on the stage, another person's you watch is still offered", () => {
  expect(watchedRemoteScreen(own, [own, ana])).toBe("TR_ana");
});

test("nothing to stop when you only see your own screen", () => {
  expect(watchedRemoteScreen(own, [own])).toBeUndefined();
  expect(watchedRemoteScreen(undefined, [])).toBeUndefined();
});
