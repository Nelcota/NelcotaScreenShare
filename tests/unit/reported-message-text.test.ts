import { describe, expect, test } from "vitest";
import { reportedMessageText } from "@/features/reports/domain/reports";

describe("the reported message's text", () => {
  test("is the message itself, the GIF or the file it carries", () => {
    expect(reportedMessageText({ body: "Oi", gifSlug: null, fileName: "nota.pdf" })).toBe("Oi");
    expect(reportedMessageText({ body: null, gifSlug: "gato-1", fileName: null })).toBe(
      "GIF: gato-1",
    );
    // A message with only a file used to read "GIF: ".
    expect(reportedMessageText({ body: null, gifSlug: null, fileName: "nota.pdf" })).toBe(
      "Arquivo: nota.pdf",
    );
  });
});
