import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, test } from "vitest";
import { SmartBar } from "@/features/home/ui/SmartBar";

function render(onBackToCall?: () => void) {
  const bar = createElement(SmartBar, {
    invalidCode: false,
    pending: false,
    onNavigate: () => {},
    onCreateRoom: () => {},
    onBackToCall,
    mascot: null,
  });
  const Stub = createRoutesStub([{ path: "/", Component: () => bar }]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

describe("the start bar during a call", () => {
  test("offers the way back instead of a new room", () => {
    const html = render(() => {});
    expect(html).toContain("Voltar à chamada");
    expect(html).toContain("volta à chamada");
    expect(html).not.toContain("Criar sala");
  });

  test("without a call it still creates a room", () => {
    const html = render();
    expect(html).toContain("Criar sala");
    expect(html).not.toContain("Voltar à chamada");
  });
});
