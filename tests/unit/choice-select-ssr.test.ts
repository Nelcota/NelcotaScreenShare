import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { ChoiceSelect } from "@/components/ChoiceSelect";

/**
 * The chosen option is in the server HTML: the field does not widen after hydration and
 * push the admin tables down (layout shift).
 */
test("the server renders the chosen option's label in the trigger", () => {
  const html = renderToString(
    createElement(ChoiceSelect, {
      id: "situacao",
      value: "bloqueado",
      options: [
        { value: "", label: "Todos os participantes" },
        { value: "bloqueado", label: "Bloqueados" },
      ],
    }),
  );
  expect(html).toContain("Bloqueados");
});
