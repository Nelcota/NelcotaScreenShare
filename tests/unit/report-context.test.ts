import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { expect, test } from "vitest";
import type { getReport } from "@/features/admin/reports/server/queries.server";
import { ReportContext } from "@/features/admin/reports/ui/ReportContext";

type Detail = NonNullable<Awaited<ReturnType<typeof getReport>>>;

const at = new Date("2026-10-23T02:10:00Z");
const pdf = { fileName: "lista.pdf", kind: "pdf" as const, size: 248_000 };

function report(changes: Partial<Detail["report"]>): Detail["report"] {
  return {
    id: "r1",
    targetKind: "message",
    reason: "harassment",
    details: null,
    status: "open",
    resolution: null,
    resolvedAt: null,
    createdAt: at,
    messageExcerpt: "Arquivo: lista.pdf",
    targetMessageId: "m2",
    targetConversationId: "c1",
    conversationName: "Projeto",
    reporterId: "u1",
    reporterName: "Ana",
    targetUserId: "u2",
    targetName: "Bia",
    targetBlocked: false,
    file: pdf,
    ...changes,
  };
}

function render(detail: Detail): string {
  const Stub = createRoutesStub([
    { path: "/admin/denuncias/r1", Component: () => createElement(ReportContext, { detail }) },
  ]);
  return renderToString(createElement(Stub, { initialEntries: ["/admin/denuncias/r1"] }));
}

test("a reported message with only a file shows the file, not GIF", () => {
  const html = render({
    report: report({}),
    context: [
      {
        id: "m1",
        authorName: "Ana",
        body: null,
        gifSlug: null,
        fileName: "foto.png",
        createdAt: at,
      },
      {
        id: "m2",
        authorName: "Bia",
        body: null,
        gifSlug: null,
        fileName: "lista.pdf",
        createdAt: at,
      },
    ],
  });

  expect(html).not.toContain("GIF: ");
  expect(html).toContain("Arquivo: foto.png");
  expect(html).toContain('aria-label="Baixar lista.pdf"');
  // React puts a marker between the joined text pieces.
  expect(html).toMatch(/PDF(<!-- -->)? · /);
});

test("a deleted message's file stays in the report until it is resolved", () => {
  const html = render({ report: report({ targetMessageId: null }), context: [] });

  expect(html).toContain("Arquivo guardado até a denúncia ser resolvida");
  expect(html).not.toContain("Arquivo: lista.pdf");
  expect(html).toContain('aria-label="Baixar lista.pdf"');
});

test("a deleted message with text keeps the copy above its file", () => {
  const html = render({
    report: report({ targetMessageId: null, messageExcerpt: "Olha isso" }),
    context: [],
  });

  expect(html).toContain("Cópia e arquivo guardados até a denúncia ser resolvida");
  expect(html).toContain("Olha isso");
});
