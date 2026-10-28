import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { SettingsRow } from "@/features/account/ui/settings/Settings";

/**
 * With the friends column open, a wide window leaves the settings a narrow panel: rows that
 * split by the window's width ran off its right edge. They split by the panel's width now.
 */
test("a settings row splits into two columns by its container, not by the window", () => {
  const html = renderToString(
    createElement(SettingsRow, { title: "Nome na sala" }, createElement("input")),
  );

  expect(html).toContain("@xl:grid-cols-[15rem_minmax(0,1fr)]");
  expect(html).not.toMatch(/(^|[" ])sm:grid-cols/);
});
