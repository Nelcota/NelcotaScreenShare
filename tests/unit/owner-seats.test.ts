import { describe, expect, test } from "vitest";
import { decideOwnerCommand, MAX_OWNERS } from "@/features/auth/domain/owner-seats";

describe("create-owner", () => {
  test("invites a new owner while a seat is free", () => {
    expect(decideOwnerCommand({ roleOfEmail: null, seatsTaken: 0, force: false })).toEqual({
      kind: "invite",
    });
    expect(
      decideOwnerCommand({ roleOfEmail: null, seatsTaken: MAX_OWNERS - 1, force: false }),
    ).toEqual({ kind: "invite" });
  });

  test("refuses a fourth owner, with or without --force", () => {
    for (const force of [false, true]) {
      const command = decideOwnerCommand({ roleOfEmail: null, seatsTaken: MAX_OWNERS, force });
      expect(command.kind).toBe("refuse");
    }
  });

  test("--force recovers an existing owner, even with every seat taken", () => {
    expect(
      decideOwnerCommand({ roleOfEmail: "owner", seatsTaken: MAX_OWNERS, force: true }),
    ).toEqual({ kind: "recover" });
    expect(decideOwnerCommand({ roleOfEmail: "owner", seatsTaken: 1, force: false }).kind).toBe(
      "refuse",
    );
  });

  test("never promotes an admin or a reader to owner", () => {
    for (const role of ["admin", "viewer"] as const) {
      for (const force of [false, true]) {
        expect(decideOwnerCommand({ roleOfEmail: role, seatsTaken: 0, force }).kind).toBe("refuse");
      }
    }
  });
});
