import { expect, it } from "vitest";
import { CREATE_ROOM_RETURN, createRoomEntryHref } from "@/features/home/domain/new-room";
import { safeReturnPath } from "@/features/auth/domain/return-path";

it("a visitor signs up and an expired session signs in, both coming back to create the room", () => {
  expect(createRoomEntryHref(false)).toBe("/cadastro?voltar=%2F%3Fcriar%3Dsala");
  expect(createRoomEntryHref(true)).toBe("/entrar?voltar=%2F%3Fcriar%3Dsala");
  expect(safeReturnPath(CREATE_ROOM_RETURN)).toBe(CREATE_ROOM_RETURN);
});
