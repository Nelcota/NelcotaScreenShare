import { expect, test } from "vitest";
import {
  defaultMovedAway,
  replacementMicrophone,
} from "@/features/room/domain/microphone-recovery";

const headset = { deviceId: "headset-id", label: "Fone USB", groupId: "g-headset" };
const webcam = { deviceId: "webcam-id", label: "Microfone (C920)", groupId: "g-webcam" };

test("an unplugged microphone gives way to the system default", () => {
  expect(
    replacementMicrophone([
      { deviceId: "default", label: "Padrão - Microfone (C920)", groupId: "g-webcam" },
      { deviceId: "communications", label: "Comunicações - Microfone (C920)", groupId: "g-webcam" },
      webcam,
    ]),
  ).toEqual({ deviceId: "default", label: "C920" });
});

test("without a default entry, the first microphone left takes over", () => {
  expect(replacementMicrophone([headset, webcam])).toEqual({
    deviceId: "headset-id",
    label: "Fone USB",
  });
});

test("no microphone left, or none the page may use, means none", () => {
  expect(replacementMicrophone([])).toBeUndefined();
  expect(replacementMicrophone([{ deviceId: "", label: "", groupId: "" }])).toBeUndefined();
});

test("a capture on default follows only when the default is now another device", () => {
  const devices = [{ deviceId: "default", label: "Padrão - Headset", groupId: "g-headset" }];
  expect(defaultMovedAway(devices, "g-webcam")).toBe(true);
  expect(defaultMovedAway(devices, "g-headset")).toBe(false);
  expect(defaultMovedAway(devices, undefined)).toBe(false);
  expect(defaultMovedAway([webcam], "g-headset")).toBe(false);
});
