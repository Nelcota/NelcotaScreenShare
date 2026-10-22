import { describe, expect, test } from "vitest";
import {
  composerPlaceholder,
  conversationTitle,
  joinNames,
  messagePreview,
} from "@/features/messages/domain/conversation-display";
import { dayLabel, groupTimeline, listTime } from "@/features/messages/domain/timeline";

/** 12/10/2026 15:00 in São Paulo. */
const NOW = new Date("2026-10-12T18:00:00Z");
const at = (iso: string) => new Date(iso);

function message(id: string, authorId: string, iso: string) {
  return {
    id,
    authorId,
    authorName: authorId,
    body: id,
    gifSlug: null,
    gif: null,
    attachment: null,
    createdAt: at(iso),
  };
}

describe("message timeline", () => {
  test("labels days and list times in São Paulo", () => {
    expect(dayLabel(at("2026-10-12T13:00:00Z"), NOW)).toBe("Hoje");
    expect(dayLabel(at("2026-10-12T01:00:00Z"), NOW)).toBe("Ontem");
    expect(dayLabel(at("2026-10-02T15:00:00Z"), NOW)).toBe("2 de outubro");
    expect(listTime(at("2026-10-12T17:59:30Z"), NOW)).toBe("agora");
    expect(listTime(at("2026-10-12T17:32:00Z"), NOW)).toBe("14:32");
    expect(listTime(at("2026-10-11T12:00:00Z"), NOW)).toBe("ontem");
    expect(listTime(at("2026-10-02T15:00:00Z"), NOW)).toBe("02/10");
  });

  test("joins close messages from the same person and splits by day", () => {
    const days = groupTimeline(
      [
        message("a", "carla", "2026-10-11T22:10:00Z"),
        message("b", "carla", "2026-10-12T17:20:00Z"),
        message("c", "carla", "2026-10-12T17:21:00Z"),
        message("d", "talita", "2026-10-12T17:28:00Z"),
        message("e", "talita", "2026-10-12T17:45:00Z"),
      ],
      NOW,
    );
    expect(days.map((day) => day.label)).toEqual(["Ontem", "Hoje"]);
    const runs = days[1]?.runs.flatMap((run) => (run.type === "messages" ? [run] : [])) ?? [];
    expect(runs.map((run) => run.messages.map((item) => item.id))).toEqual([
      ["b", "c"],
      ["d"],
      ["e"],
    ]);
  });
});

describe("conversation display", () => {
  const group = {
    kind: "group" as const,
    name: null,
    others: [
      { id: "b", name: "Bruno Lima" },
      { id: "d", name: "Diego Rocha" },
      { id: "e", name: "Elisa Prado" },
    ],
  };

  test("names a conversation", () => {
    expect(joinNames(["Bruno", "Diego"])).toBe("Bruno e Diego");
    expect(conversationTitle(group)).toBe("Bruno, Diego e Elisa");
    expect(conversationTitle({ ...group, name: "Noite do filme" })).toBe("Noite do filme");
    expect(composerPlaceholder({ kind: "direct", name: null, others: [group.others[0]!] })).toBe(
      "Mensagem para Bruno",
    );
  });

  test("previews the last message", () => {
    const gif = { authorId: "me", authorName: "Talita", body: null, gifSlug: "x" };
    expect(messagePreview(gif, "direct", "me")).toBe("Você: GIF");
    const text = {
      authorId: "f",
      authorName: "Felipe Nunes",
      body: "oi",
      gifSlug: null,
      gif: null,
      attachment: null,
    };
    expect(messagePreview(text, "group", "me")).toBe("Felipe: oi");
    expect(messagePreview(text, "direct", "me")).toBe("oi");
    // A file alone has neither text nor GIF: it previewed as "GIF".
    const file = { ...text, body: null, gifSlug: null, authorId: "me" };
    expect(messagePreview(file, "group", "me")).toBe("Você: Arquivo");
  });
});
