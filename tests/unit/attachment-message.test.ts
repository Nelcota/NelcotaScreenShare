import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import type { MessageAttachment } from "@/features/messages/domain/attachments";
import type { TimelineMessage } from "@/features/messages/domain/timeline";
import { AttachmentMessage } from "@/features/messages/ui/AttachmentMessage";

const photo: MessageAttachment = {
  id: "a1",
  fileName: "praia.jpg",
  kind: "image",
  size: 3_200_000,
  previewUrl: "/api/arquivos/baixar/token",
};
const pdf: MessageAttachment = {
  id: "a2",
  fileName: "orcamento.pdf",
  kind: "pdf",
  size: 2_500_000,
  previewUrl: null,
};

function render(attachment: MessageAttachment, body: string | null) {
  const message: TimelineMessage = {
    id: "m1",
    authorId: "u1",
    authorName: "Bia",
    body,
    gifSlug: null,
    gif: null,
    attachment,
    createdAt: new Date("2026-10-22T13:52:00Z"),
  };
  // Without the markers React puts between joined text pieces.
  return renderToString(
    createElement(AttachmentMessage, {
      message,
      attachment,
      own: false,
      showName: false,
      first: true,
    }),
  ).replaceAll("<!-- -->", "");
}

test("a photo shows with no button on it: a click opens it full screen", () => {
  const html = render(photo, null);
  expect(html).toContain('aria-label="Abrir praia.jpg"');
  expect(html).toContain('src="/api/arquivos/baixar/token"');
  expect(html).not.toContain("Baixar");
});

test("any other file is a card that downloads it, with its kind and size", () => {
  const html = render(pdf, "Segue o orçamento");
  expect(html).toContain('aria-label="Baixar orcamento.pdf"');
  expect(html).toContain("PDF · 2,4 MB");
  expect(html).toContain("Segue o orçamento");
});
