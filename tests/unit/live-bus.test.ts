import { describe, expect, test, vi } from "vitest";
import { createLiveBus } from "@/features/live/server/live-bus.server";

describe("live bus", () => {
  test("nudges only the accounts involved, on every open stream", () => {
    const bus = createLiveBus();
    const anaTab = vi.fn();
    const anaPhone = vi.fn();
    const bia = vi.fn();
    bus.subscribe("ana", anaTab);
    bus.subscribe("ana", anaPhone);
    bus.subscribe("bia", bia);
    bus.notify(["ana", "ana", "caio"], "friends");
    expect(anaTab).toHaveBeenCalledExactlyOnceWith("friends");
    expect(anaPhone).toHaveBeenCalledExactlyOnceWith("friends");
    expect(bia).not.toHaveBeenCalled();
  });

  test("carries data only when there is some", () => {
    const bus = createLiveBus();
    const bia = vi.fn();
    bus.subscribe("bia", bia);
    bus.notify(["bia"], "ring", { id: "toque" });
    expect(bia).toHaveBeenCalledExactlyOnceWith("ring", { id: "toque" });
  });

  test("a closed stream stops hearing and leaves nothing behind", () => {
    const bus = createLiveBus();
    const first = vi.fn();
    const second = vi.fn();
    const closeFirst = bus.subscribe("ana", first);
    const closeSecond = bus.subscribe("ana", second);
    closeFirst();
    bus.notify(["ana"], "status");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(bus.streamCount("ana")).toBe(1);
    closeSecond();
    closeSecond();
    expect(bus.streamCount("ana")).toBe(0);
  });
});
