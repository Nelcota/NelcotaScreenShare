import { describe, expect, test } from "vitest";
import { reportedMessageText } from "@/features/reports/domain/reports";

describe("the reported message's text", () => {
  test("is the message itself, the GIF or the file it carries", () => {
    expect(
      reportedMessageText({ kind: "message", body: "Oi", gifSlug: null, fileName: "nota.pdf" }),
    ).toBe("Oi");
    expect(
      reportedMessageText({ kind: "message", body: null, gifSlug: "gato-1", fileName: null }),
    ).toBe("GIF: gato-1");
    // A message with only a file used to read "GIF: ".
    expect(
      reportedMessageText({ kind: "message", body: null, gifSlug: null, fileName: "nota.pdf" }),
    ).toBe("Arquivo: nota.pdf");
  });

  test("is Chamada perdida for a missed call, not a file", () => {
    const call = { kind: "missed_call", body: null, gifSlug: null, fileName: null } as const;

    const text = reportedMessageText(call);

    expect(text).toBe("Chamada perdida");
  });
});
