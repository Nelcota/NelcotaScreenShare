import { expect, test } from "vitest";
import { pickFocusedShare, sortByOrder, trackShareOrder } from "@/features/room/domain/focus";

const share = (trackSid: string, isLocal = false) => ({
  publication: { trackSid },
  participant: { isLocal },
});

test("manual screen selection survives updates and falls back when that screen stops", () => {
  const first = share("first");
  const second = share("second");
  expect(pickFocusedShare([first, second], "first")).toBe(first);
  expect(pickFocusedShare([second], "first")).toBe(second);
  expect(pickFocusedShare([], "first")).toBeUndefined();
});

test("screen appearance order survives participant order changes without mutating inputs", () => {
  const previous = ["first", "removed", "second"];
  const shares = [share("second"), share("new"), share("first")];
  const next = trackShareOrder(previous, shares);
  expect(next).toEqual({ order: ["first", "second", "new"], takesStage: true });
  expect(sortByOrder(shares, next.order).map((item) => item.publication.trackSid)).toEqual([
    "first",
    "second",
    "new",
  ]);
  expect(previous).toEqual(["first", "removed", "second"]);
  expect(shares[0]?.publication.trackSid).toBe("second");
});

test("your own new screen does not replace someone else's presentation", () => {
  const remote = share("remote");
  const local = share("local", true);
  expect(trackShareOrder(["remote"], [remote, local]).takesStage).toBe(false);
  expect(pickFocusedShare([remote, local], undefined)).toBe(remote);
  expect(pickFocusedShare([local], undefined)).toBe(local);
  expect(pickFocusedShare([remote, local], "local")).toBe(local);
});
