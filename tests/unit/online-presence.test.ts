import { describe, expect, test } from "vitest";
import {
  isOnline,
  markOnline,
  ONLINE_WINDOW_MS,
  onWentOffline,
  sweepExpired,
} from "@/features/friends/server/online-presence.server";

describe("online presence", () => {
  test("someone is online until the window after the last beat runs out", () => {
    let time = 1_000_000;
    const now = () => time;
    expect(isOnline("ana", now)).toBe(false);
    markOnline("ana", now);
    time += ONLINE_WINDOW_MS;
    expect(isOnline("ana", now)).toBe(true);
    time += 1;
    expect(isOnline("ana", now)).toBe(false);
  });
});

describe("presence changes", () => {
  test("the first beat reports coming online; the next ones do not", () => {
    let time = 5_000_000;
    const now = () => time;
    expect(markOnline("caio", now)).toBe(true);
    time += 45_000;
    expect(markOnline("caio", now)).toBe(false);
  });

  test("the sweep tells who went offline and forgets them", () => {
    let time = 9_000_000;
    const now = () => time;
    const announced: string[][] = [];
    onWentOffline((userIds) => announced.push(userIds));
    markOnline("dora", now);
    time += ONLINE_WINDOW_MS + 1;
    markOnline("edu", now);
    expect(sweepExpired(now)).toContain("dora");
    expect(announced.flat()).toContain("dora");
    expect(announced.flat()).not.toContain("edu");
    expect(isOnline("dora", now)).toBe(false);
    expect(markOnline("dora", now)).toBe(true);
  });
});
