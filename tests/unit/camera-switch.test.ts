import { expect, test } from "vitest";
import { nextCamera } from "@/features/room/domain/camera-switch";

const front = { deviceId: "front" };
const back = { deviceId: "back" };
const usb = { deviceId: "usb" };

test("the switch goes to the next camera and back to the first", () => {
  expect(nextCamera([front, back], "front")).toBe("back");
  expect(nextCamera([front, back], "back")).toBe("front");
  expect(nextCamera([front, back, usb], "back")).toBe("usb");
});

test("on the system default, the switch starts from the first real camera", () => {
  expect(nextCamera([{ deviceId: "default" }, front, back], "default")).toBe("front");
});

test("one camera, or none the page may use, has nothing to switch to", () => {
  expect(nextCamera([front], "front")).toBeUndefined();
  expect(nextCamera([{ deviceId: "" }, { deviceId: "" }], "")).toBeUndefined();
});
