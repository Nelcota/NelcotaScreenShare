import { describe, expect, test } from "vitest";
import { withAdminLink } from "@/features/admin/participants/domain/admin-link";

describe("panel link list", () => {
  test("turning on adds the account once", () => {
    expect(withAdminLink([], "a", true)).toEqual(["a"]);
    expect(withAdminLink(["a"], "a", true)).toEqual(["a"]);
    expect(withAdminLink(["a"], "b", true)).toEqual(["a", "b"]);
  });

  test("turning off removes only that account", () => {
    expect(withAdminLink(["a", "b"], "a", false)).toEqual(["b"]);
    expect(withAdminLink(["b"], "a", false)).toEqual(["b"]);
  });

  test("never changes the list it was given", () => {
    const before = Object.freeze(["a"]);
    expect(withAdminLink(before, "b", true)).not.toBe(before);
    expect(before).toEqual(["a"]);
  });
});
