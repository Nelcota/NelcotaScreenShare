import { expect, test } from "vitest";
import {
  parseSavedDevice,
  resolveSavedDevice,
  serializeSavedDevice,
} from "@/features/room/domain/saved-device";

const elgato = { id: "id-1", label: "Elgato Virtual Audio" };
const devices = [
  { deviceId: "default", label: "Padrão" },
  { deviceId: "id-9", label: "Elgato Virtual Audio" },
];

test("a saved device reads back, and a bare id saved before still counts", () => {
  expect(parseSavedDevice(serializeSavedDevice(elgato))).toEqual(elgato);
  expect(parseSavedDevice("id-antigo")).toEqual({ id: "id-antigo", label: "" });
  expect(parseSavedDevice(null)).toBeUndefined();
  expect(parseSavedDevice("{nao e json")).toBeUndefined();
  expect(parseSavedDevice(JSON.stringify({ label: "sem id" }))).toBeUndefined();
});

test("the same id is used while it is listed", () => {
  expect(resolveSavedDevice(elgato, [{ deviceId: "id-1", label: "outro nome" }])).toBe("id-1");
});

test("a new id for the same device is found by its name", () => {
  expect(resolveSavedDevice(elgato, devices)).toBe("id-9");
});

test("a device that is gone falls back to the system default", () => {
  expect(resolveSavedDevice(elgato, [{ deviceId: "default", label: "Padrão" }])).toBeUndefined();
  expect(resolveSavedDevice({ id: "x", label: "" }, devices)).toBeUndefined();
  expect(resolveSavedDevice(undefined, devices)).toBeUndefined();
});
