import { describe, expect, test, vi } from "vitest";
import { sendWithAttachment } from "@/features/messages/client/send-with-attachment";

const attachment = { attachmentId: "a1", fileName: "nota.pdf", kind: "pdf" as const, size: 10 };

function send(sent: boolean) {
  const calls: string[] = [];
  const restore = vi.fn((body: string) => calls.push(`restore:${body}`));
  return {
    calls,
    restore,
    input: {
      conversationId: "c1",
      body: "segue",
      attachment,
      clear: () => calls.push("clear"),
      deliver: async () => {
        calls.push("deliver");
        return sent;
      },
      restore,
    },
  };
}

describe("sending a message with a file", () => {
  /** The box emptied at once and nothing came back when the server refused. */
  test("puts the text and the file back when sending fails", async () => {
    const failing = send(false);

    expect(await sendWithAttachment(failing.input)).toBe(false);

    expect(failing.calls).toEqual(["clear", "deliver", "restore:segue"]);
    expect(failing.restore).toHaveBeenCalledWith("segue", attachment);
  });

  test("leaves the box empty when it goes", async () => {
    const working = send(true);

    expect(await sendWithAttachment(working.input)).toBe(true);

    expect(working.calls).toEqual(["clear", "deliver"]);
  });
});
