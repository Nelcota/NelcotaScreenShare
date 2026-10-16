import { expect, test } from "vitest";
import {
  acceptAnnotation,
  annotationMessageSchema,
  ANNOTATION_TTL,
} from "@/features/room/domain/annotations";

const context = { sessionId: crypto.randomUUID(), trackSid: "TR_test", epoch: crypto.randomUUID() };
const mark = {
  ...context,
  id: crypto.randomUUID(),
  v: 1 as const,
  kind: "mark" as const,
  shape: "arrow" as const,
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.8, y: 0.7 },
  ],
  createdAt: Date.now(),
  preview: false,
};
test("sender identity owns marks and deletion cannot impersonate another author", () => {
  const list = acceptAnnotation([], mark, "ana", "Ana", context, mark.createdAt);
  const removed = { ...context, v: 1 as const, kind: "remove" as const, id: mark.id };
  expect(acceptAnnotation(list, removed, "bia", "Bia", context, mark.createdAt)).toHaveLength(1);
  expect(acceptAnnotation(list, removed, "ana", "Ana", context, mark.createdAt)).toHaveLength(0);
});
test("old epochs, old sessions, stale messages and oversized point arrays are rejected", () => {
  expect(
    acceptAnnotation(
      [],
      { ...mark, epoch: crypto.randomUUID() },
      "ana",
      "Ana",
      context,
      mark.createdAt,
    ),
  ).toHaveLength(0);
  expect(
    acceptAnnotation(
      [],
      { ...mark, sessionId: crypto.randomUUID() },
      "ana",
      "Ana",
      context,
      mark.createdAt,
    ),
  ).toHaveLength(0);
  expect(
    acceptAnnotation([], mark, "ana", "Ana", context, mark.createdAt + ANNOTATION_TTL + 1),
  ).toHaveLength(0);
  expect(
    annotationMessageSchema.safeParse({
      ...mark,
      points: Array.from({ length: 65 }, () => ({ x: 0, y: 0 })),
    }).success,
  ).toBe(false);
  expect(annotationMessageSchema.safeParse({ ...mark, author: "host" }).success).toBe(false);
});
test("resending a completed mark never extends its life and each author is capped", () => {
  let list = acceptAnnotation([], mark, "ana", "Ana", context, mark.createdAt);
  const expires = list[0]?.expiresAt;
  list = acceptAnnotation(
    list,
    { ...mark, createdAt: mark.createdAt + 1_000 },
    "ana",
    "Ana",
    context,
    mark.createdAt + 1_000,
  );
  expect(list[0]?.expiresAt).toBe(expires);
  for (let i = 0; i < 20; i += 1)
    list = acceptAnnotation(
      list,
      { ...mark, id: crypto.randomUUID() },
      "ana",
      "Ana",
      context,
      mark.createdAt,
    );
  expect(list).toHaveLength(8);
});

test("a late preview cannot replace or shorten a completed annotation", () => {
  const committed = acceptAnnotation([], mark, "ana", "Ana", context, mark.createdAt);
  const received = acceptAnnotation(
    committed,
    {
      ...mark,
      preview: true,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.2, y: 0.3 },
      ],
    },
    "ana",
    "Ana",
    context,
    mark.createdAt + 200,
  );
  expect(received).toEqual(committed);
});

test("a completed annotation replaces its preview with the full lifetime", () => {
  const preview = acceptAnnotation(
    [],
    { ...mark, preview: true },
    "ana",
    "Ana",
    context,
    mark.createdAt,
  );
  const committed = acceptAnnotation(preview, mark, "ana", "Ana", context, mark.createdAt + 200);
  expect(committed).toHaveLength(1);
  expect(committed[0]?.preview).toBe(false);
  expect(committed[0]?.expiresAt).toBe(mark.createdAt + ANNOTATION_TTL);
});
