import { describe, expect, test } from "vitest";
import {
  admissionRefusal,
  hostCommandSchema,
  mayShareScreen,
} from "@/features/room/domain/host-controls";
import { isPrivateSignalHost } from "@/server/private-signal-host";

describe("server host control contracts", () => {
  test("only host/everyone/selected can share; guests have no implicit authority", () => {
    expect(mayShareScreen("host", "host", "selected", [])).toBe(true);
    expect(mayShareScreen("guest", "host", "host", ["guest"])).toBe(false);
    expect(mayShareScreen("guest", "host", "selected", ["guest"])).toBe(true);
    expect(mayShareScreen("other", "host", "selected", ["guest"])).toBe(false);
    expect(mayShareScreen("other", "host", "everyone", [])).toBe(true);
  });
  test("exclusion wins over prior admission and locks allow only previous admissions", () => {
    expect(admissionRefusal({ closed: false, excluded: true, locked: false, admitted: true })).toBe(
      "room_removed",
    );
    expect(
      admissionRefusal({ closed: false, excluded: false, locked: true, admitted: false }),
    ).toBe("room_locked");
    expect(
      admissionRefusal({ closed: false, excluded: false, locked: true, admitted: true }),
    ).toBeUndefined();
    expect(admissionRefusal({ closed: true, excluded: false, locked: false, admitted: true })).toBe(
      "room_closed",
    );
  });
  test("commands require a session and cannot transfer authority to guest identities", () => {
    const base = { room: "sala-teste", sessionId: crypto.randomUUID() };
    expect(
      hostCommandSchema.safeParse({ ...base, kind: "transfer", identity: "convidado-123" }).success,
    ).toBe(false);
    expect(
      hostCommandSchema.safeParse({ ...base, kind: "sharing", policy: "admin", allowed: [] })
        .success,
    ).toBe(false);
    expect(hostCommandSchema.safeParse({ room: "sala-teste", kind: "close" }).success).toBe(false);
  });
  test("opt-in refuses public signaling origins", () => {
    for (const host of [
      "livekit",
      "localhost",
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.2",
      "192.168.1.2",
      "[::1]",
    ])
      expect(isPrivateSignalHost(host)).toBe(true);
    for (const host of [
      "lk.example.com",
      "8.8.8.8",
      "172.32.1.2",
      "127.evil.example",
      "10.public.example",
    ])
      expect(isPrivateSignalHost(host)).toBe(false);
  });
});
