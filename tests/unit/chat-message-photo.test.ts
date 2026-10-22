import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { GUEST_IDENTITY_PREFIX } from "@/features/room/domain/participant-label";
import type { ChatEntry } from "@/features/room/hooks/use-chat-state";
import { ChatMessage } from "@/features/room/ui/dock/ChatMessage";

const identity = "019a0000-0000-7000-8000-000000000001";
const message = {
  id: "first",
  text: "Oi",
  timestamp: 1,
  mine: false,
  deleted: false,
  edited: false,
  from: { identity, name: "Bia Teste", isLocal: false },
} as unknown as ChatEntry;

function render(entry: ChatEntry, groupStart = true): string {
  return renderToStaticMarkup(
    createElement(ChatMessage, {
      message: entry,
      roomCode: "abc-defg-hij",
      groupStart,
      editing: false,
      onEdit: () => {},
      onDelete: () => {},
      onCopy: () => {},
    }),
  );
}

test("someone else's chat message shows their photo, not only their initials", () => {
  const source = /src="([^"]+)"/.exec(render(message))?.[1]?.replaceAll("&amp;", "&");
  if (source === undefined) throw new Error("The message has no photo.");
  const url = new URL(source, "http://localhost");
  expect(url.pathname).toBe("/api/sala/foto");
  expect(url.searchParams.get("sala")).toBe("abc-defg-hij");
  expect(url.searchParams.get("pessoa")).toBe(identity);
});

test("the hidden avatar of a follow-up message loads no photo", () => {
  expect(render(message, false)).not.toContain("<img");
});

test("a guest's message keeps the initials, with no photo to load", () => {
  const guest = {
    ...message,
    from: { identity: `${GUEST_IDENTITY_PREFIX}1`, name: "Visita", isLocal: false },
  } as unknown as ChatEntry;
  expect(render(guest)).not.toContain("<img");
});
