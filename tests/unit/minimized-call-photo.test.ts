import type * as Router from "react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { roomCodeSchema } from "@/features/room/domain/room-code";

const remote = vi.hoisted(() => ({
  identity: "019a0000-0000-7000-8000-000000000001",
  name: "Remote speaker",
  isLocal: false,
  isScreenShareEnabled: false,
}));
vi.mock("@livekit/components-react", () => ({
  useParticipants: () => [remote],
  useParticipantTracks: () => [],
  useRoomContext: () => ({ name: "nelcota-019a0000-0000-7000-8000-000000000002" }),
  useParticipantInfo: () => ({ name: remote.name }),
}));
vi.mock("@/features/room/hooks/use-recent-speakers", () => ({
  useRecentSpeakers: () => ({
    faces: [{ identity: remote.identity, speaking: true }],
    nobodyYet: false,
  }),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useRouteLoaderData: () => ({}),
}));
const { CallSpeakers } = await import("@/features/room/ui/call/CallControls");

test("a minimized call requests remote photos with the public room code", () => {
  const html = renderToStaticMarkup(createElement(CallSpeakers, { roomCode: "abc-defg-hij" }));
  const source = /src="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
  expect(source).toBeDefined();
  const url = new URL(source!, "http://localhost");
  expect(url.pathname).toBe("/api/sala/foto");
  expect(url.searchParams.get("sala")).toBe("abc-defg-hij");
  expect(roomCodeSchema.safeParse(url.searchParams.get("sala")).success).toBe(true);
  expect(url.searchParams.get("pessoa")).toBe(remote.identity);
});
