import { expect, test } from "vitest";
import {
  nextExpiry,
  noteSpeakers,
  SPEAKER_HOLD_MS,
  speakerFaces,
} from "@/features/room/domain/recent-speakers";

const present = ["ana", "bia", "caio", "dani"];

test("before anyone speaks, the card shows the count", () => {
  expect(speakerFaces(new Map(), [], present, 0)).toEqual({ faces: [], nobodyYet: true });
});

test("whoever speaks shows with the ring, the most recent first, up to three", () => {
  let last = noteSpeakers(new Map(), ["ana"], 0);
  last = noteSpeakers(last, ["bia", "caio", "dani"], 100);
  const { faces } = speakerFaces(last, ["bia", "caio", "dani"], present, 100);
  expect(faces).toHaveLength(3);
  expect(faces.every((face) => face.speaking)).toBe(true);
  expect(faces.map((face) => face.identity)).not.toContain("ana");
});

test("a short pause keeps the face; after the hold it leaves", () => {
  const last = noteSpeakers(noteSpeakers(new Map(), ["ana"], 0), ["bia"], 1000);
  expect(speakerFaces(last, [], present, 1400).faces).toEqual([
    { identity: "bia", speaking: false },
    { identity: "ana", speaking: false },
  ]);
  expect(speakerFaces(last, [], present, 1000 + SPEAKER_HOLD_MS + 1).faces).toEqual([
    { identity: "bia", speaking: false },
  ]);
});

test("with nobody talking, the last one who spoke stays without the ring", () => {
  const last = noteSpeakers(new Map(), ["caio"], 0);
  expect(speakerFaces(last, [], present, 60_000).faces).toEqual([
    { identity: "caio", speaking: false },
  ]);
});

test("someone who left the call is not shown", () => {
  const last = noteSpeakers(new Map(), ["caio"], 0);
  expect(speakerFaces(last, [], ["ana"], 10)).toEqual({ faces: [], nobodyYet: true });
});

test("the card redraws when the next held face is due to leave", () => {
  const last = noteSpeakers(new Map(), ["ana"], 0);
  expect(nextExpiry(last, [], 500)).toBe(SPEAKER_HOLD_MS - 500);
  expect(nextExpiry(last, ["ana"], 500)).toBeUndefined();
  expect(nextExpiry(last, [], SPEAKER_HOLD_MS + 10)).toBeUndefined();
});
