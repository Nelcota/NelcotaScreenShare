import { beforeEach, expect, test, vi } from "vitest";

const friendRelation = vi.fn();
vi.mock("@/features/friends/actions", () => ({ friendRelation }));

const { knownFriendRelation, loadFriendRelation } =
  await import("@/features/friends/client/friend-relation-cache");

beforeEach(() => friendRelation.mockReset());

/** The card's "Amigo" line came in late: the hover starts the request, the click reuses it. */
test("a hover and the click share one request, and the answer is kept for the card", async () => {
  friendRelation.mockResolvedValue({ data: { relation: "friends" } });
  const [hover, click] = await Promise.all([loadFriendRelation("bia"), loadFriendRelation("bia")]);
  expect(friendRelation).toHaveBeenCalledTimes(1);
  expect(hover).toBe("friends");
  expect(click).toBe("friends");
  expect(knownFriendRelation("bia")).toBe("friends");
});

test("nothing is kept when the server does not answer", async () => {
  friendRelation.mockResolvedValue({ serverError: "x" });
  expect(await loadFriendRelation("caio")).toBeNull();
  expect(knownFriendRelation("caio")).toBeNull();
});
