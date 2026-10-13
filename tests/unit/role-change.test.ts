import { describe, expect, it } from "vitest";
import { roleChangeRefusal, roomDisplayName } from "@/features/room/domain/role-change";

describe("who changes roles", () => {
  it("only the owner, and never on themselves", () => {
    const target = { target: "participant" as const, self: false };
    expect(roleChangeRefusal("promote", { actor: "owner", ...target })).toBeUndefined();
    expect(roleChangeRefusal("transfer", { actor: "owner", ...target })).toBeUndefined();
    expect(roleChangeRefusal("promote", { actor: "moderator", ...target })).toBe("not_owner");
    expect(roleChangeRefusal("transfer", { actor: "participant", ...target })).toBe("not_owner");
    expect(roleChangeRefusal("transfer", { actor: "owner", target: "owner", self: true })).toBe(
      "self",
    );
  });

  it("promoting a moderator again or demoting someone who is not one is refused", () => {
    expect(roleChangeRefusal("promote", { actor: "owner", target: "moderator", self: false })).toBe(
      "already",
    );
    expect(
      roleChangeRefusal("demote", { actor: "owner", target: "participant", self: false }),
    ).toBe("not_moderator");
    expect(
      roleChangeRefusal("demote", { actor: "owner", target: "moderator", self: false }),
    ).toBeUndefined();
    expect(
      roleChangeRefusal("transfer", { actor: "owner", target: "moderator", self: false }),
    ).toBeUndefined();
  });
});

describe("room name", () => {
  it("is the owner's name; without one there is none", () => {
    expect(roomDisplayName("Ana")).toBe("Sala de Ana");
    expect(roomDisplayName("  Bia Lima ")).toBe("Sala de Bia Lima");
    expect(roomDisplayName(null)).toBeNull();
    expect(roomDisplayName("   ")).toBeNull();
  });
});
