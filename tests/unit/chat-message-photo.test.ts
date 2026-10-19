import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
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

test("someone else's chat message shows their photo, not only their initials", () => {
  const html = renderToStaticMarkup(
    createElement(ChatMessage, {
      message,
      roomCode: "abc-defg-hij",
      groupStart: true,
      editing: false,
      onEdit: () => {},
      onDelete: () => {},
      onCopy: () => {},
    }),
  );
  const source = /src="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
  expect(source).toBeDefined();
  const url = new URL(source!, "http://localhost");
  expect(url.pathname).toBe("/api/sala/foto");
  expect(url.searchParams.get("sala")).toBe("abc-defg-hij");
  expect(url.searchParams.get("pessoa")).toBe(identity);
});
