import { expect, test } from "vitest";
import {
  otherTabCallMessage,
  roomCodeFromPath,
  roomSwitchMessage,
  shouldConfirmRoomSwitch,
} from "@/features/room/domain/room-switch";

test("reads the room code from a room path, normalized like the room page", () => {
  expect(roomCodeFromPath("/sala/abc-defg-hij")).toBe("abc-defg-hij");
  expect(roomCodeFromPath("/sala/ABC-DEFG-HIJ/")).toBe("abc-defg-hij");
  expect(roomCodeFromPath("/sala/abc%2Ddefg-hij")).toBe("abc-defg-hij");
});

test("other pages and invalid codes are not rooms", () => {
  expect(roomCodeFromPath("/")).toBeUndefined();
  expect(roomCodeFromPath("/sala")).toBeUndefined();
  expect(roomCodeFromPath("/sala/")).toBeUndefined();
  expect(roomCodeFromPath("/admin/salas/abc-defg-hij")).toBeUndefined();
  expect(roomCodeFromPath("/sala/abc-defg-hij/extra")).toBeUndefined();
  expect(roomCodeFromPath("/sala/!!")).toBeUndefined();
  expect(roomCodeFromPath("/sala/%E0")).toBeUndefined();
});

test("only another room asks before dropping the call", () => {
  expect(shouldConfirmRoomSwitch("abc-defg-hij", "/sala/xyz-wvut-srq")).toBe(true);
  expect(shouldConfirmRoomSwitch("abc-defg-hij", "/sala/ABC-DEFG-HIJ")).toBe(false);
  expect(shouldConfirmRoomSwitch("abc-defg-hij", "/sala/abc-defg-hij")).toBe(false);
  expect(shouldConfirmRoomSwitch("abc-defg-hij", "/conta")).toBe(false);
  expect(shouldConfirmRoomSwitch("abc-defg-hij", "/")).toBe(false);
  expect(shouldConfirmRoomSwitch("abc-defg-hij", "/sala/!!")).toBe(false);
});

test("without a call nothing is held", () => {
  expect(shouldConfirmRoomSwitch(undefined, "/sala/xyz-wvut-srq")).toBe(false);
});

test("the confirmation names both rooms, except in streamer mode", () => {
  expect(roomSwitchMessage("abc-defg-hij", "xyz-wvut-srq", { hideCodes: false })).toBe(
    "Você vai sair da sala abc-defg-hij e entrar na sala xyz-wvut-srq.",
  );
  expect(roomSwitchMessage("abc-defg-hij", "xyz-wvut-srq", { hideCodes: true })).toBe(
    "Você vai sair da sala atual e entrar em outra.",
  );
  expect(roomSwitchMessage("abc-defg-hij", undefined, { hideCodes: false })).toBe(
    "Você vai sair da sala atual e entrar em outra.",
  );
});

test("the other-tab confirmation names the room, except in streamer mode", () => {
  expect(otherTabCallMessage("abc-defg-hij", { hideCodes: false })).toBe(
    "Você já está na sala abc-defg-hij em outra aba. Ao entrar aqui, você sai de lá.",
  );
  expect(otherTabCallMessage("abc-defg-hij", { hideCodes: true })).toBe(
    "Você já está em uma sala em outra aba. Ao entrar aqui, você sai de lá.",
  );
});
